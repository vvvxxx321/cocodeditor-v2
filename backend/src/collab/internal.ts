import type { IncomingMessage, ServerResponse } from 'http';
import { timingSafeEqual } from 'crypto';
import { VersionReason } from '@prisma/client';
import type { Hocuspocus } from '@hocuspocus/server';
import { logger as baseLogger } from '../logger';
import { NotFoundError, restore, snapshot } from './versionOps';

const logger = baseLogger.child({ component: 'collab-internal' });

function secretOk(header: string | string[] | undefined) {
  const expected = process.env.COLLAB_INTERNAL_SECRET;
  if (!expected || typeof header !== 'string') return false;
  const a = Buffer.from(header), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readJson(request: IncomingMessage, limit = 64 * 1024): Promise<any> {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > limit) throw new Error('Body too large');
  }
  return body ? JSON.parse(body) : {};
}

const send = (response: ServerResponse, status: number, payload: unknown) => {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
};

/**
 * Internal HTTP API on the collab port, called only by the API server (shared secret; the API
 * has already authenticated the user and enforced RBAC). Returns true if it handled the request.
 */
export async function handleInternalRequest(server: Hocuspocus, request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  if (!request.url?.startsWith('/internal/')) return false;
  if (!secretOk(request.headers['x-internal-secret'])) {
    send(response, 401, { error: 'Unauthorized' });
    return true;
  }
  if (request.method !== 'POST') {
    send(response, 405, { error: 'Method not allowed' });
    return true;
  }
  const started = Date.now();
  try {
    const body = await readJson(request);
    if (request.url === '/internal/snapshot') {
      const reason = body.reason === VersionReason.AUTO ? VersionReason.AUTO : VersionReason.MANUAL;
      const version = await snapshot(server, String(body.fileId), reason, body.authorId ?? null);
      send(response, 201, version);
    } else if (request.url === '/internal/restore') {
      const result = await restore(server, String(body.fileId), String(body.versionId), body.authorId ?? null);
      send(response, 200, result);
    } else {
      send(response, 404, { error: 'Not found' });
    }
    logger.info({ url: request.url, fileId: body.fileId, durationMs: Date.now() - started }, 'internal request handled');
  } catch (err) {
    if (err instanceof NotFoundError) send(response, 404, { error: err.message });
    else {
      logger.error({ err, url: request.url }, 'internal request failed');
      send(response, 500, { error: 'Internal error' });
    }
  }
  return true;
}
