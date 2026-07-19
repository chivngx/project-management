"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";

type Notification = {
  id: string;
  type: string;
  message: string;
  read: boolean;
  link: string | null;
  createdAt: string;
  workspaceId: string;
};

type NotificationsResponse = { items: Notification[]; unread: number };

export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [activeInvite, setActiveInvite] = React.useState<Notification | null>(null);
  const [inviteLoading, setInviteLoading] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const { data: me } = useQuery<any>({
    queryKey: ["me"],
    queryFn: () => apiFetch("/api/me"),
    staleTime: 5 * 60 * 1000,
  });

  const socket = useRealtime(undefined, me?.id);

  React.useEffect(() => {
    if (!socket) return;
    socket.on("notification:new", (newNotif: any) => {
      // Invalidate react-query cache immediately to fetch new notifications list
      qc.invalidateQueries({ queryKey: ["notifications"] });
      // Show instant toast notification
      toast(newNotif.message, {
        description: "Thông báo mới",
      });
    });
    return () => {
      socket.off("notification:new");
    };
  }, [socket, qc]);

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ["notifications"],
    queryFn: () => apiFetch("/api/notifications"),
    // Keep 30s refetch as a fallback mechanism
    refetchInterval: 30 * 1000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => apiFetch("/api/notifications/read-all", { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  async function handleAccept(workspaceId: string) {
    setInviteLoading(true);
    try {
      await apiFetch("/api/workspaces/invitations/accept", {
        method: "POST",
        body: JSON.stringify({ workspaceId }),
      });
      toast.success("Đã tham gia workspace thành công!");
      setActiveInvite(null);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Thao tác thất bại");
    } finally {
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
      setActiveInvite(null);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Thao tác thất bại");
    } finally {
      setInviteLoading(false);
    }
  }

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Thông báo" className="relative" disabled>
        <Bell className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Thông báo" className="relative">
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 p-0">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm font-semibold">Thông báo</span>
            {unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={markAllRead.isPending}
                onClick={() => markAllRead.mutate()}
              >
                <CheckCheck className="mr-1 h-3.5 w-3.5" /> Đánh dấu đã đọc
              </Button>
            )}
          </div>
          <DropdownMenuSeparator className="my-0" />
          <ScrollArea className="max-h-80">
            {isLoading ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải…
              </div>
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Không có thông báo.
              </p>
            ) : (
              items.map((n) => {
                const isInvite = n.type === "team_invited";
                const content = (
                  <div className="flex gap-2.5 px-3 py-2.5 hover:bg-accent/50">
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        n.read ? "bg-transparent" : "bg-emerald-500"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{n.message}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(n.createdAt), {
                          addSuffix: true,
                          locale: vi,
                        })}
                      </p>
                    </div>
                  </div>
                );
                return (
                  <DropdownMenuItem
                    key={n.id}
                    className="p-0 focus:bg-accent/50"
                    onClick={() => {
                      if (!n.read) markRead.mutate(n.id);
                      setOpen(false);
                      if (isInvite) {
                        setActiveInvite(n);
                      }
                    }}
                    asChild
                  >
                    {isInvite ? (
                      <button type="button" className="w-full text-left">
                        {content}
                      </button>
                    ) : n.link ? (
                      <Link href={n.link}>{content}</Link>
                    ) : (
                      <button type="button" className="w-full text-left">
                        {content}
                      </button>
                    )}
                  </DropdownMenuItem>
                );
              })
            )}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!activeInvite} onOpenChange={(o) => !o && setActiveInvite(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lời mời tham gia Workspace</DialogTitle>
            <DialogDescription className="pt-2 text-foreground font-medium">
              {activeInvite?.message}
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Nếu chấp nhận, bạn sẽ tham gia vào Workspace này và có quyền truy cập vào các dự án/tác vụ liên quan.
          </p>
          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              type="button"
              variant="outline"
              disabled={inviteLoading}
              onClick={() => activeInvite && handleDecline(activeInvite.workspaceId)}
            >
              Từ chối
            </Button>
            <Button
              type="button"
              className="bg-amber-600 hover:bg-amber-700 text-white border-0"
              disabled={inviteLoading}
              onClick={() => activeInvite && handleAccept(activeInvite.workspaceId)}
            >
              {inviteLoading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Chấp nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
