import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/providers/auth-context-provider';
import { useParams } from 'react-router-dom';

interface Team {
  id: string;
  name: string;
  description?: string;
  joinCode: string;
  // Add other team properties as needed
}

export function useGetTeams() {
  const { session } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();
  const { teamId } = useParams();

  const fetchTeams = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/teams', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch teams');
      
      const data = await response.json();
      setTeams(data);
    } catch (err) {
      setError(err);
      console.error('Error fetching teams:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams, teamId]);

  return { teams, isLoading, error, refetch: fetchTeams, hasTeams: teams.length > 0 };
} 