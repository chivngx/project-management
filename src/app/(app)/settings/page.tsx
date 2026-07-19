"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileTab } from "@/components/app/settings/profile-tab";
import { SecurityTab } from "@/components/app/settings/security-tab";
import { WorkspaceTab } from "@/components/app/settings/workspace-tab";
import { apiFetch } from "@/lib/api-fetch";

type WsLite = { id: string; name: string; image: string | null };
type Member = { id: string; name: string | null; email: string; role: string };
type Me = { id: string; name: string; email: string; image: string | null };

export default function SettingsPage() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const { data: me } = useQuery<Me>({
    queryKey: ["me"],
    queryFn: () => apiFetch("/api/me"),
    enabled: mounted,
  });
  const { data: workspaces } = useQuery<WsLite[]>({
    queryKey: ["workspaces"],
    queryFn: () => apiFetch("/api/workspaces"),
    enabled: mounted,
  });
  const { data: activeWorkspace } = useQuery<WsLite>({
    queryKey: ["active-workspace"],
    queryFn: () => apiFetch("/api/workspaces/active"),
    enabled: mounted,
  });
  const { data: team } = useQuery<Member[]>({
    queryKey: ["team"],
    queryFn: () => apiFetch("/api/team"),
    enabled: mounted,
  });

  const currentUserRole = team?.find((m) => m.id === me?.id)?.role;

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-28 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
          <div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-800 rounded mt-2 animate-pulse" />
        </div>
        <div className="space-y-4">
          <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded w-full max-w-sm animate-pulse" />
          <div className="h-64 bg-zinc-100 dark:bg-zinc-900/50 rounded w-full animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cài đặt</h1>
        <p className="text-sm text-muted-foreground">
          Quản lý hồ sơ, bảo mật và workspace.
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile">Hồ sơ</TabsTrigger>
          <TabsTrigger value="security">Bảo mật</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-6">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="security" className="mt-6">
          <SecurityTab />
        </TabsContent>
        <TabsContent value="workspace" className="mt-6">
          <WorkspaceTab
            activeWorkspace={activeWorkspace}
            currentUserRole={currentUserRole}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
