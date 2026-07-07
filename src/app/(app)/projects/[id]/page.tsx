"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isPast, isValid } from "date-fns";
import { vi } from "date-fns/locale";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ListTodo,
  Pencil,
  Settings,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PRIORITY_BADGE,
  PRIORITY_LABEL,
  PROJECT_STATUS_BADGE,
  PROJECT_STATUS_LABEL,
  TASK_STATUSES,
  TASK_STATUS_BADGE,
  TASK_STATUS_LABEL,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

import { ProjectSettingsDialog } from "@/components/app/projects/project-settings-dialog";
import { TasksBoard } from "@/components/app/projects/tasks-board";
import { getInitials } from "@/components/app/projects/helpers";
import type {
  Member,
  ProjectDetail,
  Task,
} from "@/components/app/projects/types";
import { normalizeProject } from "@/components/app/projects/types";

// Neutral palette matching the dashboard (no indigo/blue).
const STATUS_COLORS: Record<string, string> = {
  TODO: "#a1a1aa", // zinc-400
  IN_PROGRESS: "#f59e0b", // amber-500
  REVIEW: "#8b5cf6", // violet-500
  DONE: "#10b981", // emerald-500
};

export default function ProjectDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();

  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const {
    data: projectRaw,
    isLoading,
    isError,
    error,
  } = useQuery<unknown>({
    queryKey: ["project", id],
    queryFn: () => apiFetch(`/api/projects/${id}`),
    enabled: !!id,
  });

  // Normalize the raw API payload (members are nested under .user on the
  // detail endpoint — see types.ts).
  const project = projectRaw
    ? normalizeProject(projectRaw as Parameters<typeof normalizeProject>[0])
    : undefined;

  const [deleting, setDeleting] = React.useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiFetch(`/api/projects/${id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Đã xóa dự án");
      // Navigate back to /projects. Using window.location because we don't
      // import useRouter just for one navigation, and the page is already a
      // client component.
      window.location.href = "/projects";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không thể xóa dự án");
      setDeleting(false);
    }
  };

  if (isLoading) {
    return <ProjectDetailSkeleton />;
  }

  if (isError || !project) {
    return (
      <div className="flex flex-col gap-4">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="w-fit text-muted-foreground"
        >
          <Link href="/projects">
            <ArrowLeft className="size-4" />
            Quay lại dự án
          </Link>
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <ListTodo className="size-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Không tìm thấy dự án</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                {error instanceof Error
                  ? error.message
                  : "Dự án có thể đã bị xóa hoặc bạn không có quyền xem."}
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/projects">Về danh sách dự án</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const due = project.dueDate ? new Date(project.dueDate) : null;
  const dueValid = due && isValid(due);
  const overdue = dueValid && isPast(due) && project.status !== "COMPLETED";

  const tasks = project.tasks ?? [];
  const tasksByStatus = TASK_STATUSES.map((key) => ({
    key,
    name: TASK_STATUS_LABEL[key],
    value: tasks.filter((t) => t.status === key).length,
  }));
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "DONE").length;
  const progress =
    totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="w-fit text-muted-foreground"
      >
        <Link href="/projects">
          <ArrowLeft className="size-4" />
          Quay lại dự án
        </Link>
      </Button>

      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
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
            {dueValid && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs",
                  overdue
                    ? "font-medium text-red-600 dark:text-red-400"
                    : "text-muted-foreground"
                )}
              >
                <Calendar className="size-3.5" />
                Hạn: {format(due, "dd/MM/yyyy", { locale: vi })}
              </span>
            )}
          </div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {project.name}
          </h1>
          {project.description && (
            <p className="max-w-3xl text-sm text-muted-foreground">
              {project.description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="size-4" />
            Cài đặt
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
            Xóa
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="tasks">
            Tác vụ
            <span className="ml-1 rounded-full bg-muted-foreground/15 px-1.5 text-[10px] font-medium tabular-nums">
              {totalTasks}
            </span>
          </TabsTrigger>
          <TabsTrigger value="members">
            Thành viên
            <span className="ml-1 rounded-full bg-muted-foreground/15 px-1.5 text-[10px] font-medium tabular-nums">
              {project.members.length}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview" className="outline-none">
          <OverviewTab
            project={project}
            tasksByStatus={tasksByStatus}
            totalTasks={totalTasks}
            doneTasks={doneTasks}
            progress={progress}
          />
        </TabsContent>

        {/* Tasks tab */}
        <TabsContent value="tasks" className="outline-none">
          <TasksBoard
            projectId={project.id}
            tasks={tasks}
            members={project.members}
          />
        </TabsContent>

        {/* Members tab */}
        <TabsContent value="members" className="outline-none">
          <MembersTab members={project.members} tasks={tasks} />
        </TabsContent>
      </Tabs>

      <ProjectSettingsDialog
        project={project}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xóa dự án?</DialogTitle>
            <DialogDescription>
              Hành động này không thể hoàn tác. Dự án{" "}
              <span className="font-medium text-foreground">
                &ldquo;{project.name}&rdquo;
              </span>{" "}
              cùng tất cả {totalTasks} tác vụ bên trong sẽ bị xóa vĩnh viễn.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              <Trash2 className="size-4" />
              Xóa vĩnh viễn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Overview tab ---------------- */

interface OverviewTabProps {
  project: ProjectDetail;
  tasksByStatus: Array<{ key: string; name: string; value: number }>;
  totalTasks: number;
  doneTasks: number;
  progress: number;
}

function OverviewTab({
  project,
  tasksByStatus,
  totalTasks,
  doneTasks,
  progress,
}: OverviewTabProps) {
  const todoCount = tasksByStatus.find((t) => t.key === "TODO")?.value ?? 0;
  const inProgressCount =
    tasksByStatus.find((t) => t.key === "IN_PROGRESS")?.value ?? 0;
  const reviewCount = tasksByStatus.find((t) => t.key === "REVIEW")?.value ?? 0;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Left: stats + description */}
      <div className="flex flex-col gap-4 lg:col-span-2">
        {/* Key stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Tổng tác vụ"
            value={totalTasks}
            icon={ListTodo}
            tone="zinc"
          />
          <StatTile
            label="Đã hoàn thành"
            value={doneTasks}
            icon={CheckCircle2}
            tone="emerald"
          />
          <StatTile
            label="Đang thực hiện"
            value={inProgressCount}
            icon={Pencil}
            tone="amber"
          />
          <StatTile
            label="Cần làm / Review"
            value={todoCount + reviewCount}
            icon={Users}
            tone="violet"
          />
        </div>

        {/* Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tiến độ tổng thể</CardTitle>
            <CardDescription>
              Tỷ lệ tác vụ đã hoàn thành trên tổng số tác vụ của dự án.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {doneTasks}/{totalTasks} tác vụ đã hoàn thành
              </span>
              <span className="font-semibold tabular-nums">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2.5" />
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mô tả dự án</CardTitle>
          </CardHeader>
          <CardContent>
            {project.description ? (
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {project.description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground/70">
                Chưa có mô tả. Nhấn &ldquo;Cài đặt&rdquo; để thêm mô tả cho dự án.
              </p>
            )}
            <Separator className="my-4" />
            <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Trạng thái</dt>
                <dd className="mt-0.5 font-medium">
                  {PROJECT_STATUS_LABEL[project.status] ?? project.status}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Ưu tiên</dt>
                <dd className="mt-0.5 font-medium">
                  {PRIORITY_LABEL[project.priority] ?? project.priority}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Thành viên</dt>
                <dd className="mt-0.5 font-medium">
                  {project.members.length}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Right: chart + members */}
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Phân bố tác vụ</CardTitle>
            <CardDescription>Theo trạng thái hiện tại</CardDescription>
          </CardHeader>
          <CardContent>
            {totalTasks === 0 ? (
              <div className="flex h-44 flex-col items-center justify-center gap-1 text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  Chưa có tác vụ
                </p>
                <p className="text-xs text-muted-foreground">
                  Chuyển sang tab &ldquo;Tác vụ&rdquo; để thêm.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="relative h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={tasksByStatus}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={56}
                        outerRadius={84}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {tasksByStatus.map((entry) => (
                          <Cell
                            key={entry.key}
                            fill={STATUS_COLORS[entry.key] ?? "#a1a1aa"}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || payload.length === 0)
                            return null;
                          const item = payload[0];
                          return (
                            <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                              <p className="font-medium text-foreground">
                                {item?.name}
                              </p>
                              <p className="mt-0.5 text-muted-foreground">
                                {item?.value} tác vụ
                              </p>
                            </div>
                          );
                        }}
                        wrapperStyle={{ outline: "none" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-semibold tabular-nums">
                      {totalTasks}
                    </span>
                    <span className="text-xs text-muted-foreground">tác vụ</span>
                  </div>
                </div>
                <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                  {tasksByStatus.map((d) => (
                    <li
                      key={d.key}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <span
                        className="size-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            STATUS_COLORS[d.key] ?? "#a1a1aa",
                        }}
                        aria-hidden
                      />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-medium tabular-nums text-foreground">
                        {d.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thành viên dự án</CardTitle>
            <CardDescription>
              {project.members.length} người tham gia
            </CardDescription>
          </CardHeader>
          <CardContent>
            {project.members.length === 0 ? (
              <p className="text-sm text-muted-foreground/70">
                Chưa có thành viên.
              </p>
            ) : (
              <ul className="max-h-72 space-y-2 overflow-y-auto thin-scroll">
                {project.members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 rounded-md p-1.5"
                  >
                    <Avatar size="sm">
                      {m.image ? (
                        <AvatarImage src={m.image} alt={m.name} />
                      ) : null}
                      <AvatarFallback>{getInitials(m.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.email}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- Members tab ---------------- */

interface MembersTabProps {
  members: Member[];
  tasks: Task[];
}

function MembersTab({ members, tasks }: MembersTabProps) {
  // Compute per-member task summary.
  const summary = React.useMemo(() => {
    const map = new Map<
      string,
      { total: number; done: number; inProgress: number }
    >();
    for (const m of members) {
      map.set(m.id, { total: 0, done: 0, inProgress: 0 });
    }
    for (const t of tasks) {
      if (!t.assigneeId) continue;
      const s = map.get(t.assigneeId);
      if (!s) continue;
      s.total++;
      if (t.status === "DONE") s.done++;
      else if (t.status === "IN_PROGRESS") s.inProgress++;
    }
    return map;
  }, [members, tasks]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Thành viên dự án</CardTitle>
        <CardDescription>
          {members.length} người tham gia dự án. Tóm tắt tác vụ được giao cho
          từng thành viên.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground/70">
            Chưa có thành viên trong dự án.
          </p>
        ) : (
          <ul className="max-h-[36rem] divide-y overflow-y-auto thin-scroll">
            {members.map((m) => {
              const s = summary.get(m.id) ?? {
                total: 0,
                done: 0,
                inProgress: 0,
              };
              const completion =
                s.total === 0 ? 0 : Math.round((s.done / s.total) * 100);
              return (
                <li
                  key={m.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar>
                      {m.image ? (
                        <AvatarImage src={m.image} alt={m.name} />
                      ) : null}
                      <AvatarFallback>{getInitials(m.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
                    <div className="text-right">
                      <p className="font-medium text-foreground tabular-nums">
                        {s.total}
                      </p>
                      <p>tác vụ</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-emerald-600 tabular-nums dark:text-emerald-400">
                        {s.done}
                      </p>
                      <p>hoàn thành</p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="font-medium text-amber-600 tabular-nums dark:text-amber-400">
                        {s.inProgress}
                      </p>
                      <p>đang làm</p>
                    </div>
                    <div className="w-24">
                      <Progress value={completion} className="h-1.5" />
                      <p className="mt-1 text-right text-[10px] tabular-nums">
                        {completion}%
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------- Stat tile ---------------- */

type Tone = "zinc" | "emerald" | "amber" | "violet";

const TONE_STYLES: Record<Tone, string> = {
  zinc: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  emerald:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  violet:
    "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
};

function StatTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            TONE_STYLES[tone]
          )}
          aria-hidden
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Skeleton ---------------- */

function ProjectDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-32" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-9 w-72" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-32" />
          <Skeleton className="h-48" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      </div>
    </div>
  );
}
