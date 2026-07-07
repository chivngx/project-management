"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";
import { Loader2, MessageSquare, Send } from "lucide-react";

import { apiFetch } from "@/lib/api-fetch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getInitials } from "./helpers";
import type { Task } from "./types";

type Comment = {
  id: string;
  taskId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string; image: string | null };
};

export function TaskCommentsDialog({
  task,
  open,
  onOpenChange,
}: {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [body, setBody] = React.useState("");

  const { data: comments, isLoading } = useQuery<Comment[]>({
    queryKey: ["comments", task.id],
    queryFn: () => apiFetch(`/api/tasks/${task.id}/comments`),
    enabled: open && !!task.id,
  });

  const mutation = useMutation({
    mutationFn: (text: string) =>
      apiFetch<Comment>(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: text }),
      }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["comments", task.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    mutation.mutate(text);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Bình luận
          </DialogTitle>
          <DialogDescription className="truncate">
            {task.title}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-72 pr-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải…
            </div>
          ) : !comments || comments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Chưa có bình luận. Hãy để bình luận đầu tiên!
            </p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-2.5">
                  <Avatar size="sm" className="mt-0.5 shrink-0">
                    {c.user.image ? (
                      <AvatarImage src={c.user.image} alt={c.user.name} />
                    ) : null}
                    <AvatarFallback>{getInitials(c.user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 rounded-lg bg-muted/40 p-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium">{c.user.name}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(c.createdAt), {
                          addSuffix: true,
                          locale: vi,
                        })}
                      </span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">
                      {c.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        <form onSubmit={onSubmit} className="space-y-2 border-t pt-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Viết bình luận…"
            rows={2}
            maxLength={2000}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSubmit(e as unknown as React.FormEvent);
              }
            }}
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              Ctrl/Cmd + Enter để gửi
            </p>
            <Button
              type="submit"
              size="sm"
              disabled={mutation.isPending || !body.trim()}
            >
              {mutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-3.5 w-3.5" />
              )}
              Gửi
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
