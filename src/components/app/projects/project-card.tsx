"use client";

import * as React from "react";
import Link from "next/link";
import { format, isPast, isValid } from "date-fns";
import { vi } from "date-fns/locale";
import { Calendar, ListTodo, MoreVertical, Trash2, Eye } from "lucide-react";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  PRIORITY_BADGE,
  PRIORITY_LABEL,
  PROJECT_STATUS_BADGE,
  PROJECT_STATUS_LABEL,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

import { getInitials } from "./helpers";
import type { ProjectListItem } from "./types";

interface ProjectCardProps {
  project: ProjectListItem;
  onDelete: (id: string) => void;
  deleting?: boolean;
}

export function ProjectCard({
  project,
  onDelete,
  deleting = false,
}: ProjectCardProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const due = project.dueDate ? new Date(project.dueDate) : null;
  const dueValid = due && isValid(due);
  const overdue = dueValid && isPast(due) && project.status !== "COMPLETED";

  const visibleMembers = project.members.slice(0, 4);
  const extraMembers = Math.max(0, project.memberCount - visibleMembers.length);

  return (
    <Card className="group relative gap-0 overflow-hidden py-0 transition-all hover:border-foreground/20 hover:shadow-md">
      <CardHeader className="gap-2 p-4 pb-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <CardTitle className="text-base leading-snug">
              <Link
                href={`/projects/${project.id}`}
                className="line-clamp-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {project.name}
              </Link>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-1.5">
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
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="-mr-1 -mt-1 shrink-0 text-muted-foreground"
                aria-label="Hành động"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link href={`/projects/${project.id}`}>
                  <Eye className="size-4" />
                  Xem chi tiết
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="size-4" />
                Xóa dự án
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-4 pt-3">
        <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
          {project.description || "Chưa có mô tả cho dự án này."}
        </p>

        <div className="mt-4 flex items-center gap-2">
          {visibleMembers.length > 0 ? (
            <div className="flex -space-x-2">
              {visibleMembers.map((m) => (
                <Avatar
                  key={m.id}
                  size="sm"
                  className="ring-2 ring-background"
                  title={m.name}
                >
                  {m.image ? <AvatarImage src={m.image} alt={m.name} /> : null}
                  <AvatarFallback>{getInitials(m.name)}</AvatarFallback>
                </Avatar>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground/70">
              Chưa có thành viên
            </span>
          )}
          {extraMembers > 0 && (
            <span className="text-xs font-medium text-muted-foreground">
              +{extraMembers}
            </span>
          )}
        </div>
      </CardContent>

      <CardFooter className="justify-between border-t bg-muted/30 p-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ListTodo className="size-3.5" />
          <span className="tabular-nums">{project.taskCount}</span> tác vụ
        </span>
        {dueValid ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5",
              overdue && "font-medium text-red-600 dark:text-red-400"
            )}
          >
            <Calendar className="size-3.5" />
            {format(due, "dd/MM/yyyy", { locale: vi })}
          </span>
        ) : (
          <span className="text-muted-foreground/70">Không có hạn</span>
        )}
      </CardFooter>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xóa dự án?</DialogTitle>
            <DialogDescription>
              Hành động này không thể hoàn tác. Dự án{" "}
              <span className="font-medium text-foreground">
                &ldquo;{project.name}&rdquo;
              </span>{" "}
              cùng tất cả tác vụ bên trong sẽ bị xóa vĩnh viễn.
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
              disabled={deleting}
              onClick={() => {
                onDelete(project.id);
                setConfirmOpen(false);
              }}
            >
              <Trash2 className="size-4" />
              Xóa vĩnh viễn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function ProjectCardSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="gap-2 p-4 pb-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
          </div>
          <Skeleton className="size-6 rounded-md" />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-3">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="mt-1.5 h-3.5 w-4/5" />
        <div className="mt-4 flex -space-x-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="size-6 rounded-full ring-2 ring-background" />
          ))}
        </div>
      </CardContent>
      <CardFooter className="justify-between border-t bg-muted/30 p-3">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3.5 w-24" />
      </CardFooter>
    </Card>
  );
}
