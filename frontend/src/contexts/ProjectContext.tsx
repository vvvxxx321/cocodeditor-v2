import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabaseClient } from '@/config/supabase-client';
import { useAuth } from '@/providers/auth-context-provider';

interface Collaborator {
  id: string;
  username: string;
  avatar_url: string | null;
  last_active: string;
}

interface ProjectContextType {
  currentProject: string | null;
  collaborators: Collaborator[];
  setCurrentProject: (projectId: string | null) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!currentProject) return;

    // Subscribe to real-time changes in project collaborators
    const channel = supabaseClient
      .channel(`project:${currentProject}`)
      .on(
        'presence',
        { event: 'sync' },
        () => {
          const newState = channel.presenceState();
          const collaboratorIds = Object.keys(newState);
          
          // Fetch collaborator details
          const fetchCollaborators = async () => {
            const { data: profiles } = await supabaseClient
              .from('profiles')
              .select('id, username, avatar_url')
              .in('id', collaboratorIds);

            if (profiles) {
              setCollaborators(profiles.map(profile => ({
                ...profile,
                last_active: new Date().toISOString()
              })));
            }
          };

          fetchCollaborators();
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && user) {
          // Track user presence
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString()
          });
        }
      });

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [currentProject, user]);

  return (
    <ProjectContext.Provider value={{ currentProject, collaborators, setCurrentProject }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}; 