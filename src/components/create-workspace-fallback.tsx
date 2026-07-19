"use client";

import * as React from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, Plus, LogOut, Layout } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateWorkspaceFallback() {
  const qc = useQueryClient();
  const [name, setName] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [logoutLoading, setLogoutLoading] = React.useState(false);
  const [inviteLoading, setInviteLoading] = React.useState(false);

  const { data: invitations = [], isLoading: invitesLoading, refetch } = useQuery<any[]>({
    queryKey: ["workspace-invitations"],
    queryFn: () => apiFetch("/api/workspaces/invitations"),
  });

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên workspace");
      return;
    }

    setLoading(true);
    try {
      // 1. Create the workspace
      const workspace = await apiFetch<any>("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });

      // 2. Set it as active
      await apiFetch("/api/workspaces/active", {
        method: "POST",
        body: JSON.stringify({ workspaceId: workspace.id }),
      });

      toast.success("Tạo workspace thành công!");
      // 3. Reload window to enter the workspace
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tạo workspace thất bại");
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(workspaceId: string) {
    setInviteLoading(true);
    try {
      // 1. Accept invitation
      await apiFetch("/api/workspaces/invitations/accept", {
        method: "POST",
        body: JSON.stringify({ workspaceId }),
      });
      // 2. Set active
      await apiFetch("/api/workspaces/active", {
        method: "POST",
        body: JSON.stringify({ workspaceId }),
      });
      toast.success("Đã chấp nhận lời mời và tham gia workspace!");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Thao tác thất bại");
      setInviteLoading(false);
    }
  }

  async function handleDecline(workspaceId: string) {
    setInviteLoading(true);
    try {
      await apiFetch("/api/workspaces/invitations/decline", {
        method: "POST",
        body: JSON.stringify({ workspaceId }),
      });
      toast.success("Đã từ chối lời mời");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Thao tác thất bại");
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleLogout() {
    setLogoutLoading(true);
    try {
      await signOut({ callbackUrl: "/login" });
    } catch (err) {
      toast.error("Đăng xuất thất bại");
      setLogoutLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background/95 p-6 animate-fade-in">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xl">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Layout className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Chưa có Workspace</h1>
          <p className="text-sm text-muted-foreground">
            Bạn không thuộc bất kỳ workspace nào. Hãy tạo mới hoặc chấp nhận lời mời tham gia workspace để tiếp tục.
          </p>
        </div>

        {/* Pending invitations block */}
        {invitations.length > 0 && (
          <div className="space-y-3 rounded-xl border border-amber-200/60 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
            <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Bạn có lời mời tham gia Workspace!
            </h2>
            <div className="space-y-2">
              {invitations.map((invite: any) => (
                <div
                  key={invite.id}
                  className="flex flex-col gap-2 rounded-lg bg-card p-3 shadow-sm border border-border/40"
                >
                  <p className="text-xs font-semibold text-foreground">
                    {invite.workspace?.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Lời mời tham gia vào đội nhóm của Workspace này.
                  </p>
                  <div className="flex gap-2 mt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs flex-1"
                      disabled={inviteLoading || loading || logoutLoading}
                      onClick={() => handleDecline(invite.workspaceId)}
                    >
                      Từ chối
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs flex-1 bg-amber-600 hover:bg-amber-700 text-white border-0"
                      disabled={inviteLoading || loading || logoutLoading}
                      onClick={() => handleAccept(invite.workspaceId)}
                    >
                      {inviteLoading && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      Chấp nhận
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="relative flex items-center justify-center py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-amber-200/40 dark:border-amber-900/20"></div>
              </div>
              <span className="relative bg-amber-50/30 dark:bg-zinc-950 px-2 text-[10px] text-amber-800/80 dark:text-amber-400/80 font-medium">
                HOẶC TỰ TẠO WORKSPACE MỚI
              </span>
            </div>
          </div>
        )}

        <form onSubmit={onCreate} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ws-name" className="text-sm font-medium">
              Tên Workspace mới
            </Label>
            <Input
              id="ws-name"
              placeholder="Ví dụ: Công việc của tôi, Dự án Team..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading || logoutLoading || inviteLoading}
              className="transition-shadow focus:shadow-sm"
            />
          </div>

          <Button
            type="submit"
            className="w-full gap-2"
            disabled={loading || logoutLoading || inviteLoading}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {loading ? "Đang tạo Workspace…" : "Tạo Workspace"}
          </Button>
        </form>

        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/80"></div>
          </div>
          <span className="relative bg-card px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Hoặc
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full gap-2 hover:bg-accent/40 text-muted-foreground hover:text-foreground"
          disabled={loading || logoutLoading || inviteLoading}
          onClick={handleLogout}
        >
          {logoutLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LogOut className="size-4" />
          )}
          Đăng xuất tài khoản
        </Button>
      </div>
    </div>
  );
}
