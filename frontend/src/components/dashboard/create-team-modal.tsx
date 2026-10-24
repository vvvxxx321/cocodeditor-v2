import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabaseClient } from "@/config/supabase-client";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useCreateTeamModal } from "@/hooks/use-create-team-modal";
import { useAuth } from "@/providers/auth-context-provider";

// Form validation schema
const formSchema = z.object({
  name: z.string().min(3, {
    message: "Team name must be at least 3 characters.",
  }),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function CreateTeamModal() {
  const { session } = useAuth();
  const [isOpen, setIsOpen] = useCreateTeamModal();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const handleClose = () => {
    form.reset();
    setIsOpen(false);
};


  const onSubmit = async (values: FormValues) => {
    try {
      setIsLoading(true);
      
      // Get current user
      const { data: { user } } = await supabaseClient.auth.getUser();
      
      if (!user) {
        toast.error("You must be logged in to create a team");
        return;
      }

      // Create team using backend API endpoint
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          name: values.name,
          description: values.description || "",
          createdById: user.id,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create team');
      }

      const team = await response.json();

      
      toast.success("Team created successfully!");
      
      
      navigate(`/dashboard/${team.id}`);

      handleClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to create team");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Team</DialogTitle>
          <DialogDescription>
            Create a new team to collaborate with others.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Awesome Team" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What's your team all about?"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Team"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
