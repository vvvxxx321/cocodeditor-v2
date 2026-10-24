import { Hocuspocus, onAuthenticatePayload } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { verifyAccessToken } from '../auth/verifyToken';
import { can, getFileAccess } from '../auth/rbac';
import { logger as baseLogger } from '../logger';
import { fetchState, fileIdFromDocumentName, storeState } from './persistence';
import { handleInternalRequest } from './internal';
import { maybeAutoSnapshot } from './versionOps';
import * as Y from 'yjs';

const logger = baseLogger.child({ component: 'collab' });

export interface CollabOptions {
  port?: number;
  debounce?: number;
  maxDebounce?: number;
  /** Minimum age of the last version before a store creates an AUTO version (default 5 min). */
  autoSnapshotIntervalMs?: number;
}

/**
 * Hocuspocus (Yjs WebSocket) server. Runs as its own process (`npm run collab`), separate from
 * the Express/Socket.IO API, so the two can be scaled independently.
 *
 * Document name: `file:<fileId>`. One Y.Doc per file; text lives in Y.Text "content".
 */
export function createCollabServer(opts: CollabOptions = {}) {
  const autoInterval = opts.autoSnapshotIntervalMs ?? Number(process.env.AUTO_SNAPSHOT_INTERVAL_MS || 5 * 60 * 1000);
  const server = new Hocuspocus({
    port: opts.port ?? Number(process.env.COLLAB_PORT || 1234),
    quiet: true,
    // Stores are debounced (coalescing keystrokes into fewer DB writes). This does NOT bound
    // data loss on crash: edits made since the last store live only in collab-server memory.
    // Under continuous typing every change resets `debounce`, so stores happen every `maxDebounce`.
    // Tunable: lower = less at-risk work on a crash, more DB writes.
    debounce: opts.debounce ?? Number(process.env.COLLAB_DEBOUNCE_MS || 2000),
    maxDebounce: opts.maxDebounce ?? Number(process.env.COLLAB_MAX_DEBOUNCE_MS || 3000),

    async onAuthenticate(data: onAuthenticatePayload) {
      const fileId = fileIdFromDocumentName(data.documentName);
      if (!fileId) throw new Error('Invalid document name');

      const user = await verifyAccessToken(data.token).catch(() => null);
      if (!user) {
        logger.warn({ documentName: data.documentName }, 'collab auth rejected: invalid token');
        throw new Error('Unauthorized');
      }
      const access = await getFileAccess(user.id, fileId);
      if (!access || !can(access.role, 'read')) {
        logger.warn({ userId: user.id, fileId }, 'collab auth rejected: no access');
        throw new Error('Forbidden');
      }
      // Viewers receive updates but the server drops any update they send.
      if (!can(access.role, 'write')) data.connection.readOnly = true;
      logger.info({ userId: user.id, fileId, role: access.role }, 'collab connection authorized');
      return { userId: user.id, role: access.role, fileId };
    },

    async onRequest({ request, response }) {
      // Internal API (Phase 2: snapshot/restore). Resolving lets Hocuspocus answer 200 "OK".
      const handled = await handleInternalRequest(server, request, response);
      if (handled) throw null; // stop the hook chain: we already wrote the response
    },

    extensions: [
      new Database({
        fetch: async ({ documentName }) => {
          const fileId = fileIdFromDocumentName(documentName);
          return fileId ? fetchState(fileId) : null;
        },
        store: async ({ documentName, document }) => {
          const fileId = fileIdFromDocumentName(documentName);
          if (!fileId) return;
          const started = Date.now();
          try {
            const { content } = await storeState(fileId, document);
            logger.debug({ fileId, durationMs: Date.now() - started }, 'collab document stored');
            await maybeAutoSnapshot(fileId, content, Y.encodeStateAsUpdate(document), autoInterval)
              .catch(err => logger.warn({ fileId, err }, 'auto snapshot failed'));
          } catch (err) {
            logger.error({ fileId, err }, 'collab document store failed');
            throw err;
          }
        },
      }),
    ],
  });
  return server;
}
