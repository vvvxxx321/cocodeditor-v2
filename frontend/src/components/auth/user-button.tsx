
import {Loader, LogOut, UserIcon} from "lucide-react";

import {Avatar, AvatarFallback} from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";


import { supabaseClient } from "@/config/supabase-client";
import { useNavigate } from "react-router";

export const UserButton = () => {
    const navigate = useNavigate();
    const handleSignOut = async () => {
        await supabaseClient.auth.signOut();
        navigate("/");
    };

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="outline-none relative">
            <Avatar className="rounded-md size-10 hover:opacity-75 transition">
                    <AvatarFallback className="rounded-md bg-gray-700 text-white">
                        <UserIcon className="size-6"/>
                    </AvatarFallback>
            </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="right" className="w-60">
                <DropdownMenuItem onClick={() => handleSignOut()} className="h-10">
                    <LogOut className="size-4 mr-2"/>
                    Log out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}