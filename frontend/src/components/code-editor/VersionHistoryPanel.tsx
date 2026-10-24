import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { History, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface VersionMeta {
  id: string;
  versionNumber: number;
  reason: "MANUAL" | "AUTO" | "PRE_RESTORE" | "RESTORE";
  authorId: string | null;
  createdAt: string;
}

interface VersionHistoryPanelProps {
  fileId?: string;
  fileName?: string;
  accessToken?: string;
}

const REASON_LABEL: Record<VersionMeta["reason"], string> = {
  MANUAL: "Snapshot",
  AUTO: "Auto-save",
  PRE_RESTORE: "Before restore",
  RESTORE: "Restored",
};

/**
 * V2 version history for the active file. Snapshots and restores are taken by the server from
 * the live collaborative document; a restore reaches every open editor through Yjs.
 */
export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({ fileId, fileName, accessToken }) => {
  const { theme } = useTheme();
  const [versions, setVersions] = React.useState<VersionMeta[]>([]);
  const [preview, setPreview] = React.useState<{ id: string; content: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  const api = React.useCallback(async (path: string, init?: RequestInit) => {
    const res = await fetch(`/api/files/${fileId}/versions${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || body.message || `Request failed (${res.status})`);
    return body;
  }, [fileId, accessToken]);

  const load = React.useCallback(async () => {
    if (!fileId || !accessToken) return;
    try {
      setVersions(await api(""));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [api, fileId, accessToken]);

  React.useEffect(() => {
    setPreview(null);
    load();
  }, [load]);

  const saveSnapshot = async () => {
    setBusy(true);
    try {
      const v = await api("", { method: "POST" });
      toast.success(`Saved version ${v.versionNumber}`);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const restore = async (v: VersionMeta) => {
    if (!confirm(`Restore ${fileName ?? "file"} to version ${v.versionNumber}? Current content is saved first.`)) return;
    setBusy(true);
    try {
      await api(`/${v.id}/restore`, { method: "POST" });
      toast.success(`Restored version ${v.versionNumber}`);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const showPreview = async (v: VersionMeta) => {
    if (preview?.id === v.id) return setPreview(null);
    try {
      const full = await api(`/${v.id}`);
      setPreview({ id: v.id, content: full.content });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (!fileId) {
    return <div className="text-sm text-muted-foreground">Open a file to see its versions.</div>;
  }

  return (
    <div className="h-full overflow-auto" data-testid="version-history">
      <div className="flex items-center justify-between mb-2">
        <h3 className={`font-semibold ${theme === "dark" ? "text-gray-300" : "text-gray-900"}`}>Version History</h3>
        <Button size="sm" variant="outline" onClick={saveSnapshot} disabled={busy} data-testid="save-snapshot">
          <Save className="h-4 w-4 mr-1" /> Save snapshot
        </Button>
      </div>
      {versions.length === 0 && <div className="text-sm text-muted-foreground">No versions yet.</div>}
      <div className="space-y-2">
        {versions.map((v) => (
          <div key={v.id} className={`p-2 rounded ${theme === "dark" ? "hover:bg-gray-800 text-gray-300" : "hover:bg-gray-100 text-gray-700"}`}>
            <div className="flex items-start space-x-2">
              <History className="h-4 w-4 mt-1 flex-shrink-0" />
              <button className="flex-1 min-w-0 text-left" onClick={() => showPreview(v)}>
                <p className="font-medium truncate">v{v.versionNumber} · {REASON_LABEL[v.reason]}</p>
                <p className="text-xs opacity-70">{new Date(v.createdAt).toLocaleString()}</p>
              </button>
              <Button size="sm" variant="ghost" onClick={() => restore(v)} disabled={busy} data-testid={`restore-v${v.versionNumber}`}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            {preview?.id === v.id && (
              <pre className="mt-2 max-h-48 overflow-auto rounded bg-black/30 p-2 text-xs whitespace-pre-wrap">{preview.content}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default VersionHistoryPanel;
