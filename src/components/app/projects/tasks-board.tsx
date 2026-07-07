"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

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

/** A draggable wrapper around TaskCard. */
function DraggableTaskCard({
  task,
  members,
  onStatusChange,
  onDelete,
}: {
  task: Task;
  members: Member[];
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id, data: { status: task.status } });

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.4 : 1,
    touchAction: "none",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard
        task={task}
        members={members}
        onStatusChange={onStatusChange}
        onDelete={onDelete}
      />
    </div>
  );
}

/** A droppable column. */
function Column({
  status,
  items,
  loading,
  members,
  onStatusChange,
  onDelete,
  isOver,
}: {
  status: string;
  items: Task[];
  loading: boolean;
  members: Member[];
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: status });
  return (
    <section
      className={cn(
        "flex flex-col rounded-xl border bg-muted/20 border-t-2 transition-colors",
        COLUMN_ACCENT[status],
        isOver && "ring-2 ring-primary/40"
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
        <div
          ref={setNodeRef}
          className="max-h-[28rem] min-h-16 space-y-2 overflow-y-auto thin-scroll p-1"
        >
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => <TaskCardSkeleton key={i} />)
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
              Chưa có tác vụ
            </div>
          ) : (
            items.map((t) => (
              <DraggableTaskCard
                key={t.id}
                task={t}
                members={members}
                onStatusChange={onStatusChange}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

export function TasksBoard({
  projectId,
  tasks,
  members,
  loading = false,
}: TasksBoardProps) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [overColumn, setOverColumn] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch<{ id: string }>(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Đã xóa tác vụ");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleStatusChange = (id: string, status: string) =>
    statusMutation.mutate({ id, status });
  const handleDelete = (id: string) => deleteMutation.mutate(id);

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

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragOver(e: { over: { id: string | number } | null }) {
    setOverColumn(e.over ? String(e.over.id) : null);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    setOverColumn(null);
    const { active, over } = e;
    if (!over) return;
    const newStatus = String(over.id);
    // over.id is a column status (TODO/IN_PROGRESS/REVIEW/DONE).
    if ((TASK_STATUSES as readonly string[]).includes(newStatus)) {
      const task = tasks.find((t) => t.id === active.id);
      if (task && task.status !== newStatus) {
        statusMutation.mutate({ id: task.id, status: newStatus });
      }
    }
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {loading
            ? "Đang tải tác vụ…"
            : `${tasks.length} tác vụ · Kéo thả thẻ để đổi trạng thái.`}
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Thêm tác vụ
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {TASK_STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              items={grouped[status] ?? []}
              loading={loading}
              members={members}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              isOver={overColumn === status}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="rotate-2 cursor-grabbing opacity-90">
              <TaskCard
                task={activeTask}
                members={members}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <CreateTaskDialog
        projectId={projectId}
        members={members}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}
