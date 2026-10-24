import * as React from "react"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface Project {
  id: string
  name: string
  path: string
}

interface ProjectSelectorProps {
  projects: Project[]
  currentProject?: Project
  onProjectSelect?: (project: Project) => void
}

export function ProjectSelector({
  projects,
  currentProject,
  onProjectSelect,
}: ProjectSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between font-medium"
        >
          <span className="truncate">
            {currentProject?.name || "Select Project"}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        {projects.map((project) => (
          <DropdownMenuItem
            key={project.id}
            onClick={() => onProjectSelect?.(project)}
            className={cn(
              "cursor-pointer",
              currentProject?.id === project.id && "bg-accent"
            )}
          >
            {project.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 