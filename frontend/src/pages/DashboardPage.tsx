import { useState, useEffect } from "react";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog"
import { DeleteProjectDialog } from "@/components/dashboard/delete-project-dialog"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { ProjectGrid } from "@/components/dashboard/project-grid";
import { supabaseClient } from "@/config/supabase-client";
import { User } from "@supabase/supabase-js";
import { useAuth } from "@/providers/auth-context-provider";
import { useParams } from "react-router-dom";

interface Project {
  id: string;
  name: string;
  description: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateProjectInput {
  name: string;
  description: string;
}

const DashboardPage = () => {
  const { user, session } = useAuth();
  const [projects, setProjects] = useState<Project[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { teamId } = useParams();

  useEffect(() => {
    const fetchProjects = async () => {
      if (!teamId) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(`/api/projects/team/${teamId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
        });
        
        if (!response.ok) throw new Error('Failed to fetch projects');
        
        const data = await response.json();
        setProjects(data);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setIsLoading(false);
      }
    };


    fetchProjects();
  }, [teamId]);

  const filteredProjects = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleCreateProject = async (newProject: CreateProjectInput) => {
    try {
      setIsLoading(true);
    
    if (!session?.access_token) {
      console.error('No access token available');
      return;
    }
      
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          name: newProject.name,
          description: newProject.description,
          teamId: teamId,
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create project');
      }
      
      const createdProject = await response.json();
      setProjects([createdProject, ...projects]);
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = (project: Project) => {
    setProjectToDelete(project);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    
    try {
      setIsLoading(true);
      
      const response = await fetch(`/api/projects/${projectToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete project');
      }
      
      setProjects(projects.filter(p => p.id !== projectToDelete.id));
      
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    } finally {
      setIsLoading(false);
      setProjectToDelete(null);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <DashboardSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto py-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-x-4">
                <SidebarTrigger />
                <h1 className="text-2xl font-bold">Projects</h1>
              </div>
              <div className="flex items-center gap-x-4">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Project
                </Button>
              </div>
            </div>

            <ProjectGrid
              projects={filteredProjects}
              isLoading={isLoading}
              onDelete={handleDeleteProject}
            />
          </div>
        </main>
      </div>

      <CreateProjectDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateProject}
      />

      {projectToDelete && (
        <DeleteProjectDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          projectName={projectToDelete.name}
          onConfirm={confirmDeleteProject}
        />
      )}
    </SidebarProvider>
  );
};

export default DashboardPage;