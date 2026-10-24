import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogClose
} from "@/components/ui/dialog";
import { useAuth } from "@/providers/auth-context-provider";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import VerificationInput from "react-verification-input";
import { cn } from "@/lib/utils";
import { useJoinTeamModal } from "@/hooks/use-join-team-modal";
import { Label } from "@/components/ui/label";

export function JoinTeamModal() {
    const [isOpen, setIsOpen] = useJoinTeamModal();
    const [isPending, setIsPending] = useState(false);
    const [joinCode, setJoinCode] = useState("");
    const { session } = useAuth();
    const navigate = useNavigate();

    const handleJoinTeam = async () => {
        console.log("Submitting join code:", joinCode);
        if (!joinCode || joinCode.length !== 4 || !session) {
            toast.error("Please enter a complete 4-digit join code");
            return;
        }
        
        setIsPending(true);
        
        console.log("Attempting to join team with code:", joinCode.toLowerCase());
        console.log("Join code length:", joinCode.length);
        
        try {
            const actualCode = joinCode.toLowerCase();
            console.log("Final code being submitted:", actualCode);
            
            const response = await fetch(`/api/teams/join-by-code-direct`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ joinCode: actualCode })
            });
            
            console.log("Response status:", response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log("Successfully joined team:", data);
                toast.success(`Successfully joined ${data.team.name}`);
                navigate(`/dashboard/${data.team.id}`);
                setIsOpen(false);
            } else {
                const errorText = await response.text();
                console.error("Error response:", errorText);
                try {
                    const error = JSON.parse(errorText);
                    toast.error(error.message || "Invalid join code");
                } catch (e) {
                    toast.error("Failed to process server response");
                }
            }
        } catch (error) {
            console.error("Error joining team:", error);
            toast.error("Failed to join team");
        } finally {
            setIsPending(false);
        }
    };

    const handleInputChange = (value: string) => {
        setJoinCode(value);
        console.log("Current join code value:", value);
        if (value.length === 4) {
            console.log("Complete 4-digit code entered:", value);
            // Auto-submit when all characters are entered
            setTimeout(() => handleJoinTeam(), 100); // Add small delay to ensure state update
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Join a Team</DialogTitle>
                    <DialogDescription>
                        Enter the 4-digit join code to join a team
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-y-6 items-center justify-center py-8">
                    <div className="w-full space-y-2">
                        <Label>Join Code</Label>
                        <VerificationInput
                            onChange={handleInputChange}
                            value={joinCode}
                            length={4}
                            classNames={{
                                container: cn("flex gap-x-2 w-full justify-center", isPending && "opacity-50 cursor-not-allowed"),
                                character: "lowercase h-auto rounded-md border border-gray-300 flex items-center justify-center text-lg font-medium text-gray-500",
                                characterInactive: "bg-muted",
                                characterSelected: "bg-white text-black",
                                characterFilled: "bg-white text-black"
                            }}
                            placeholder=""
                            inputProps={{
                                style: { textTransform: 'lowercase' },
                                disabled: isPending
                            }}
                        />
                    </div>
                </div>
                <div className="flex items-center justify-between w-full">
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button 
                        onClick={handleJoinTeam} 
                        disabled={isPending || joinCode.length < 4}
                    >
                        {isPending ? "Joining..." : "Join Team"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
} 