import React from "react";
import { ChevronRight, ChevronDown, File, Folder, MoreVertical, Plus, Trash2, FileEdit, FolderPlus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

interface FileItem {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileItem[];
}

interface ExplorerPanelProps {
  onFileSelect: (file: string) => void;
  onDirectorySelect: (path: string) => void;
}

const ExplorerPanel: React.FC<ExplorerPanelProps> = ({ onFileSelect, onDirectorySelect }) => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = React.useState<string | null>(null);
  const [editingNode, setEditingNode] = React.useState<{ path: string; name: string } | null>(null);
  const [newNodeName, setNewNodeName] = React.useState("");

  // Example file tree - replace with your actual file tree
  const fileTree: FileItem[] = [
    {
      name: 'src',
      type: 'folder',
      path: 'src',
      children: [
        { name: 'App.tsx', type: 'file', path: 'src/App.tsx' },
        { name: 'index.tsx', type: 'file', path: 'src/index.tsx' },
      ],
    },
    {
      name: 'public',
      type: 'folder',
      path: 'public',
      children: [
        { name: 'index.html', type: 'file', path: 'public/index.html' },
      ],
    },
  ];

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const handleItemClick = (item: FileItem) => {
    setSelectedItem(item.path);
    if (item.type === 'file') {
      onFileSelect(item.path);
    } else {
      onDirectorySelect(item.path);
      toggleFolder(item.path);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, node: FileItem, path: string) => {
    e.preventDefault();
    setEditingNode({ path, name: node.name });
    setNewNodeName(node.name);
  };

  const handleRename = (path: string) => {
    // Implement rename logic here
    setEditingNode(null);
  };

  const handleCreateNew = (type: "file" | "folder", parentPath: string) => {
    // Implement create new logic here
  };

  const handleDelete = (path: string) => {
    // Implement delete logic here
  };

  const renderFileItem = (item: FileItem, level: number = 0) => {
    const isExpanded = expandedFolders.has(item.path);
    const isSelected = selectedItem === item.path;
    const isFolder = item.type === 'folder';
    const isEditing = editingNode?.path === item.path;
    const isVisible = searchQuery === "" || item.name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!isVisible) return null;

    return (
      <div key={item.path}>
        <div
          className={`flex items-center py-1 px-2 cursor-pointer hover:bg-opacity-10 hover:bg-gray-500 ${
            isSelected ? 'bg-opacity-20 bg-gray-500' : ''
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => handleItemClick(item)}
          onContextMenu={(e) => handleContextMenu(e, item, item.path)}
        >
          {isFolder ? (
            <>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 mr-2" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-2" />
              )}
              <Folder className="h-4 w-4 mr-2" />
            </>
          ) : (
            <File className="h-4 w-4 mr-2" />
          )}
          <div className="flex items-center flex-1 min-w-0">
            {isEditing ? (
              <Input
                value={newNodeName}
                onChange={(e) => setNewNodeName(e.target.value)}
                onBlur={() => handleRename(item.path)}
                onKeyDown={(e) => e.key === "Enter" && handleRename(item.path)}
                className={`h-6 text-sm ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700/50 text-gray-300' : 'bg-white/50 border-gray-200/50 text-gray-900'} focus:ring-blue-500/50`}
                autoFocus
              />
            ) : (
              <span className={`truncate ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{item.name}</span>
            )}
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`h-6 w-6 ${theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-200/50'}`}
                >
                  <MoreVertical className={`h-4 w-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className={`${theme === 'dark' ? 'bg-gray-800/95 border-gray-700/50' : 'bg-white/95 border-gray-200/50'} backdrop-blur-sm`}
              >
                {isFolder && (
                  <>
                    <DropdownMenuItem 
                      onClick={() => handleCreateNew("file", item.path)}
                      className={`${theme === 'dark' ? 'text-gray-300 hover:bg-gray-700/50 hover:text-white' : 'text-gray-700 hover:bg-gray-100/50 hover:text-gray-900'}`}
                    >
                      <File className={`h-4 w-4 mr-2 ${theme === 'dark' ? 'text-blue-500/80' : 'text-blue-600'}`} />
                      New File
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleCreateNew("folder", item.path)}
                      className={`${theme === 'dark' ? 'text-gray-300 hover:bg-gray-700/50 hover:text-white' : 'text-gray-700 hover:bg-gray-100/50 hover:text-gray-900'}`}
                    >
                      <Folder className={`h-4 w-4 mr-2 ${theme === 'dark' ? 'text-yellow-500/80' : 'text-yellow-600'}`} />
                      New Folder
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem 
                  onClick={() => setEditingNode({ path: item.path, name: item.name })}
                  className={`${theme === 'dark' ? 'text-gray-300 hover:bg-gray-700/50 hover:text-white' : 'text-gray-700 hover:bg-gray-100/50 hover:text-gray-900'}`}
                >
                  <FileEdit className={`h-4 w-4 mr-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleDelete(item.path)} 
                  className={`${theme === 'dark' ? 'text-red-400 hover:bg-red-500/20 hover:text-red-300' : 'text-red-600 hover:bg-red-100/50 hover:text-red-700'}`}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {isFolder && isExpanded && item.children && (
          <div>
            {item.children.map(child => renderFileItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className={`p-2 border-b ${theme === 'dark' ? 'border-gray-700/50' : 'border-gray-200/50'}`}>
        <div className="relative">
          <Search className={`absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`pl-8 ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700/50 text-gray-300 placeholder:text-gray-500' : 'bg-white/50 border-gray-200/50 text-gray-900 placeholder:text-gray-400'} focus:ring-blue-500/50`}
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {fileTree.map(item => renderFileItem(item))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ExplorerPanel; 