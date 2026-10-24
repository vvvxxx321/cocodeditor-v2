import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface TerminalPanelProps {
  theme: 'light' | 'dark';
  sessionId: string;
  projectPath?: string;
}

/**
 * V2: the V1 terminal opened an unauthenticated Socket.IO connection that spawned `bash`
 * on the API host for every client (remote code execution). It is disabled; code runs
 * only through the sandboxed Judge0 execution pipeline (Run button).
 */
const TerminalPanel: React.FC<TerminalPanelProps> = ({ theme, sessionId }) => {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!terminalRef.current) return;
    const terminal = new Terminal({
      disableStdin: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: theme === 'dark' ? '#1e1e1e' : '#ffffff',
        foreground: theme === 'dark' ? '#d4d4d4' : '#000000',
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);
    fitAddon.fit();
    terminal.write('Terminal is disabled in V2: host-side shell access was removed for security.\r\n');
    terminal.write('Use the Run button to execute code in the Judge0 sandbox.\r\n');

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
    };
  }, [theme, sessionId]);

  return (
    <div className="h-full">
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  );
};

export default TerminalPanel;
