import React, { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTeam: (name: string, description: string) => Promise<void>;
}

const CreateTeamModal: React.FC<CreateTeamModalProps> = ({ isOpen, onClose, onCreateTeam }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { theme } = useTheme();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await onCreateTeam(name, description);
      setName('');
      setDescription('');
      onClose();
    } catch (error) {
      console.error('Create team error:', error);
      toast({
        title: "Failed to create team",
        description: "An error occurred while creating the team. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={theme === 'dark' ? 'bg-gray-800/50 border-gray-700/30' : 'bg-white border-gray-200'}>
        <DialogHeader>
          <DialogTitle className={theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}>
            Create a new team
          </DialogTitle>
          <DialogDescription className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
            Start collaborating with your team members
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Team name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={theme === 'dark' ? 'bg-gray-700/30 text-gray-200' : 'bg-gray-100 text-gray-900'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className={theme === 'dark' ? 'bg-gray-700/30 text-gray-200' : 'bg-gray-100 text-gray-900'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className={theme === 'dark' ? 'border-gray-700 text-gray-200' : 'border-gray-200 text-gray-900'}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className={`${theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'}`}
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create team'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTeamModal; 