"use client";

import * as React from "react";
import Link from "next/link";
import { format, isPast, isValid } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarClock, ListTodo, Users, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  PROJECT_STATUS_BADGE,
  PROJECT_STATUS_LABEL,
  PRIORITY_BADGE,
  PRIORITY_LABEL,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface RecentProject {
  id: string;
  name: string;
  status: string;
  priority: string;
  dueDate: string | null;
  memberCount: number;
  taskCount: number;
  doneCount: number;
  progress: number;
}

interface RecentProjectsProps {
  projects: RecentProject[];
  loading?: boolean;
}

function ProjectCard({ project }: { project: RecentProject }) {
  const due = project.dueDate ? new Date(project.dueDate) : null;
  const dueValid = due && isValid(due);
  const overdue = dueValid && isPast(due) && project.status !== "COMPLETED";

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:border-foreground/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold leading-tight group-hover:text-foreground">
            {project.name}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {project.doneCount}/{project.taskCount} tác vụ hoàn thành
          </p>
        </div>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            PROJECT_STATUS_BADGE[project.status] ?? PROJECT_STATUS_BADGE.ACTIVE
          )}
        >
          {PROJECT_STATUS_LABEL[project.status] ?? project.status}
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            PRIORITY_BADGE[project.priority] ?? PRIORITY_BADGE.MEDIUM
          )}
        >
          {PRIORITY_LABEL[project.priority] ?? project.priority}
        </span>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Tiến độ</span>
          <span className="font-medium tabular-nums">{project.progress}%</span>
        </div>
        <Progress value={project.progress} className="h-1.5" />
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-3.5" />
          <span className="tabular-nums">{project.memberCount}</span>
          <span className="mx-1 h-3 w-px bg-border" />
          <ListTodo className="size-3.5" />
          <span className="tabular-nums">{project.taskCount}</span>
        </span>
        {dueValid ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5",
              overdue && "font-medium text-red-600 dark:text-red-400"
            )}
          >
            <CalendarClock className="size-3.5" />
            {format(due, "dd/MM/yyyy", { locale: vi })}
          </span>
        ) : (
          <span className="text-muted-foreground/70">Không có hạn</span>
        )}
      </div>
    </Link>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="mt-2 h-3 w-1/3" />
      <div className="mt-3 flex gap-1.5">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <div className="mt-4">
        <Skeleton className="h-3 w-full" />
      </div>
      <div className="mt-4 flex justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

export function RecentProjects({ projects, loading = false }: RecentProjectsProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle>Tổng quan dự án</CardTitle>
          <CardDescription>
            {loading
              ? "Đang tải dự án…"
              : `${projects.length} dự án gần nhất trong workspace`}
          </CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm" className="shrink-0">
          <Link href="/projects">
            Xem tất cả
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <ListTodo className="size-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Chưa có dự án nào</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Tạo dự án đầu tiên để bắt đầu quản lý công việc cùng đội nhóm.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/projects">
                Tạo dự án mới
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
