import React, { useState } from "react";
import { CollaboratorsSidebar, Collaborator } from "./CollaboratorsSidebar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { ChatPanel } from "./ChatPanel";

interface FileNode {
  type: "folder" | "file";
  name: string;
  children?: FileNode[];
}

interface SidebarProps {
  fileTree: FileNode[];
  collaborators: Collaborator[];
  currentUserId: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  fileTree,
  collaborators,
  currentUserId,
}) => {
  const [activeTab, setActiveTab] = useState("files");
  const [activeChat, setActiveChat] = useState<Collaborator | null>(null);
  const { theme } = useTheme();

  const renderFileTree = (node: FileNode) => {
    if (node.type === "folder") {
      return (
        <Collapsible key={node.name}>
          <CollapsibleTrigger className={`font-bold cursor-pointer ${theme === 'dark' ? 'text-gray-300 hover:text-gray-100' : 'text-gray-900 hover:text-gray-700'}`}>
            {node.name}
          </CollapsibleTrigger>
          <CollapsibleContent className="ml-4">
            {node.children?.map((child) => renderFileTree(child))}
          </CollapsibleContent>
        </Collapsible>
      );
    } else {
      return (
        <div 
          key={node.name} 
          className={`cursor-pointer ${theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-700 hover:text-blue-600'}`}
        >
          {node.name}
        </div>
      );
    }
  };

  const handleStartChat = (collaborator: Collaborator) => {
    setActiveChat(collaborator);
  };

  const handleCloseChat = () => {
    setActiveChat(null);
  };

  return (
    <div className="flex h-full">
      <div className={`w-64 ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700/30' : 'bg-gray-100 border-gray-200'} border-r p-4 flex flex-col`}>
        {/* Navigation Tabs */}
        <div className="flex space-x-2 mb-4">
          <Button
            variant={activeTab === "files" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("files")}
            className={theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}
          >
            Files
          </Button>
          <Button
            variant={activeTab === "collaborators" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("collaborators")}
            className={theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}
          >
            Collaborators
          </Button>
        </div>

        {/* Active Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "files" && (
            <div>
              <h2 className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
                File Explorer
              </h2>
              {fileTree.map((node) => renderFileTree(node))}
            </div>
          )}
          {activeTab === "collaborators" && (
            <CollaboratorsSidebar 
              collaborators={collaborators} 
              onStartChat={handleStartChat}
            />
          )}
        </div>
      </div>

      {/* Chat Panel */}
      {activeChat && (
        <ChatPanel
          collaborator={activeChat}
          onClose={handleCloseChat}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
};