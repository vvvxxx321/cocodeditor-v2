import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Editor } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Maximize2, Minimize2 } from "lucide-react";
import { editor } from "monaco-editor";
import "@/collab/monacoSetup";
import { useCollabBinding } from "@/collab/useCollabBinding";

declare global {
  interface Window {
    editor: editor.IStandaloneCodeEditor;
  }
}

export interface EditorPanelProps {
  code: string;
  onCodeChange: (value: string | undefined) => void;
  isDebugging?: boolean;
  breakpoints?: number[];
  currentLine?: number | null;
  onBreakpointToggle?: (line: number) => void;
  language?: string;
  filename?: string;
  /** V2: when set, the editor is bound to the collaborative Yjs document for this file. */
  fileId?: string;
  collabUser?: { id: string; name?: string } | null;
}

const EditorPanel: React.FC<EditorPanelProps> = ({
  code,
  onCodeChange,
  isDebugging = false,
  breakpoints = [],
  currentLine = null,
  onBreakpointToggle,
  language,
  filename,
  fileId,
  collabUser = null,
}) => {
  const { theme } = useTheme();
  const [isMinimapVisible, setIsMinimapVisible] = React.useState(true);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  // Determine the language based on filename or language prop
  const getEditorLanguage = (): string => {
    if (language) {
      return language;
    }
    
    if (filename) {
      const extension = filename.split('.').pop()?.toLowerCase();
      switch (extension) {
        case 'js':
          return 'javascript';
        case 'ts':
          return 'typescript';
        case 'py':
          return 'python';
        case 'html':
          return 'html';
        case 'css':
          return 'css';
        case 'json':
          return 'json';
        case 'c':
          return 'c';
        case 'cpp':
        case 'cc':
        case 'cxx':
        case 'h':
        case 'hpp':
          return 'cpp';
        case 'java':
          return 'java';
        default:
          return 'javascript';
      }
    }
    
    return 'javascript';
  };

  // Set up breakpoint decorations
  const editorRef = React.useRef<editor.IStandaloneCodeEditor | null>(null);
  const [mountedEditor, setMountedEditor] = React.useState<editor.IStandaloneCodeEditor | null>(null);
  const collab = useCollabBinding(mountedEditor, fileId, collabUser);
  
  React.useEffect(() => {
    if (editorRef.current && isDebugging) {
      // Apply decorations
      const breakpointDecorations = breakpoints.map(line => ({
        range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 },
        options: {
          isWholeLine: true,
          glyphMarginClassName: 'breakpoint',
          glyphMarginHoverMessage: { value: 'Breakpoint' },
        }
      }));
      
      let decorations: string[] = [];
      
      // Set breakpoints
      decorations = editorRef.current.deltaDecorations(decorations, breakpointDecorations);
      
      // Apply current line decoration if it exists
      if (currentLine) {
        const currentLineDecoration = [{
          range: { startLineNumber: currentLine, startColumn: 1, endLineNumber: currentLine, endColumn: 1 },
          options: {
            isWholeLine: true,
            className: 'current-line',
            glyphMarginClassName: 'current-line-marker',
          }
        }];
        editorRef.current.deltaDecorations([], currentLineDecoration);
      }
    }
  }, [isDebugging, breakpoints, currentLine]);

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    // Store editor instance for future use
    window.editor = editor;
    editorRef.current = editor;
    setMountedEditor(editor);

    // Add breakpoint decoration
    editor.onMouseDown((e: any) => {
      const target = e.target;
      if (target.type === 6) { // GUTTER_GLYPH_MARGIN
        const lineNumber = target.position.lineNumber;
        if (onBreakpointToggle) {
          onBreakpointToggle(lineNumber);
        }
      }
    });
  };

  return (
    <div className="relative h-full flex">
      <div className="flex-1 h-full">
        <Editor
          height="100%"
          defaultLanguage={getEditorLanguage()}
          language={getEditorLanguage()}
          // Collaborative mode: content comes from Yjs (uncontrolled editor); onChange still
          // reports the current text so Run uses what is on screen.
          value={fileId ? undefined : code}
          defaultValue={fileId ? "" : undefined}
          onChange={onCodeChange}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          options={{
            minimap: { enabled: isMinimapVisible },
            fontSize: 14,
            lineNumbers: "on",
            glyphMargin: true,
            folding: true,
            lineDecorationsWidth: 20,
            lineNumbersMinChars: 3,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            renderLineHighlight: isDebugging ? 'all' : 'none',
          }}
          onMount={handleEditorDidMount}
        />
      </div>
      {fileId && (
        <div
          data-testid="collab-status"
          data-status={collab.status}
          data-synced={collab.synced ? "true" : "false"}
          className="absolute right-16 top-4 z-10 rounded px-2 py-0.5 text-xs bg-black/40 text-white"
        >
          {collab.authError ? `Collab: ${collab.authError}` : collab.status === "connected" ? (collab.synced ? "Live · synced" : "Live · syncing") : `Collab: ${collab.status}`}
        </div>
      )}
      <div className="absolute right-4 top-4 flex flex-col space-y-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMinimapVisible(!isMinimapVisible)}
          className="bg-white/10 hover:bg-white/20"
        >
          {isMinimapVisible ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="bg-white/10 hover:bg-white/20"
        >
          {isFullscreen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      </div>
      <style>{`
        .breakpoint {
          background-color: ${theme === 'dark' ? '#ff4444' : '#ff0000'};
          border-radius: 50%;
          width: 8px;
          height: 8px;
          margin-top: 6px;
          margin-left: 4px;
        }
        .current-line {
          background-color: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
        }
        .yRemoteSelection {
          background-color: rgba(250, 129, 0, 0.35);
        }
        .yRemoteSelectionHead {
          position: absolute;
          border-left: 2px solid orange;
          height: 100%;
          box-sizing: border-box;
        }
        .current-line-marker {
          background-color: ${theme === 'dark' ? '#007acc' : '#007acc'};
          width: 2px;
          height: 100%;
          margin-left: 0;
        }
      `}</style>
    </div>
  );
};

export default EditorPanel;