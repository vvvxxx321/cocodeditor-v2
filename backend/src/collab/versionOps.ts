import * as Y from 'yjs';
import { VersionReason } from '@prisma/client';
import type { Hocuspocus } from '@hocuspocus/server';
import { prisma } from '../database/prismaClient';
import { versionService } from '../services/versionService';
import { documentNameFor, storeStateTx, TEXT_NAME } from './persistence';

/**
 * Snapshot and restore run inside the collab process, against the LIVE Y.Doc held by
 * Hocuspocus, never against File.content (which lags behind by the store debounce).
 * A per-document mutex serializes snapshot/restore on the same file.
 */
const locks = new Map<string, Promise<unknown>>();

export function withDocLock<T>(fileId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(fileId) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  const tail = run.catch(() => undefined);
  locks.set(fileId, tail);
  tail.then(() => { if (locks.get(fileId) === tail) locks.delete(fileId); });
  return run;
}

export class NotFoundError extends Error {}

const ORIGIN = 'version-ops';

/** Opens the document (the in-memory one if loaded, else loaded from the DB) for server-side work. */
async function withDocument<T>(server: Hocuspocus, fileId: string, fn: (conn: Awaited<ReturnType<Hocuspocus['openDirectConnection']>>) => Promise<T>) {
  const file = await prisma.file.findUnique({ where: { id: fileId }, select: { id: true } });
  if (!file) throw new NotFoundError('File not found');
  const conn = await server.openDirectConnection(documentNameFor(fileId), { internal: ORIGIN });
  try {
    return await fn(conn);
  } finally {
    await conn.disconnect();
  }
}

/** Reads text + state at one point in time (single-threaded JS: no update can interleave). */
function capture(doc: Y.Doc) {
  return { content: doc.getText(TEXT_NAME).toString(), update: Y.encodeStateAsUpdate(doc) };
}

async function persistAndVersion(fileId: string, update: Uint8Array, reason: VersionReason, authorId: string | null) {
  return versionService.withVersionTx(async (tx) => {
    const { content, state } = await storeStateTx(tx, fileId, update);
    return versionService.insertVersion(tx, { fileId, reason, content, yjsState: state, authorId });
  });
}

export function snapshot(server: Hocuspocus, fileId: string, reason: VersionReason, authorId: string | null) {
  return withDocLock(fileId, () =>
    withDocument(server, fileId, async (conn) => {
      const { update } = capture(conn.document!);
      return persistAndVersion(fileId, update, reason, authorId);
    }));
}

/**
 * Restore = PRE_RESTORE snapshot of the live doc, then a *forward* CRDT transaction that replaces
 * the text with the version's content. Connected clients receive it as a normal update. The stored
 * Yjs blob is never overwritten with old bytes (clients would re-merge their newer state into it).
 */
export function restore(server: Hocuspocus, fileId: string, versionId: string, authorId: string | null) {
  return withDocLock(fileId, () =>
    withDocument(server, fileId, async (conn) => {
      const version = await prisma.fileVersion.findFirst({ where: { id: versionId, fileId }, select: { content: true, versionNumber: true } });
      if (!version) throw new NotFoundError('Version not found');

      const pre = capture(conn.document!);
      const preRestore = await persistAndVersion(fileId, pre.update, VersionReason.PRE_RESTORE, authorId);

      await conn.transact((doc) => {
        const text = doc.getText(TEXT_NAME);
        text.delete(0, text.length);
        text.insert(0, version.content);
      }, ORIGIN);

      const post = capture(conn.document!);
      const restored = await persistAndVersion(fileId, post.update, VersionReason.RESTORE, authorId);
      return { restoredFrom: version.versionNumber, preRestore, restored };
    }));
}

/**
 * AUTO snapshot after a store if the content changed and the last version is old enough.
 * Deliberately NOT under withDocLock: this runs inside the store hook, which can be triggered by
 * conn.disconnect() while snapshot()/restore() hold the lock (that would deadlock). Version-number
 * uniqueness is still guaranteed by the unique index + retry in withVersionTx.
 */
export async function maybeAutoSnapshot(fileId: string, content: string, state: Uint8Array, intervalMs: number) {
  if (!Number.isFinite(intervalMs) || intervalMs < 0) return null; // disabled
  const last = await prisma.fileVersion.findFirst({
    where: { fileId }, orderBy: { versionNumber: 'desc' }, select: { createdAt: true, content: true },
  });
  if (last && (last.content === content || Date.now() - last.createdAt.getTime() < intervalMs)) return null;
  return versionService.withVersionTx(tx =>
    versionService.insertVersion(tx, { fileId, reason: VersionReason.AUTO, content, yjsState: Buffer.from(state), authorId: null }));
}
