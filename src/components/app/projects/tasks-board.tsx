"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import {
  TASK_STATUSES,
  TASK_STATUS_BADGE,
  TASK_STATUS_LABEL,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

import { TaskCard, TaskCardSkeleton } from "./task-card";
import { CreateTaskDialog } from "./create-task-dialog";
import type { Member, Task } from "./types";

interface TasksBoardProps {
  projectId: string;
  tasks: Task[];
  members: Member[];
  loading?: boolean;
}

const COLUMN_ACCENT: Record<string, string> = {
  TODO: "border-t-zinc-400",
  IN_PROGRESS: "border-t-amber-500",
  REVIEW: "border-t-violet-500",
  DONE: "border-t-emerald-500",
};

export function TasksBoard({
  projectId,
  tasks,
  members,
  loading = false,
}: TasksBoardProps) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch<{ id: string }>(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onMutate: async ({ id, status }) => {
      // Optimistic update for instant feedback.
      await queryClient.cancelQueries({ queryKey: ["project", projectId] });
      const prev = queryClient.getQueryData<Task[] | undefined>([
        "project",
        projectId,
      ]);
      // The project query returns a project object, not a task array — we
      // still cancel/refetch to keep things in sync. Optimism here is
      // best-effort because the cached shape is the full project.
      void prev;
      return { status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Đã xóa tác vụ");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleStatusChange = (id: string, status: string) => {
    statusMutation.mutate({ id, status });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const grouped = React.useMemo(() => {
    const map: Record<string, Task[]> = {
      TODO: [],
      IN_PROGRESS: [],
      REVIEW: [],
      DONE: [],
    };
    for (const t of tasks) {
      const key = (TASK_STATUSES as readonly string[]).includes(t.status)
        ? t.status
        : "TODO";
      map[key]!.push(t);
    }
    return map;
  }, [tasks]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {loading
            ? "Đang tải tác vụ…"
            : `${tasks.length} tác vụ · Kéo thả chưa được hỗ trợ, dùng menu trạng thái trên mỗi thẻ để di chuyển.`}
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Thêm tác vụ
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {TASK_STATUSES.map((status) => {
          const items = grouped[status] ?? [];
          return (
            <section
              key={status}
              className={cn(
                "flex flex-col rounded-xl border bg-muted/20 border-t-2",
                COLUMN_ACCENT[status]
              )}
            >
              <header className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      TASK_STATUS_BADGE[status]
                    )}
                  >
                    {TASK_STATUS_LABEL[status]}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground tabular-nums">
                    {items.length}
                  </span>
                </div>
              </header>

              <div className="flex flex-col gap-2 px-2 pb-2">
                <div className="max-h-[28rem] space-y-2 overflow-y-auto thin-scroll p-1">
                  {loading ? (
                    Array.from({ length: 2 }).map((_, i) => (
                      <TaskCardSkeleton key={i} />
                    ))
                  ) : items.length === 0 ? (
                    <div className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
                      Chưa có tác vụ
                    </div>
                  ) : (
                    items.map((t) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        members={members}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDelete}
                      />
                    ))
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <CreateTaskDialog
        projectId={projectId}
        members={members}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}
