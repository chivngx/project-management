"use client";

import * as React from "react";
import { format, isPast, isValid } from "date-fns";
import { vi } from "date-fns/locale";
import { Calendar, MessageSquare, MoreVertical, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRIORITY_BADGE,
  PRIORITY_LABEL,
  TASK_STATUSES,
  TASK_STATUS_BADGE,
  TASK_STATUS_LABEL,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

import { getInitials } from "./helpers";
import { EditTaskDialog } from "./edit-task-dialog";
import { TaskCommentsDialog } from "./task-comments-dialog";
import type { Member, Task } from "./types";

interface TaskCardProps {
  task: Task;
  members: Member[];
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  /** Optional className for layout tweaks inside columns. */
  className?: string;
}

export function TaskCard({
  task,
  members,
  onStatusChange,
  onDelete,
  className,
}: TaskCardProps) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [commentsOpen, setCommentsOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const due = task.dueDate ? new Date(task.dueDate) : null;
  const dueValid = due && isValid(due);
  const overdue = dueValid && isPast(due) && task.status !== "DONE";

  return (
    <div
      className={cn(
        "group rounded-lg border bg-card p-3 text-sm shadow-sm transition-all hover:border-foreground/20 hover:shadow-md",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="line-clamp-2 font-medium leading-snug hover:underline">
            {task.title}
          </p>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              aria-label="Hành động"
            >
              <MoreVertical className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Chỉnh sửa
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCommentsOpen(true)}>
              <MessageSquare className="size-4" />
              Bình luận
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="size-4" />
              Xóa tác vụ
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {task.description}
        </p>
      )}

      <div className="mt-3">
        <Select
          value={task.status}
          onValueChange={(v) => onStatusChange(task.id, v)}
        >
          <SelectTrigger
            size="sm"
            className={cn(
              "h-7 w-full border-none px-2 text-xs font-medium",
              TASK_STATUS_BADGE[task.status] ?? TASK_STATUS_BADGE.TODO
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {TASK_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {task.assignee ? (
            <>
              <Avatar size="sm">
                {task.assignee.image ? (
                  <AvatarImage
                    src={task.assignee.image}
                    alt={task.assignee.name}
                  />
                ) : null}
                <AvatarFallback>{getInitials(task.assignee.name)}</AvatarFallback>
              </Avatar>
              <span className="truncate text-xs text-muted-foreground">
                {task.assignee.name}
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground/70">
              Chưa giao
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.MEDIUM
            )}
          >
            {PRIORITY_LABEL[task.priority] ?? task.priority}
          </span>
          {dueValid && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px]",
                overdue
                  ? "font-medium text-red-600 dark:text-red-400"
                  : "text-muted-foreground"
              )}
            >
              <Calendar className="size-3" />
              {format(due, "dd/MM", { locale: vi })}
            </span>
          )}
        </div>
      </div>

      <EditTaskDialog
        task={task}
        members={members}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <TaskCommentsDialog
        task={task}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
      />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xóa tác vụ?</DialogTitle>
            <DialogDescription>
              Tác vụ{" "}
              <span className="font-medium text-foreground">
                &ldquo;{task.title}&rdquo;
              </span>{" "}
              sẽ bị xóa vĩnh viễn và không thể khôi phục.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                onDelete(task.id);
                setConfirmOpen(false);
              }}
            >
              <Trash2 className="size-4" />
              Xóa tác vụ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function TaskCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm">
      <div className="h-3.5 w-3/4 animate-pulse rounded bg-accent" />
      <div className="mt-2 h-7 w-full animate-pulse rounded bg-accent" />
      <div className="mt-2.5 flex items-center justify-between">
        <div className="h-5 w-16 animate-pulse rounded-full bg-accent" />
        <div className="h-3 w-10 animate-pulse rounded bg-accent" />
      </div>
    </div>
  );
}
