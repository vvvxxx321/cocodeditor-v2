"use client"

import * as React from "react"
import { ChevronsUpDown, Plus, UserPlus, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { useCreateTeamModal } from "@/hooks/use-create-team-modal"
import { useNavigate, useParams } from "react-router-dom"
import { useGetTeams } from "@/hooks/use-get-teams"
import { Skeleton } from "@/components/ui/skeleton"
import { InviteTeamModal } from "./invite-team-modal"
import { useInviteTeamModal } from "@/hooks/use-invite-team-modal"
import { useJoinTeamModal } from "@/hooks/use-join-team-modal"
import { JoinTeamModal } from "./join-team-modal"

export function TeamSwitcher() {
  const [inviteOpen, setInviteOpen] = useInviteTeamModal();
  const [joinOpen, setJoinOpen] = useJoinTeamModal();
  const { teams, isLoading } = useGetTeams();
  const { isMobile } = useSidebar()
  const [_open, setIsOpen] = useCreateTeamModal();
  const navigate = useNavigate();
  const { teamId } = useParams();

  // Find current team based on URL parameter
  const currentTeam = React.useMemo(() => 
    teams.find(team => team.id === teamId) || teams[0],
  [teams, teamId]);
  
  const handleTeamChange = (teamId: string) => {
    navigate(`/dashboard/${teamId}`);
  };

  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton>
            <Skeleton className="size-8 rounded-lg" />
            <div className="grid flex-1 gap-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (!currentTeam) {
    return null
  }

  return (
    <>
    <InviteTeamModal
    open={inviteOpen}
    onOpenChange={setInviteOpen}
    teamName={currentTeam.name}
    joinCode={currentTeam.joinCode}/>
    
    <JoinTeamModal />

    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Users/>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{currentTeam.name}</span>
                <span className="truncate text-xs">{currentTeam.description || ''}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">Teams</DropdownMenuLabel>
            {teams.map((team, index) => (
              <DropdownMenuItem 
                key={team.id} 
                onClick={() => handleTeamChange(team.id)} 
                className={cn("gap-2 p-2", team.id === currentTeam.id && "bg-accent")}
              >
                <div className="flex size-6 items-center justify-center rounded-sm border">
                  <Users/>
                </div>
                {team.name}
                <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsOpen(true)} className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Plus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">Create team</div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setInviteOpen(true)} className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <UserPlus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">Invite team member</div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setJoinOpen(true)} className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <UserPlus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">Join a team</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
    </>
  )
}

