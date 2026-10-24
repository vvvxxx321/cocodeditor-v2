import { useNavigate } from "react-router-dom";
import { useGetTeams } from "@/hooks/use-get-teams";
import { useCreateTeamModal } from "@/hooks/use-create-team-modal";
import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-context-provider";
import { Loader } from "lucide-react";
import { toast } from "sonner";
import { CreateTeamModal } from "@/components/dashboard/create-team-modal";

const TeamCheckPage = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [isOpen, setIsOpen] = useCreateTeamModal();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const checkTeams = async () => {
      if (!session?.access_token) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setHasError(false);
        // If user has teams, redirect to dashboard
        const response = await fetch('http://localhost:3000/api/teams', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch teams: ${response.status}`);
        }

        const data = await response.json();
        if (data.length > 0) {
          navigate(`/dashboard/${data[0].id}`);
        } else {
          setIsOpen(true);
        }
      } catch (error) {
        console.error('Error checking teams:', error);
        setHasError(true);
        toast.error("Failed to load teams. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    
    checkTeams();
  }, [session?.access_token, navigate, setIsOpen]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Checking your teams...</p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-foreground">Failed to load teams. Please try again.</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Redirecting you to the dashboard...</p>
        </div>
      </div>
      <CreateTeamModal />
    </>
  );
};

export default TeamCheckPage; 