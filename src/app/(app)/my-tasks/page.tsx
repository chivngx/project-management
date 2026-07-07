"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { format, isPast, isValid } from "date-fns";
import { vi } from "date-fns/locale";
import { Calendar, ListTodo } from "lucide-react";

import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PRIORITY_BADGE,
  PRIORITY_LABEL,
  TASK_STATUS_BADGE,
  TASK_STATUS_LABEL,
} from "@/lib/constants";

type MyTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  project: { id: string; name: string };
};

type GroupedTasks = {
  TODO: MyTask[];
  IN_PROGRESS: MyTask[];
  REVIEW: MyTask[];
  DONE: MyTask[];
};

const STATUS_ORDER: (keyof GroupedTasks)[] = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"];

function TaskRow({ task }: { task: MyTask }) {
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const dueValid = due && isValid(due);
  const overdue = dueValid && isPast(due) && task.status !== "DONE";
  return (
    <Link
      href={`/projects/${task.project.id}`}
      className="block rounded-lg border bg-card p-3 transition-colors hover:bg-accent/40"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-1 text-sm font-medium">{task.title}</p>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
            PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.MEDIUM
          )}
        >
          {PRIORITY_LABEL[task.priority] ?? task.priority}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="truncate">{task.project.name}</span>
        {dueValid && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1",
              overdue ? "font-medium text-red-600 dark:text-red-400" : ""
            )}
          >
            <Calendar className="h-3 w-3" />
            {format(due, "dd/MM/yyyy", { locale: vi })}
          </span>
        )}
      </div>
    </Link>
  );
}

export default function MyTasksPage() {
  const { data, isLoading } = useQuery<GroupedTasks>({
    queryKey: ["my-tasks"],
    queryFn: () => apiFetch("/api/my-tasks"),
  });

  const grouped = data ?? { TODO: [], IN_PROGRESS: [], REVIEW: [], DONE: [] };
  const total =
    grouped.TODO.length +
    grouped.IN_PROGRESS.length +
    grouped.REVIEW.length +
    grouped.DONE.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tác vụ của tôi</h1>
        <p className="text-sm text-muted-foreground">
          Tất cả tác vụ được giao cho bạn trong workspace, trên mọi dự án.
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Đang tải…
          </CardContent>
        </Card>
      ) : total === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ListTodo className="h-6 w-6" />
            </span>
            <div>
              <p className="font-medium text-sm">Chưa có tác vụ nào được giao</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Khi được giao tác vụ trong các dự án, chúng sẽ xuất hiện tại đây.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STATUS_ORDER.map((status) => (
            <Card key={status} className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>{TASK_STATUS_LABEL[status] ?? status}</span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "font-mono",
                      TASK_STATUS_BADGE[status] ?? ""
                    )}
                  >
                    {grouped[status].length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 space-y-2">
                {grouped[status].length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    Không có tác vụ.
                  </p>
                ) : (
                  grouped[status].map((t) => <TaskRow key={t.id} task={t} />)
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
