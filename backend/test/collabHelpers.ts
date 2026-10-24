import * as Y from 'yjs';
import WebSocket from 'ws';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { TEXT_NAME, documentNameFor } from '../src/collab/persistence';
import { waitFor } from './helpers';

export interface TestClient {
  provider: HocuspocusProvider;
  doc: Y.Doc;
  text: Y.Text;
  authFailed: () => string | null;
  destroy: () => void;
}

/**
 * Real Hocuspocus client over a real WebSocket. `broadcast: false` disables the in-process
 * BroadcastChannel shortcut, so every update between test clients goes through the server.
 */
export function connectClient(url: string, fileId: string, token: string): TestClient {
  const doc = new Y.Doc();
  let failed: string | null = null;
  const provider = new HocuspocusProvider({
    url,
    name: documentNameFor(fileId),
    token,
    document: doc,
    broadcast: false,
    WebSocketPolyfill: WebSocket,
    delay: 100,
    maxDelay: 500,
    onAuthenticationFailed: ({ reason }: { reason?: string }) => { failed = reason || 'failed'; },
  } as any);
  return {
    provider, doc, text: doc.getText(TEXT_NAME),
    authFailed: () => failed,
    destroy: () => provider.destroy(),
  };
}

export const synced = (c: TestClient, timeoutMs = 5000) => waitFor(() => c.provider.isSynced, timeoutMs);

export const converged = (clients: TestClient[], timeoutMs = 5000) =>
  waitFor(() => clients.every(c => c.text.toString() === clients[0].text.toString()), timeoutMs);
