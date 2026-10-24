import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { useAuth } from "@/providers/auth-context-provider";

interface Collaborator {
  id: string;
  name: string;
  status: "online" | "offline" | "busy";
  email?: string;
  avatar?: string;
  lastSeen?: string;
  username?: string;
}

interface CollaboratorsListProps {
  collaborators: Collaborator[];
  onStartChat?: (collaborator: Collaborator) => void;
}

export const CollaboratorsList: React.FC<CollaboratorsListProps> = ({
  collaborators,
  onStartChat
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  console.log(`[CollaboratorsList - Render] Received collaborators:`, collaborators);
  console.log(`[CollaboratorsList - Render] Current user ID:`, user?.id);
  console.log(`[CollaboratorsList - Render] onStartChat type:`, typeof onStartChat);

  const getStatusColor = (status: Collaborator["status"]) => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "busy":
        return "bg-yellow-500";
      case "offline":
        return "bg-gray-400";
    }
  };

  return (
    <div className="space-y-2">
      {Array.isArray(collaborators) && collaborators.length > 0 ? (
        collaborators.map((collab, index) => {
          try {
            console.log(`[CollaboratorsList - INSIDE MAP ${index}] Processing collab ID: ${collab?.id}, User ID: ${user?.id}`);
            const isDifferentUser = collab.id !== user?.id;
            const isHandlerPresent = !!onStartChat;
            console.log(`[CollaboratorsList] Is different user? ${isDifferentUser}`);
            console.log(`[CollaboratorsList] Is onStartChat present? ${isHandlerPresent}`);

            return (
              <div
                key={collab.id || `item-${index}`}
                className={`flex items-center justify-between p-2 rounded-md ${
                  theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    {collab.avatar ? (
                      <img
                        src={collab.avatar}
                        alt={collab.name}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className={`w-8 h-8 rounded-full ${
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                      } flex items-center justify-center`}>
                        <span className={`text-sm ${
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                          {collab.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 ${
                      theme === 'dark' ? 'border-gray-800' : 'border-white'
                    } ${getStatusColor(collab.status)}`} />
                  </div>
                  <div>
                    <div className={`font-medium ${
                      theme === 'dark' ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                      {collab.name} {collab.id === user?.id ? '(You)' : ''}
                    </div>
                    <div className={`text-xs ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {collab.status === "online" ? "Online" : 
                       collab.status === "busy" ? "Busy" : 
                       collab.lastSeen ? `Last seen: ${collab.lastSeen}` : "Offline"}
                    </div>
                  </div>
                </div>
                
                {isDifferentUser && isHandlerPresent && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onStartChat(collab)}
                    title={`Chat with ${collab.name}`}
                    className={cn(
                      "h-8 w-8",
                      theme === 'dark' 
                        ? 'hover:bg-gray-700/50 text-gray-400 hover:text-gray-200' 
                        : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
                    )}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          } catch (error) {
            console.error(`[CollaboratorsList - MAP ERROR at index ${index}]`, error);
            return <div key={`error-${index}`}>Error rendering item {index}</div>;
          }
        })
      ) : (
        <p className="text-xs text-muted-foreground p-2">No other collaborators found (or array is empty).</p>
      )}
    </div>
  );
};