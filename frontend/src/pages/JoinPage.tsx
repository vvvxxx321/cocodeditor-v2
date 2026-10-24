"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader } from "lucide-react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import VerificationInput from "react-verification-input";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-context-provider";

const JoinPage = () => {
  const navigate = useNavigate();
  const { teamId } = useParams();
  const { session } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [teamName, setTeamName] = useState("");

  // Check if team exists
  useEffect(() => {
    const checkTeam = async () => {
      if (!teamId || !session) return;
      
      try {
        setIsLoading(true);
        const response = await fetch(`/api/teams/${teamId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        
        if (response.ok) {
          const teamData = await response.json();
          setTeamName(teamData.name);
        } else {
          toast.error("Team not found");
          navigate("/");
        }
      } catch (error) {
        console.error("Error checking team:", error);
        toast.error("Failed to load team information");
      } finally {
        setIsLoading(false);
      }
    };
    
    checkTeam();
  }, [teamId, session, navigate]);

  const handleComplete = async (joinCode: string) => {
    if (!teamId || !session) return;
    
    setIsPending(true);
    
    try {
      const response = await fetch(`/api/teams/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ teamId, joinCode })
      });
      
      if (response.ok) {
        toast.success(`Successfully joined ${teamName}`);
        navigate(`/dashboard/${teamId}`);
      } else {
        const error = await response.json();
        toast.error(error.message || "Invalid join code");
      }
    } catch (error) {
      console.error("Error joining team:", error);
      toast.error("Failed to join team");
    } finally {
      setIsPending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader className="size-6 animate-spin text-muted-foreground"/>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col gap-y-8 items-center justify-center bg-white p-8 rounded-lg shadow-md">
      <div className="flex flex-col gap-y-4 items-center justify-center max-w-md">
        <div className="flex flex-col gap-y-2 items-center justify-center">
          <h1 className="text-2xl font-bold">
            Join {teamName || "Team"}
          </h1>
          <p className="text-md text-muted-foreground">
            Enter the team join code to continue
          </p>
        </div>
        <VerificationInput
          onComplete={handleComplete}
          length={4}
          classNames={{
            container: cn("flex gap-x-2", isPending && "opacity-50 cursor-not-allowed"),
            character: "uppercase h-auto rounded-md border border-gray-300 flex items-center justify-center text-lg font-medium text-gray-500",
            characterInactive: "bg-muted",
            characterSelected: "bg-white text-black",
            characterFilled: "bg-white text-black"
          }}
          placeholder=""
          autoFocus
        />
      </div>
      <div className="flex gap-x-4">
        <Button
          size="lg"
          variant="outline"
          asChild
        >
          <Link to="/">
            Back to home
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default JoinPage;