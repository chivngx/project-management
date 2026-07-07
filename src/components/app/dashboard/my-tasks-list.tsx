"use client";

import * as React from "react";
import Link from "next/link";
import { format, isPast, isValid } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarClock, CheckCircle2, ListTodo } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  PRIORITY_BADGE,
  PRIORITY_LABEL,
  TASK_STATUS_BADGE,
  TASK_STATUS_LABEL,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface MyTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  projectName: string;
  projectId: string;
}

interface MyTasksListProps {
  tasks: MyTask[];
  loading?: boolean;
}

function TaskRow({ task }: { task: MyTask }) {
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const dueValid = due && isValid(due);
  const overdue = dueValid && isPast(due) && task.status !== "DONE";

  return (
    <Link
      href={`/projects/${task.projectId}`}
      className="flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <CheckCircle2 className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-snug">
          {task.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {task.projectName}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
              TASK_STATUS_BADGE[task.status] ?? TASK_STATUS_BADGE.TODO
            )}
          >
            {TASK_STATUS_LABEL[task.status] ?? task.status}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
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
              <CalendarClock className="size-3" />
              {format(due, "dd/MM", { locale: vi })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function TaskSkeleton() {
  return (
    <div className="flex items-start gap-3 p-2.5">
      <Skeleton className="size-6 rounded-md" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-1.5">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-12 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function MyTasksList({ tasks, loading = false }: MyTasksListProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle>Tác vụ của tôi</CardTitle>
          <CardDescription>
            {loading
              ? "Đang tải…"
              : `${tasks.length} tác vụ đang được giao cho bạn`}
          </CardDescription>
        </div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="shrink-0"
        >
          <Link href="/projects">Xem tất cả</Link>
        </Button>
      </CardHeader>
      <CardContent className="p-2">
        {loading ? (
          <div className="space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <TaskSkeleton key={i} />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <ListTodo className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Bạn không có tác vụ nào</p>
            <p className="max-w-[14rem] text-xs text-muted-foreground">
              Mọi việc đã hoàn thành hoặc chưa có tác vụ nào được giao.
            </p>
          </div>
        ) : (
          <div className="max-h-96 space-y-0.5 overflow-y-auto thin-scroll">
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
