"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, Users, ListTodo, Calendar } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { WorkspaceSwitcher, type WorkspaceLite } from "@/components/workspace-switcher";
import { UserMenu, type SessionUserLite } from "@/components/user-menu";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Dự án", icon: FolderKanban },
  { href: "/my-tasks", label: "Tác vụ của tôi", icon: ListTodo },
  { href: "/calendar", label: "Lịch", icon: Calendar },
  { href: "/team", label: "Đội nhóm", icon: Users },
];

export function AppSidebar({
  user,
  activeWorkspace,
  workspaces,
}: {
  user: SessionUserLite;
  activeWorkspace: WorkspaceLite | null;
  workspaces: WorkspaceLite[];
}) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="p-2">
        <WorkspaceSwitcher active={activeWorkspace} workspaces={workspaces} />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <UserMenu user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
