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
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";

type Notification = {
  id: string;
  type: string;
  message: string;
  read: boolean;
  link: string | null;
  createdAt: string;
};

type NotificationsResponse = { items: Notification[]; unread: number };

export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ["notifications"],
    queryFn: () => apiFetch("/api/notifications"),
    // Refetch every 30s so the unread badge stays fresh.
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

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  return (
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
                  }}
                  asChild
                >
                  {n.link ? (
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
  );
}
