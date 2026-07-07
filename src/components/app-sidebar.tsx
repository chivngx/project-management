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
          <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className="relative h-9 gap-2.5 rounded-lg px-3 text-sm font-medium transition-all duration-150"
                    >
                      <Link href={item.href}>
                        {/* Active indicator bar */}
                        {active && (
                          <span
                            aria-hidden
                            className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-foreground opacity-70"
                          />
                        )}
                        <item.icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            active ? "text-foreground" : "text-muted-foreground"
                          }`}
                        />
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
        <div className="mb-1 h-px bg-border/60" />
        <UserMenu user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
