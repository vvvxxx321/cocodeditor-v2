import * as Y from 'yjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../database/prismaClient';

/** Name of the shared Y.Text that holds a file's content (must match the frontend binding). */
export const TEXT_NAME = 'content';
const DOC_PREFIX = 'file:';

export const documentNameFor = (fileId: string) => `${DOC_PREFIX}${fileId}`;

export function fileIdFromDocumentName(documentName: string): string | null {
  if (!documentName.startsWith(DOC_PREFIX)) return null;
  const id = documentName.slice(DOC_PREFIX.length);
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

/**
 * Load the durable CRDT state for a file.
 *
 * V1 → V2 migration: a file that has never been opened collaboratively only has plain
 * `File.content`. We build the initial Y.Doc from it and persist that state *before*
 * returning it, using an insert that is a no-op if another loader won the race. Every
 * loader then returns the one stored state, so the bootstrap insert happens exactly once
 * and content is never duplicated by two independently-created initial updates.
 */
export async function fetchState(fileId: string): Promise<Uint8Array | null> {
  const existing = await prisma.fileDocument.findUnique({ where: { fileId } });
  if (existing) return new Uint8Array(existing.state);

  const file = await prisma.file.findUnique({ where: { id: fileId }, select: { content: true } });
  if (!file) return null;

  const doc = new Y.Doc();
  if (file.content) doc.getText(TEXT_NAME).insert(0, file.content);
  const initial = Buffer.from(Y.encodeStateAsUpdate(doc));
  doc.destroy();

  await prisma.fileDocument.createMany({ data: [{ fileId, state: initial }], skipDuplicates: true });
  const stored = await prisma.fileDocument.findUniqueOrThrow({ where: { fileId } });
  return new Uint8Array(stored.state);
}

type Tx = Prisma.TransactionClient;

/**
 * Persist the CRDT state and the materialized plain text atomically (inside `tx`).
 *
 * Merge-on-write: the stored state is locked (SELECT ... FOR UPDATE) and merged with the
 * incoming state instead of being overwritten. Merging CRDT states is commutative and
 * idempotent, so a slower writer holding an older in-memory state (e.g. a debounced store
 * racing a snapshot/restore write) can never regress what is stored. Returns the merged text.
 */
export async function storeStateTx(tx: Tx, fileId: string, update: Uint8Array): Promise<{ content: string; state: Buffer }> {
  const rows = await tx.$queryRaw<{ state: Buffer }[]>`
    SELECT state FROM "FileDocument" WHERE "fileId" = ${fileId} FOR UPDATE`;
  const merged = new Y.Doc();
  if (rows[0]) Y.applyUpdate(merged, new Uint8Array(rows[0].state));
  Y.applyUpdate(merged, update);
  const state = Buffer.from(Y.encodeStateAsUpdate(merged));
  const content = merged.getText(TEXT_NAME).toString();
  merged.destroy();
  await tx.fileDocument.upsert({ where: { fileId }, create: { fileId, state }, update: { state } });
  await tx.file.update({ where: { id: fileId }, data: { content } });
  return { content, state };
}

export async function storeState(fileId: string, doc: Y.Doc): Promise<{ content: string }> {
  const update = Y.encodeStateAsUpdate(doc);
  return prisma.$transaction(tx => storeStateTx(tx, fileId, update));
}
