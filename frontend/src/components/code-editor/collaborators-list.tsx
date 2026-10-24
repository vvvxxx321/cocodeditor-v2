import * as React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { useAuth } from "@/providers/auth-context-provider"
import { Button } from "@/components/ui/button"
import { MessageSquare } from "lucide-react"
import { useTheme } from "@/contexts/ThemeContext"

interface Collaborator {
  id: string
  name: string
  avatar?: string
  status: "online" | "offline" | "busy"
  email?: string
  lastSeen?: string
  username?: string
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

  console.log(`[collaborators-list - Render] Received collaborators:`, collaborators);
  console.log(`[collaborators-list - Render] Received onStartChat type:`, typeof onStartChat);
  console.log(`[collaborators-list - Render] Current user from useAuth:`, user);
  console.log(`[collaborators-list - Render] Current user ID:`, user?.id);

  const getStatusColor = (status: Collaborator["status"]) => {
    switch (status) {
      case "online":
        return "bg-green-500"
      case "busy":
        return "bg-yellow-500"
      case "offline":
        return "bg-gray-400"
    }
  }

  return (
    <div className="space-y-2">
      {Array.isArray(collaborators) && collaborators.length > 0 ? (
        collaborators.map((collab) => {
          const isDifferentUser = collab.id !== user?.id;
          const isHandlerPresent = !!onStartChat;
          console.log(`  [collaborators-list - Map] Collab: ${collab.name} (ID: ${collab.id}), User ID: ${user?.id}, IsDifferent: ${isDifferentUser}, HandlerPresent: ${isHandlerPresent}`);

          return (
            <div
              key={collab.id}
              className={`flex items-center justify-between p-2 rounded-md ${
                theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={collab.avatar} alt={collab.name} />
                    <AvatarFallback>
                      {collab.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 ${
                      theme === 'dark' ? 'border-gray-800' : 'border-white'
                    } ${getStatusColor(collab.status)}`}
                  />
                </div>
                <div>
                  <div className={`font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
                    {collab.name} {collab.id === user?.id ? '(You)' : ''}
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
        })
      ) : (
        <p className="text-xs text-muted-foreground p-2">No collaborators found.</p>
      )}
    </div>
  )
} 