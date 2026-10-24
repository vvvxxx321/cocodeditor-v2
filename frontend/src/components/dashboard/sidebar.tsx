import { useState } from "react"


import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { NavUser } from "./nav-user"
import { TeamSwitcher } from "./team-switcher"
import { NavProjects } from "./nav-projects"

const data = {
    user: {
      name: "shadcn",
      email: "m@example.com",
      avatar: "/avatars/shadcn.jpg",
    },
    teams: [
      {
        name: "Acme Inc",
        plan: "Enterprise",
      }
    ],
    projects: [
      {
        name: "Design Engineering",
        url: "#",
      }
    ],
  }
  

export function DashboardSidebar() {
  const [activeTab, setActiveTab] = useState("projects")

  return (
    <Sidebar collapsible="icon" >
      <SidebarHeader>
        <TeamSwitcher />
      </SidebarHeader>
      <SidebarContent>
          {/* <NavProjects projects={data.projects} /> */}
      </SidebarContent>
      <SidebarFooter>
        <NavUser/>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

