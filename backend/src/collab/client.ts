import axios from 'axios';

/** API-side client for the collab server's internal HTTP endpoints (shared-secret authenticated). */
const baseURL = () => process.env.COLLAB_INTERNAL_URL || `http://127.0.0.1:${process.env.COLLAB_PORT || 1234}`;

export class CollabUnavailableError extends Error {}

async function post<T>(path: string, body: unknown): Promise<{ status: number; data: T }> {
  try {
    const res = await axios.post(`${baseURL()}${path}`, body, {
      headers: { 'x-internal-secret': process.env.COLLAB_INTERNAL_SECRET || '' },
      timeout: Number(process.env.COLLAB_INTERNAL_TIMEOUT_MS || 10000),
      validateStatus: () => true,
    });
    if (res.status >= 500 || res.status === 401) throw new CollabUnavailableError(`collab responded ${res.status}`);
    return { status: res.status, data: res.data };
  } catch (err) {
    if (err instanceof CollabUnavailableError) throw err;
    throw new CollabUnavailableError((err as Error).message);
  }
}

export const collabClient = {
  snapshot: (fileId: string, authorId: string) => post<any>('/internal/snapshot', { fileId, authorId, reason: 'MANUAL' }),
  restore: (fileId: string, versionId: string, authorId: string) => post<any>('/internal/restore', { fileId, versionId, authorId }),
};
