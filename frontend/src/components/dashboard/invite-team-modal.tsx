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
import { CopyIcon } from "lucide-react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/providers/auth-context-provider";

interface InviteTeamModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    teamName: string;
    joinCode: string;
}

export function InviteTeamModal({ 
    open, 
    onOpenChange,
    teamName,
    joinCode 
}: InviteTeamModalProps) {
    const { teamId } = useParams();
    const { session } = useAuth();

    const handleCopy = () => {
        const inviteLink = `${window.location.origin}/join/${teamId}`;

        navigator.clipboard
            .writeText(inviteLink)
            .then(() => toast.success("Invite link copied to clipboard"));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Invite people to {teamName}</DialogTitle>
                    <DialogDescription>
                        Share this code with people you want to invite to your team
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-y-4 items-center justify-center py-10">
                    <p className="text-4xl font-bold tracking-widest uppercase">
                        {joinCode}
                    </p>
                    <Button
                        onClick={handleCopy}
                        variant="ghost"
                        size="sm"
                    >
                        Copy Link
                        <CopyIcon className="size-4 ml-2"/>
                    </Button>
                </div>
                <div className="flex items-center justify-end w-full">
                    <DialogClose asChild>
                        <Button>Close</Button>
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    );
}

