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
  const { data: me } = useQuery<Me>({
    queryKey: ["me"],
    queryFn: () => apiFetch("/api/me"),
  });
  const { data: workspaces } = useQuery<WsLite[]>({
    queryKey: ["workspaces"],
    queryFn: () => apiFetch("/api/workspaces"),
  });
  const { data: team } = useQuery<Member[]>({
    queryKey: ["team"],
    queryFn: () => apiFetch("/api/team"),
  });

  // The active workspace is the one stored in the cookie; the API list returns
  // all workspaces the user belongs to. We don't know which is "active" from
  // the list alone, so we rely on the first membership (matches server default).
  // For rename/delete, the server always operates on the cookie's active ws,
  // so passing any workspace here is fine for display — the API re-checks.
  const activeWorkspace = workspaces?.[0];
  const currentUserRole = team?.find((m) => m.id === me?.id)?.role;

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
