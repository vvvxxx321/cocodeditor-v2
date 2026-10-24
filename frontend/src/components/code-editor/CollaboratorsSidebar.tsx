import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { MessageSquare, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-context-provider";
import { supabase } from "@/lib/supabase";

export interface Collaborator {
  id: string;
  name: string;
  status: "online" | "offline" | "busy";
  email?: string;
  avatar?: string;
  lastSeen?: string;
  username?: string;
}

interface CollaboratorsSidebarProps {
  collaborators: Collaborator[];
  onStartChat: (collaborator: Collaborator) => void;
}

export const CollaboratorsSidebar: React.FC<CollaboratorsSidebarProps> = ({ 
  collaborators,
  onStartChat 
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [collaboratorsWithUsernames, setCollaboratorsWithUsernames] = useState<Collaborator[]>([]);

  useEffect(() => {
    const fetchUsernames = async () => {
      try {
        // Get all collaborator IDs
        const collaboratorIds = collaborators.map(c => c.id);
        if (user?.id) {
          collaboratorIds.push(user.id);
        }

        // Fetch usernames from profiles table
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, username, email')
          .in('id', collaboratorIds);

        if (error) throw error;

        // Map usernames to collaborators
        const updatedCollaborators = collaborators.map(collab => {
          const profile = profiles?.find(p => p.id === collab.id);
          return {
            ...collab,
            name: profile?.username || collab.email?.split('@')[0] || 'User',
            username: profile?.username,
            email: profile?.email || collab.email
          };
        });

        setCollaboratorsWithUsernames(updatedCollaborators);
      } catch (error) {
        console.error('Error fetching usernames:', error);
        setCollaboratorsWithUsernames(collaborators);
      }
    };

    fetchUsernames();
  }, [collaborators, user]);

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

  // Add current user to the collaborators list if not already present
  const allCollaborators = [...collaboratorsWithUsernames];
  
  // Check if current user is already in the list
  const currentUserExists = allCollaborators.some(collab => collab.id === user?.id);
  
  // If not, add the current user
  if (!currentUserExists && user) {
    allCollaborators.push({
      id: user.id,
      name: user.user_metadata?.user_name || user.email?.split('@')[0] || 'User',
      email: user.email,
      status: "online",
      avatar: user.user_metadata?.avatar_url
    });
  }

  return (
    <Card className={`w-full ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700/30' : 'bg-white border-gray-200'}`}>
      <CardHeader>
        <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
          Collaborators
        </h2>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {allCollaborators.map((collab) => (
            <li
              key={collab.id}
              className={`flex items-center justify-between p-2 rounded-lg ${
                theme === 'dark' 
                  ? 'bg-gray-800/30 hover:bg-gray-700/50' 
                  : 'bg-gray-50 hover:bg-gray-100'
              } transition-colors ${collab.id === user?.id ? 'border border-blue-500/30' : ''}`}
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
                  <div className={cn(
                    "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2",
                    theme === 'dark' ? 'border-gray-800' : 'border-white',
                    getStatusColor(collab.status)
                  )} />
                </div>
                <div className="flex flex-col">
                  <span className={`font-medium ${
                    theme === 'dark' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    {collab.username || collab.name} {collab.id === user?.id ? '(You)' : ''}
                  </span>
                  {collab.email && (
                    <span className={`text-sm ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {collab.email}
                    </span>
                  )}
                  {collab.status === 'offline' && collab.lastSeen && (
                    <span className={`text-xs ${
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      Last seen: {collab.lastSeen}
                    </span>
                  )}
                </div>
              </div>
              {collab.id !== user?.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onStartChat(collab)}
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
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};