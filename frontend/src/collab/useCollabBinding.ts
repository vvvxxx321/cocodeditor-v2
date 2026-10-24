import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { MonacoBinding } from 'y-monaco';
import type { editor } from 'monaco-editor';
import { supabaseClient } from '@/config/supabase-client';

export const COLLAB_URL = import.meta.env.VITE_COLLAB_URL || 'ws://localhost:1234';
/** Must match backend/src/collab/persistence.ts TEXT_NAME. */
const TEXT_NAME = 'content';

export type CollabStatus = 'connecting' | 'connected' | 'disconnected';

const COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#008080'];
const colorFor = (id: string) => COLORS[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % COLORS.length];

/**
 * Binds a Monaco editor to the Yjs document `file:<fileId>` served by Hocuspocus.
 * Edits are exchanged as CRDT updates (not whole documents); remote cursors use Yjs awareness.
 * The provider is torn down and recreated when the file changes.
 */
export function useCollabBinding(
  monacoEditor: editor.IStandaloneCodeEditor | null,
  fileId: string | undefined,
  user: { id: string; name?: string } | null,
) {
  const [status, setStatus] = useState<CollabStatus>('disconnected');
  const [synced, setSynced] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const model = monacoEditor?.getModel();
    if (!monacoEditor || !model || !fileId) return;

    setSynced(false);
    setAuthError(null);
    const doc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: COLLAB_URL,
      name: `file:${fileId}`,
      document: doc,
      // Read the current (possibly refreshed) Supabase access token on every (re)connect.
      token: async () => (await supabaseClient.auth.getSession()).data.session?.access_token ?? '',
      // All sync goes through the server so server-side authorization (e.g. read-only viewers) applies.
      broadcast: false,
      onStatus: ({ status }) => setStatus(status as CollabStatus),
      onSynced: ({ state }) => setSynced(state),
      onAuthenticationFailed: ({ reason }) => setAuthError(reason || 'Access denied'),
    });
    if (user) {
      provider.awareness?.setLocalStateField('user', { name: user.name || user.id.slice(0, 8), color: colorFor(user.id) });
    }
    const binding = new MonacoBinding(doc.getText(TEXT_NAME), model, new Set([monacoEditor]), provider.awareness);

    return () => {
      binding.destroy();
      provider.destroy();
      doc.destroy();
    };
  }, [monacoEditor, fileId, user?.id]);

  return { status, synced, authError };
}
