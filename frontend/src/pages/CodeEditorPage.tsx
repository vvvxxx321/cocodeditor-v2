import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Sidebar } from "@/components/code-editor/Sidebar";
import { FileTabs } from "@/components/code-editor/FileTabs";
import EditorPanel from "@/components/code-editor/EditorPanel";
import OutputPanel from "@/components/code-editor/OutputPanel";
import { Header } from "@/components/code-editor/Header";
import { ProblemsPanel } from "@/components/code-editor/ProblemsPanel";
import ExplorerPanel from "@/components/code-editor/ExplorerPanel";
import { StatusBar } from "@/components/code-editor/StatusBar";
import { CommandPalette } from "@/components/code-editor/CommandPalette";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Terminal, Code2, Bug, GitBranch, Search, Settings, Bell, Share2, Command, Sun, Moon, Play, Maximize2, Minimize2, FileCode, Braces, AlertCircle, Clock } from "lucide-react";
import { useHotkeys } from "react-hotkeys-hook";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-context-provider";
import TerminalPanel from "@/components/code-editor/TerminalPanel";
import { EditorSidebar } from "@/components/code-editor/EditorSidebar";
import { useParams, useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChatPanel } from "@/components/code-editor/ChatPanel";
import socket, { pingSocket } from "@/config/socket";
import LanguageSelector, { SUPPORTED_LANGUAGES } from "@/components/code-editor/LanguageSelector";
import ExecutionHistory, { ExecutionResult } from "@/components/code-editor/ExecutionHistory";
import VersionHistoryPanel from "@/components/code-editor/VersionHistoryPanel";
import { runQueuedExecution } from "@/lib/executions";
import { v4 as uuidv4 } from 'uuid';

interface Project {
  id: string;
  name: string;
  description?: string;
  path?: string;
  teamId?: string;
}

interface TeamMember {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  status: "online" | "offline" | "idle";
}

interface Collaborator {
  id: string;
  name: string;
  status: "online" | "offline" | "busy";
  email?: string;
  avatar?: string;
  lastSeen?: string;
  username?: string;
}

const CodeEditorPage = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, session } = useAuth();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState("// Start coding...");
  const [fileContents, setFileContents] = useState<Map<string, string>>(new Map());
  // V2: file path -> database file id (the Yjs document is `file:<id>`)
  const [fileIds, setFileIds] = useState<Map<string, string>>(new Map());
  const [collaborators, setCollaborators] = useState<TeamMember[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState("file1.js");
  const [activeOutputTab, setActiveOutputTab] = useState("output");
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isProblemsOpen, setIsProblemsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: "New Pull Request",
      message: "New PR #123 has been opened",
      time: "2m ago",
    },
    {
      id: 2,
      title: "Build Failed",
      message: "Build failed in main branch",
      time: "5m ago",
    },
  ]);
  const [problems, setProblems] = useState([
    {
      type: "error" as const,
      message: "Variable 'x' is not defined",
      file: "file1.js",
      line: 5,
      column: 10,
    },
    {
      type: "warning" as const,
      message: "Unused variable 'y'",
      file: "file2.js",
      line: 3,
      column: 15,
    },
  ]);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilationOutput, setCompilationOutput] = useState<string>("");
  const [compilationError, setCompilationError] = useState<string>("");
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [memoryUsed, setMemoryUsed] = useState<number | null>(null);
  const [stdin, setStdin] = useState<string>("");
  const [terminalOutput, setTerminalOutput] = useState<string>("");
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [isDebugging, setIsDebugging] = useState(false);
  const [breakpoints, setBreakpoints] = useState<number[]>([]);
  const [currentLine, setCurrentLine] = useState<number | null>(null);
  const [terminalSessionId] = useState(() => Math.random().toString(36).substring(7));
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [currentDirectory, setCurrentDirectory] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [files, setFiles] = useState<string[]>(["file1.js", "file2.js"]);
  const [currentLanguage, setCurrentLanguage] = useState<string>("javascript");
  const [activeChatCollaborator, setActiveChatCollaborator] = useState<Collaborator | null>(null);
  const [executionHistory, setExecutionHistory] = useState<ExecutionResult[]>([]);
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);

  // Convert flat files array to a tree structure for the sidebar
  const fileTree = useMemo(() => {
    // Create a more structured tree by parsing paths
    const root: Record<string, any> = {};
    let nextId = 1;
    
    // First pass: build the tree structure
    files.forEach(filePath => {
      const parts = filePath.split('/');
      let current = root;
      let currentPath = '';
      
      // Process all directories in the path
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        if (!current[part]) {
          current[part] = { 
            children: {}, 
            id: `folder-${nextId++}`,
            type: 'folder',
            fullPath: currentPath
          };
        }
        current = current[part].children;
      }
      
      // Add the file at the end
      const fileName = parts[parts.length - 1];
      current[fileName] = { 
        id: `file-${nextId++}`,
        type: 'file',
        fullPath: filePath
      };
    });
    
    // Helper function to convert the nested object to the expected format
    const convertToFileItems = (obj: Record<string, any>, path: string = ''): any[] => {
      return Object.entries(obj).map(([key, value]) => {
        if (value.type === 'folder') {
          return {
            id: value.id,
            name: key,
            type: 'folder' as const,
            path: value.fullPath, // Store the full path for lookups
            children: convertToFileItems(value.children, value.fullPath)
          };
        } else {
          return {
            id: value.id,
            name: key,
            type: 'file' as const,
            icon: FileCode,
            path: value.fullPath
          };
        }
      });
    };
    
    // If no files, return empty array
    if (files.length === 0) {
      return [];
    }
    
    // Convert the nested object structure to the array format needed for the FileExplorer
    return convertToFileItems(root);
  }, [files]);

  // Load project data when projectId changes
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId || !session) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to load project');
        }
        
        const project = await response.json();
        setCurrentProject(project);
        
        // Log project loaded
        console.log('[PROJECT] Loaded project:', project.name);
        
        // Load team members if project has a teamId
        if (project.teamId) {
          loadTeamMembers(project.teamId);
        }
        
        // Force socket to reconnect if connected
        if (socket.connected && user) {
          console.log("[SOCKET] Re-joining project after project load:", projectId);
          socket.emit("joinProject", { projectId });
        }
        
      } catch (error) {
        console.error('Error loading project:', error);
        // Optionally navigate back to dashboard on error
        // navigate('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    const loadTeamMembers = async (teamId: string) => {
      try {
        const response = await fetch(`/api/teams/${teamId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
        });
        
        if (!response.ok) {
          throw new Error('Failed to load team members');
        }
        
        const team = await response.json();
        
        // Map team members to collaborator format
        const teamMembers = team.members.map((member: any) => ({
          id: member.profile.id,
          name: member.profile.username || member.profile.email?.split('@')[0] || 'User',
          email: member.profile.email,
          avatar: member.profile.avatar_url,
          // Default to offline, will be updated by socket
          status: "offline" as const
        }));
        
        console.log("Initial Team Members Loaded:", teamMembers);
        
        setCollaborators(teamMembers);
      } catch (error) {
        console.error('Error loading team members:', error);
      }
    };

    loadProject();
  }, [projectId, session, navigate, user]);
  
  // Socket.io setup for code editor and online status
  useEffect(() => {
    // Connection events
    const handleConnect = () => {
      console.log("[SOCKET] Connected to socket server");
      setIsConnected(true);
      
      // Authenticate and join project when connected
      if (user) {
        console.log("[SOCKET] Authenticating user on connect:", user.id);
        // Authenticate first (marks user as online)
        socket.emit("userAuthenticated");
        
        // Then join the specific project if we have one
        if (projectId) {
          console.log("[SOCKET] Joining project on connect:", projectId);
          socket.emit("joinProject", { projectId });
        }
      }
    };
    
    // Handle disconnection
    const handleDisconnect = () => {
      console.log("Disconnected from socket server");
      setIsConnected(false);
    };
    
    // Handle user status updates
    const handleUserUpdates = (users: { id: string; status: string }[]) => {
      console.log("Received users update:", users);
      
      // Track online users
      const onlineUserIds = users.filter(u => u.status === "online").map(u => u.id);
      setOnlineUsers(onlineUserIds);
      
      // Update collaborators status
      setCollaborators(prev => {
        // Create a status map from the server update
        const statusMap = new Map(users.map(user => [user.id, user.status]));
        
        // Update each collaborator's status
        return prev.map(collab => ({
          ...collab,
          status: statusMap.has(collab.id) 
            ? statusMap.get(collab.id) as "online" | "offline" | "idle"
            : "offline"
        }));
      });
    };
    
    // Handle project users update
    const handleProjectUsers = (users: { id: string; status: string }[]) => {
      console.log("Received project users update:", users);
      
      // Update online users in this project
      const onlineUserIds = users.filter(u => u.status === "online").map(u => u.id);
      setOnlineUsers(onlineUserIds);
    };
    
    // V2: remote edits arrive through Yjs (EditorPanel's collaborative binding), not "codeUpdate".

    // Handle single file created
    const handleFileCreated = (data: { id?: string, path: string, content: string }) => {
      console.log(`[FRONTEND] Received fileCreated event for: ${data.path}`, data);
      if (data.id) {
        setFileIds(prev => new Map(prev).set(data.path, data.id!));
      }
      
      // Add to files list if not present
      setFiles(prev => {
        if (!prev.includes(data.path)) {
          console.log(`[FRONTEND] Adding new file to list: ${data.path}`);
          return [...prev, data.path];
        }
        console.log(`[FRONTEND] File ${data.path} already in list, not adding`);
        return prev;
      });
      
      // Add to file contents
      setFileContents(prev => {
        const newMap = new Map(prev);
        newMap.set(data.path, data.content);
        console.log(`[FRONTEND] Added/updated content for file: ${data.path}`);
        return newMap;
      });
    };
    
    // Handle folder created
    const handleFolderCreated = (data: { path: string }) => {
      console.log(`[FRONTEND] Received folderCreated event for: ${data.path}`);
      
      // We don't need special handling here since filesUpdate will be sent
      // after folder creation with complete file list
    };
    
    // Handle file list updates
    const handleFilesUpdate = (data: { files: { id?: string, path: string, content: string }[] }) => {
      console.log(`[FRONTEND] Received filesUpdate with ${data.files.length} files`);
      
      // Skip empty file lists
      if (data.files.length === 0) {
        console.log("[FRONTEND] Received empty file list, ignoring");
        return;
      }
      
      data.files.forEach(file => {
        console.log(`[FRONTEND] - File from update: ${file.path}`);
      });
      
      // Update our file list
      const filePaths = data.files.map(f => f.path);
      setFiles(filePaths);
      setFileIds(new Map(data.files.filter(f => f.id).map(f => [f.path, f.id!] as [string, string])));
      
      // Update file contents
      const newFileContents = new Map<string, string>();
      data.files.forEach(file => {
        newFileContents.set(file.path, file.content);
      });
      setFileContents(newFileContents);
      
      // If active file is in the list, update it
      if (activeFile && newFileContents.has(activeFile)) {
        console.log(`[FRONTEND] Updating active file content: ${activeFile}`);
        setCode(newFileContents.get(activeFile) || "");
      } else if (filePaths.length > 0) {
        // Set the first file as active if current active file is not in the list
        const firstFile = filePaths[0];
        console.log(`[FRONTEND] Setting first file as active: ${firstFile}`);
        setActiveFile(firstFile);
        setCode(newFileContents.get(firstFile) || "");
      } else {
        console.log(`[FRONTEND] No active file updates needed. Active file: ${activeFile || 'none'}`);
      }
    };
    
    // Connect and set up event listeners
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("usersUpdate", handleUserUpdates);
    socket.on("projectUsers", handleProjectUsers);
    socket.on("fileCreated", handleFileCreated);
    socket.on("folderCreated", handleFolderCreated);
    socket.on("filesUpdate", handleFilesUpdate);
    
    // If already connected, authenticate and join project
    if (socket.connected && user && projectId) {
      console.log("[SOCKET] Socket already connected, authenticating and joining project");
      socket.emit("userAuthenticated");
      socket.emit("joinProject", { projectId });
    } else if (!socket.connected && session) {
      // V2: socket is created with autoConnect=false; connect once a session exists.
      socket.connect();
    }
    
    // Clean up event listeners
    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("usersUpdate", handleUserUpdates);
      socket.off("projectUsers", handleProjectUsers);
      socket.off("fileCreated", handleFileCreated);
      socket.off("folderCreated", handleFolderCreated);
      socket.off("filesUpdate", handleFilesUpdate);
    };
  }, [socket, user, session, projectId, activeFile]);
  
  // Add a connection validation check
  useEffect(() => {
    // Skip if no project ID or user
    if (!projectId || !user) return;
    
    // Check connection immediately
    if (socket.connected) {
      console.log("[CONNECTION] Socket already connected on mount");
      // Make sure we're properly joined to the project
      socket.emit("joinProject", { projectId });
    } else {
      console.log("[CONNECTION] Socket not connected on mount, waiting for connection");
    }
    
    // Check connection periodically
    const interval = setInterval(() => {
      // Use the pingSocket function from socket.ts
      const isConnected = pingSocket();
      
      // If connected but not showing files, force rejoin project
      if (isConnected && files.length === 0) {
        console.log("[CONNECTION] Connected but no files loaded, rejoining project");
        socket.emit("joinProject", { projectId });
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [projectId, user, files.length]);
  
  useHotkeys("cmd+k,ctrl+k", (e: KeyboardEvent) => {
    e.preventDefault();
    setIsCommandPaletteOpen(true);
  });

  const handleCodeChange = (value: string | undefined) => {
    const updatedCode = value || "";
    setCode(updatedCode);
    
    // Save the code to the file contents map
    setFileContents(prev => {
      const newMap = new Map(prev);
      newMap.set(activeFile, updatedCode);
      return newMap;
    });
    
    // V2: no "codeChange" emit. The collaborative binding sends CRDT updates to Hocuspocus,
    // which persists the document; this handler only mirrors the text for Run/history.
  };

  const handleFileSelect = (fileId: string) => {
    // Find the file in the tree by its ID
    const findFileById = (items: any[]): string | null => {
      for (const item of items) {
        if (item.id === fileId) {
          return item.path || item.name;
        }
        if (item.children) {
          const result = findFileById(item.children);
          if (result) return result;
        }
      }
      return null;
    };
    
    const filePath = findFileById(fileTree);
    if (filePath) {
      // First save the current file content
      setFileContents(prev => {
        const newMap = new Map(prev);
        newMap.set(activeFile, code);
        return newMap;
      });
      
      // Then set the new active file
      setActiveFile(filePath);
      
      // Load the content for the new file
      const fileContent = fileContents.get(filePath);
      if (fileContent !== undefined) {
        setCode(fileContent);
      } else {
        // If this is a new file, set default content
        setCode("// Start coding...");
        // Add it to the map
        setFileContents(prev => {
          const newMap = new Map(prev);
          newMap.set(filePath, "// Start coding...");
          return newMap;
        });
      }
    }
  };

  const handleDirectorySelect = (folderId: string) => {
    // Special case for root directory
    if (folderId === "root") {
      setCurrentDirectory("");
      return;
    }
    
    // Find the folder by its ID
    const findFolderById = (items: any[]): string | null => {
      for (const item of items) {
        if (item.id === folderId && item.type === 'folder') {
          return item.path || item.name;
        }
        if (item.children) {
          const result = findFolderById(item.children);
          if (result) return result;
        }
      }
      return null;
    };
    
    const folderPath = findFolderById(fileTree);
    if (folderPath) {
      setCurrentDirectory(folderPath);
      console.log("Selected directory:", folderPath);
    }
  };

  const createNewFile = (filename: string) => {
    if (!filename) return;
    
    // Add path context if we're in a directory
    let fullPath = filename;
    if (currentDirectory && !filename.includes('/')) {
      fullPath = `${currentDirectory}/${filename}`;
    }
    
    console.log(`[FRONTEND] Creating new file: ${fullPath}, in directory: ${currentDirectory || 'root'}`);
    
    // Check if file already exists
    if (files.includes(fullPath)) {
      console.log(`[FRONTEND] File ${fullPath} already exists, aborting creation`);
      alert(`File ${fullPath} already exists`);
      return;
    }
    
    // Create any required directories
    const dirPath = fullPath.split('/').slice(0, -1).join('/');
    if (dirPath && !files.some(f => f.startsWith(dirPath + '/'))) {
      // We need to ensure the directory exists in our files list
      console.log(`[FRONTEND] Creating directory: ${dirPath}`);
    }
    
    // Save current file content before switching
    if (activeFile) {
      console.log(`[FRONTEND] Saving current file ${activeFile} before switching`);
      setFileContents(prev => {
        const newMap = new Map(prev);
        newMap.set(activeFile, code);
        return newMap;
      });
    }
    
    // Add new file to files list
    setFiles(prev => {
      console.log(`[FRONTEND] Adding ${fullPath} to files list`);
      return [...prev, fullPath];
    });
    
    // Set default content for the new file
    const defaultContent = `// Start coding in ${fullPath}...`;
    setFileContents(prev => {
      const newMap = new Map(prev);
      newMap.set(fullPath, defaultContent);
      console.log(`[FRONTEND] Set default content for ${fullPath}`);
      return newMap;
    });
    
    // Set it as the active file
    console.log(`[FRONTEND] Setting ${fullPath} as active file`);
    setActiveFile(fullPath);
    
    // Set the editor to display the new file's content
    setCode(defaultContent);
    
    // Send to backend via socket
    if (projectId && socket.connected) {
      console.log(`[FRONTEND] Emitting createFile event to socket server:`, { 
        projectId, 
        filename: fullPath, 
        content: defaultContent 
      });
      
      socket.emit("createFile", { 
        projectId, 
        filename: fullPath, 
        content: defaultContent 
      });
    } else {
      console.error(`[FRONTEND] Cannot emit createFile - socket disconnected or missing projectId`);
      if (!socket.connected) console.error("Socket is not connected");
      if (!projectId) console.error("Project ID is missing");
    }
  };

  const createFolder = (folderName: string) => {
    if (!folderName) return;
    
    // Add path context if we're in a directory
    let fullPath = folderName;
    if (currentDirectory && !folderName.includes('/')) {
      fullPath = `${currentDirectory}/${folderName}`;
    }
    
    // Ensure the path ends with a slash to mark it as a directory
    if (!fullPath.endsWith('/')) {
      fullPath += '/';
    }
    
    // Check if folder already exists
    if (files.some(f => f.startsWith(fullPath) || f === fullPath.slice(0, -1))) {
      alert(`Folder ${fullPath} already exists`);
      return;
    }
    
    // Create a placeholder file to represent the folder
    // This ensures the folder shows up in our file tree
    const placeholderFile = `${fullPath}.gitkeep`;
    setFiles(prev => [...prev, placeholderFile]);
    
    // Send to backend via socket
    if (projectId && socket.connected) {
      console.log("Emitting createFolder event:", { projectId, folderName: fullPath });
      socket.emit("createFolder", { 
        projectId, 
        folderName: fullPath 
      });
    }
  };

  const handleCommand = (command: string, params?: any) => {
    switch (command) {
      case "newFile":
        // Show prompt for file name
        const filename = prompt("Enter file name:", "newfile.js");
        if (filename) {
          createNewFile(filename);
        }
        break;
      case "newFolder":
        // Handle new folder creation
        const folderName = prompt("Enter folder name:", "newfolder");
        if (folderName) {
          createFolder(folderName);
        }
        break;
      case "save":
        // Handle save
        break;
      case "gitBranch":
        // Handle git branch checkout
        break;
      case "share":
        // Handle sharing
        break;
      case "settings":
        // Handle settings
        break;
    }
    setIsCommandPaletteOpen(false);
  };

  const handleNotificationClick = () => {
    // Toggle notifications panel
    setIsNotificationsOpen(!isNotificationsOpen);
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(true);
  };

  const handleShareClick = () => {
    setIsShareOpen(true);
  };

  const handleTerminalClick = () => {
    setIsTerminalOpen(!isTerminalOpen);
  };

  const handleProblemsClick = () => {
    setIsProblemsOpen(!isProblemsOpen);
    setActiveOutputTab("problems");
  };

  const handleCompile = async () => {
    setIsCompiling(true);
    setCompilationError("");
    setCompilationOutput("");
    setExecutionTime(null);
    setMemoryUsed(null);
    
    try {
      // Get file extension to determine language
      const fileExt = activeFile.split('.').pop()?.toLowerCase();
      
      // Set up language-specific compilation parameters
      const language = fileExt === 'py' ? 'python' : 
                   fileExt === 'js' ? 'javascript' : 
                   fileExt === 'ts' ? 'typescript' : 
                   fileExt === 'c' ? 'c' :
                   (fileExt === 'cpp' || fileExt === 'cc' || fileExt === 'cxx' || fileExt === 'h' || fileExt === 'hpp') ? 'cpp' :
                   fileExt === 'java' ? 'java' :
                   'unknown';
      
      // Update current language
      setCurrentLanguage(language);
      
      // Log the compilation attempt
      console.log(`Executing ${activeFile} as ${language}`);
      
      // Return early with error if language is unsupported
      if (language === 'unknown') {
        setCompilationError(`Unsupported file type: .${fileExt}`);
        setActiveOutputTab("problems");
        setIsCompiling(false);
        return;
      }
      
      // V2: queued execution (API -> BullMQ -> worker -> Judge0) with polling for the result.
      if (!projectId) {
        throw new Error('Open a project to run code');
      }
      const { ok, data } = await runQueuedExecution({
        projectId,
        fileId: fileIds.get(activeFile),
        language,
        code,
        stdin,
        accessToken: session?.access_token,
      });
      const response = { ok };

      // Create a new execution history entry
      const executionId = uuidv4();
      
      if (response.ok) {
        // Set execution stats from Judge0 API
        setExecutionTime(data.execution_time);
        setMemoryUsed(data.memory);
        
        // Handle Judge0 API successful response
        if (data.error) {
          // If Judge0 returned an error
          setCompilationError(data.error);
          setActiveOutputTab("problems");
          
          // Add to history
          const historyEntry: ExecutionResult = {
            id: executionId,
            timestamp: new Date(),
            language,
            status: 'error',
            executionTime: data.execution_time,
            memoryUsed: data.memory,
            output: '',
            error: data.error,
            code
          };
          setExecutionHistory(prev => [historyEntry, ...prev.slice(0, 9)]);
          setActiveExecutionId(executionId);
        } else {
          // Check output sources in order of priority
          const output = data.stdout || data.compile_output || '';
          setCompilationOutput(output);
          
          // Also show stderr if available and stdout doesn't have content
          if (!output && data.stderr) {
            setCompilationOutput(data.stderr);
          }
          
          setActiveOutputTab("output");
          
          // If there was a runtime error but no compile error
          if (data.stderr && !data.compile_output) {
            setCompilationError(data.stderr);
            
            // Add to history as error
            const historyEntry: ExecutionResult = {
              id: executionId,
              timestamp: new Date(),
              language,
              status: 'error',
              executionTime: data.execution_time,
              memoryUsed: data.memory,
              output: output,
              error: data.stderr,
              code
            };
            setExecutionHistory(prev => [historyEntry, ...prev.slice(0, 9)]);
            setActiveExecutionId(executionId);
          } else {
            // Add to history as success
            const historyEntry: ExecutionResult = {
              id: executionId,
              timestamp: new Date(),
              language,
              status: 'success',
              executionTime: data.execution_time,
              memoryUsed: data.memory,
              output: output,
              error: null,
              code
            };
            setExecutionHistory(prev => [historyEntry, ...prev.slice(0, 9)]);
            setActiveExecutionId(executionId);
          }
        }
      } else {
        setCompilationError(data.error || "Execution failed");
        setActiveOutputTab("problems");
        
        // Add to history
        const historyEntry: ExecutionResult = {
          id: executionId,
          timestamp: new Date(),
          language,
          status: 'error',
          executionTime: null,
          memoryUsed: null,
          output: '',
          error: data.error || "Execution failed",
          code
        };
        setExecutionHistory(prev => [historyEntry, ...prev.slice(0, 9)]);
        setActiveExecutionId(executionId);
      }
    } catch (error) {
      setCompilationError("Failed to execute: " + (error as Error).message);
      setActiveOutputTab("problems");
      
      // Add to history
      const executionId = uuidv4();
      const historyEntry: ExecutionResult = {
        id: executionId,
        timestamp: new Date(),
        language: currentLanguage,
        status: 'error',
        executionTime: null,
        memoryUsed: null,
        output: '',
        error: "Failed to execute: " + (error as Error).message,
        code
      };
      setExecutionHistory(prev => [historyEntry, ...prev.slice(0, 9)]);
      setActiveExecutionId(executionId);
    } finally {
      setIsCompiling(false);
    }
  };

  const handleTerminalCommand = async (command: string) => {
    try {
      const response = await fetch('http://localhost:3000/api/terminal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command }),
      });

      const data = await response.json();
      setTerminalOutput(prev => prev + `\n$ ${command}\n${data.output}`);
    } catch (error) {
      setTerminalOutput(prev => prev + `\n$ ${command}\nError: ${(error as Error).message}`);
    }
  };

  const handleDebug = () => {
    setIsDebugging(!isDebugging);
    if (!isDebugging) {
      // Start debugging session
      socket.emit('startDebug', { file: activeFile, breakpoints });
    } else {
      // Stop debugging session
      socket.emit('stopDebug');
    }
  };

  const handleStepOver = () => {
    socket.emit('stepOver');
  };

  const handleStepInto = () => {
    socket.emit('stepInto');
  };

  const handleStepOut = () => {
    socket.emit('stepOut');
  };

  const handleContinue = () => {
    socket.emit('continue');
  };

  // Get the language from the file extension
  const getLanguageFromFile = (filename: string): { name: string, icon: React.ReactNode } => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    
    // Find the language that matches this extension
    const language = SUPPORTED_LANGUAGES.find(lang => 
      lang.fileExtensions.includes(ext)
    );
    
    if (language) {
      return {
        name: language.displayName,
        icon: language.icon
      };
    }
    
    // Fallback for unknown extensions
    return { 
      name: 'Unknown', 
      icon: <FileCode className="h-4 w-4" /> 
    };
  };

  // Also update whenever the active file changes
  useEffect(() => {
    // Update language when active file changes
    const fileExt = activeFile.split('.').pop()?.toLowerCase();
    const language = fileExt === 'py' ? 'python' : 
                  fileExt === 'js' ? 'javascript' : 
                  fileExt === 'ts' ? 'typescript' : 
                  fileExt === 'c' ? 'c' :
                  (fileExt === 'cpp' || fileExt === 'cc' || fileExt === 'cxx' || fileExt === 'h' || fileExt === 'hpp') ? 'cpp' :
                  fileExt === 'java' ? 'java' :
                  'unknown';
    setCurrentLanguage(language);
  }, [activeFile]);

  const handleStartChat = (collaborator: Collaborator) => {
    setActiveChatCollaborator(collaborator);
  };

  const handleCloseChat = () => {
    setActiveChatCollaborator(null);
  };

  // Add function to handle selecting an execution from history
  const handleSelectExecution = (execution: ExecutionResult) => {
    setActiveExecutionId(execution.id);
    setCompilationOutput(execution.output);
    setCompilationError(execution.error || '');
    setExecutionTime(execution.executionTime);
    setMemoryUsed(execution.memoryUsed);
    
    // Update active tab based on execution status
    if (execution.status === 'error') {
      setActiveOutputTab("problems");
    } else {
      setActiveOutputTab("output");
    }
  };

  // Add function to rerun an execution from history
  const handleRerunExecution = (code: string) => {
    // Set the code editor content to the selected execution
    setCode(code);
    
    // Then run the compilation
    handleCompile();
  };

  // --- ADD RENDER LOG --- 
  console.log(`[CodeEditorPage RENDER] Timestamp: ${Date.now()}`);
  console.log(" - activeFile:", activeFile);
  // Avoid logging large objects directly in loops
  // console.log(" - collaborators:", collaborators); 
  console.log(" - collaborators count:", collaborators.length);
  console.log(" - onlineUsers count:", onlineUsers.length);
  console.log(" - activeChatCollaborator ID:", activeChatCollaborator?.id);
  console.log(" - fileContents size:", fileContents.size); 
  // console.log(" - code:", code); // Avoid logging potentially long code
  console.log(" - code length:", code?.length); 
  // --- END RENDER LOG ---

  return (
    <div className={`flex h-screen ${theme === 'dark' ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : 'bg-gradient-to-br from-gray-50 via-white to-gray-50'}`}>
      {/* Command Palette */}
      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
        onCommand={handleCommand}
      />

      {/* Conditionally Render Sidebar based on loading state */}
      {isLoading ? (
        <div className="w-64 p-4 text-muted-foreground">Loading Collaborators...</div> // Placeholder
      ) : (
        <EditorSidebar 
          collaborators={collaborators.map(member => ({ 
            id: member.id,
            name: member.name,
            status: member.status === "idle" ? "busy" : member.status as "online" | "offline" | "busy",
            email: member.email,
            avatar: member.avatar,
          }))}
          onStartChat={handleStartChat}
          currentUserId={user?.id || ""} // Use default value
          projectName={currentProject?.name}
          onCreateFile={createNewFile}
          onCreateFolder={createFolder}
          onFileSelect={handleFileSelect}
          onFolderSelect={handleDirectorySelect}
          projectFiles={fileTree}
          currentDirectory={currentDirectory}
        />
      )}

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={`${theme === 'dark' ? 'bg-gray-800/40' : 'bg-white/80'} backdrop-blur-sm border-b ${theme === 'dark' ? 'border-gray-700/30' : 'border-gray-200/50'}`}>
          <div className="flex items-center justify-between px-4">
            <Header projectName={currentProject?.name || "Loading Project..."} />
            <div className="flex items-center space-x-3">
              <LanguageSelector 
                currentLanguage={currentLanguage}
                onLanguageChange={(lang) => setCurrentLanguage(lang)}
              />
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleCompile}
                      disabled={isCompiling}
                      className={`${isCompiling ? 'opacity-70' : ''} flex items-center gap-2`}
                    >
                      {isCompiling ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full"></div>
                          <span>Running...</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          <span>Run</span>
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Run {getLanguageFromFile(activeFile).name}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className={`${theme === 'dark' ? 'hover:bg-gray-700/50 hover:text-yellow-400' : 'hover:bg-gray-100/80 hover:text-gray-700'}`}
              >
                {theme === 'dark' ? (
                  <Sun className="h-5 w-5 text-yellow-400" />
                ) : (
                  <Moon className="h-5 w-5 text-gray-600" />
                )}
              </Button>
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className={`${theme === 'dark' ? 'bg-gray-800/30' : 'bg-white/60'} backdrop-blur-sm border-b ${theme === 'dark' ? 'border-gray-700/30' : 'border-gray-200/50'}`}>
            <FileTabs
              files={files}
              activeFile={activeFile}
              onFileChange={(file) => {
                // Save current file content before switching
                setFileContents(prev => {
                  const newMap = new Map(prev);
                  newMap.set(activeFile, code);
                  return newMap;
                });
                
                // Set the new active file
                setActiveFile(file);
                
                // Load the content for the selected file
                const fileContent = fileContents.get(file);
                if (fileContent !== undefined) {
                  setCode(fileContent);
                } else {
                  // If this is a new file with no content yet, set default content
                  const defaultContent = `// Start coding in ${file}...`;
                  setCode(defaultContent);
                  setFileContents(prev => {
                    const newMap = new Map(prev);
                    newMap.set(file, defaultContent);
                    return newMap;
                  });
                }
              }}
              onNewFile={() => {
                const filename = prompt("Enter file name:", "newfile.js");
                if (filename) {
                  createNewFile(filename);
                }
              }}
            />
          </div>
          <ResizablePanelGroup direction="vertical" className="flex-1">
            <ResizablePanel defaultSize={isTerminalMaximized ? 0 : 70}>
              <ResizablePanelGroup direction="horizontal" className="flex-1 p-2">
                {/* Code Editor Panel */}
                <ResizablePanel defaultSize={70}>
                  <div className={`h-full ${theme === 'dark' ? 'bg-gray-900/40' : 'bg-white/90'} backdrop-blur-sm rounded-lg shadow-lg overflow-hidden border ${theme === 'dark' ? 'border-gray-700/30' : 'border-gray-200/50'}`}>
                    <EditorPanel 
                      code={code} 
                      onCodeChange={handleCodeChange}
                      isDebugging={isDebugging}
                      breakpoints={breakpoints}
                      currentLine={currentLine}
                      onBreakpointToggle={(line) => {
                        setBreakpoints(prev => 
                          prev.includes(line) 
                            ? prev.filter(l => l !== line)
                            : [...prev, line]
                        );
                      }}
                      filename={activeFile}
                      language={currentLanguage}
                      fileId={fileIds.get(activeFile)}
                      collabUser={user ? { id: user.id, name: user.email?.split('@')[0] } : null}
                    />
                  </div>
                </ResizablePanel>

                {/* Output/Preview Panel */}
                <ResizablePanel defaultSize={30}>
                  <div className={`h-full ${theme === 'dark' ? 'bg-gray-900/40' : 'bg-white/90'} backdrop-blur-sm rounded-lg shadow-lg overflow-hidden border ${theme === 'dark' ? 'border-gray-700/30' : 'border-gray-200/50'}`}>
                    <Tabs value={activeOutputTab} onValueChange={setActiveOutputTab} className="h-full">
                      <div className={`border-b ${theme === 'dark' ? 'border-gray-700/30' : 'border-gray-200/50'} px-4`}>
                        <TabsList className="flex justify-start space-x-1">
                          <TabsTrigger value="output" className="flex items-center space-x-2">
                            <Terminal className="h-4 w-4" />
                            <span>Output</span>
                          </TabsTrigger>
                          <TabsTrigger value="problems" className="flex items-center space-x-2">
                            <AlertCircle className="h-4 w-4" />
                            <span>Problems</span>
                          </TabsTrigger>
                          <TabsTrigger value="explorer" className="flex items-center space-x-2">
                            <Code2 className="h-4 w-4" />
                            <span>Explorer</span>
                          </TabsTrigger>
                          <TabsTrigger value="history" className="flex items-center space-x-2">
                            <Clock className="h-4 w-4" />
                            <span>History</span>
                          </TabsTrigger>
                          <TabsTrigger value="versions" className="flex items-center space-x-2" data-testid="versions-tab">
                            <GitBranch className="h-4 w-4" />
                            <span>Versions</span>
                          </TabsTrigger>
                        </TabsList>
                      </div>
                      <ScrollArea className="h-[calc(100%-3rem)]">
                        <TabsContent value="output" className="h-full p-4">
                          <OutputPanel 
                            output={compilationOutput} 
                            isCompiling={isCompiling}
                            language={currentLanguage}
                            error={compilationError}
                            executionTime={executionTime}
                            memoryUsed={memoryUsed}
                            stdin={stdin}
                            onStdinChange={(value) => setStdin(value)}
                            onRun={handleCompile}
                          />
                        </TabsContent>
                        <TabsContent value="problems" className="h-full p-4">
                          <ProblemsPanel 
                            problems={[
                              ...problems,
                              ...(compilationError ? [{
                                type: "error" as const,
                                message: compilationError,
                                file: activeFile,
                                line: 0,
                                column: 0,
                              }] : [])
                            ]} 
                          />
                        </TabsContent>
                        <TabsContent value="explorer" className="h-full p-4">
                          <ExplorerPanel 
                            onFileSelect={handleFileSelect} 
                            onDirectorySelect={handleDirectorySelect}
                          />
                        </TabsContent>
                        <TabsContent value="history" className="h-full p-4">
                          <ExecutionHistory 
                            history={executionHistory}
                            onSelectExecution={handleSelectExecution}
                            onRerunExecution={handleRerunExecution}
                            activeExecutionId={activeExecutionId}
                          />
                        </TabsContent>
                        <TabsContent value="versions" className="h-full p-4">
                          <VersionHistoryPanel
                            fileId={fileIds.get(activeFile)}
                            fileName={activeFile}
                            accessToken={session?.access_token}
                          />
                        </TabsContent>
                      </ScrollArea>
                    </Tabs>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>

            {/* Terminal Panel */}
            <ResizableHandle className={`${theme === 'dark' ? 'bg-gray-700/30 hover:bg-blue-500/30' : 'bg-gray-200/50 hover:bg-blue-200/50'} transition-colors`} />
            <ResizablePanel defaultSize={isTerminalMaximized ? 100 : 30}>
              <div className={`h-full ${theme === 'dark' ? 'bg-gray-900/40' : 'bg-white/90'} backdrop-blur-sm rounded-lg shadow-lg overflow-hidden border ${theme === 'dark' ? 'border-gray-700/30' : 'border-gray-200/50'}`}>
                <div className="flex items-center justify-between p-2 border-b border-gray-700/30">
                  <div className="flex items-center space-x-2">
                    <Terminal className="h-4 w-4" />
                    <span>Terminal</span>
                  </div>
                  {isTerminalMaximized ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsTerminalMaximized(false)}
                      className="h-6 w-6"
                    >
                      <Minimize2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsTerminalMaximized(true)}
                      className="h-6 w-6"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {isTerminalMaximized ? (
                  <div className="fixed inset-0 z-50 bg-background">
                    <div className="flex flex-col h-full">
                      <div className="flex items-center justify-between p-2 border-b">
                        <span className="text-sm font-medium">Terminal</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsTerminalMaximized(false)}
                        >
                          <Minimize2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <TerminalPanel
                        theme={theme}
                        sessionId={terminalSessionId}
                        projectPath={currentDirectory || currentProject?.path}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="h-48 border-t">
                    <div className="flex items-center justify-between p-2 border-b">
                      <span className="text-sm font-medium">Terminal</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsTerminalMaximized(true)}
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <TerminalPanel
                      theme={theme}
                      sessionId={terminalSessionId}
                      projectPath={currentDirectory || currentProject?.path}
                    />
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Debug Controls */}
        {isDebugging && (
          <div className={`flex items-center space-x-2 p-2 border-t ${theme === 'dark' ? 'border-gray-700/30' : 'border-gray-200/50'}`}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStepOver}
              className="h-8"
            >
              Step Over
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStepInto}
              className="h-8"
            >
              Step Into
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStepOut}
              className="h-8"
            >
              Step Out
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleContinue}
              className="h-8"
            >
              Continue
            </Button>
          </div>
        )}

        <div className={`${theme === 'dark' ? 'bg-gray-800/40' : 'bg-white/80'} backdrop-blur-sm border-t ${theme === 'dark' ? 'border-gray-700/30' : 'border-gray-200/50'}`}>
          <StatusBar
            isConnected={isConnected}
            branch="main"
            commit="abc1234"
            pullRequests={2}
            language={currentLanguage}
            onNotificationClick={handleNotificationClick}
            onSettingsClick={handleSettingsClick}
            onShareClick={handleShareClick}
            onTerminalClick={handleTerminalClick}
            onProblemsClick={handleProblemsClick}
          />
        </div>
      </div>

      {/* Conditionally Render Chat Panel */}
      {activeChatCollaborator && socket && user && (
        <div className="w-80 flex-shrink-0">
          <ChatPanel
            key={activeChatCollaborator.id}
            collaborator={activeChatCollaborator}
            onClose={handleCloseChat}
            currentUserId={user.id}
          />
        </div>
      )}
    </div>
  );
};

export default CodeEditorPage;