"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  ListTodo,
  Plus,
  Sparkles,
} from "lucide-react";

import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

import { StatCard } from "@/components/app/dashboard/stat-card";
import { RecentProjects } from "@/components/app/dashboard/recent-projects";
import { TasksByStatusChart } from "@/components/app/dashboard/tasks-by-status-chart";
import { MyTasksList } from "@/components/app/dashboard/my-tasks-list";
import { RecentActivity } from "@/components/app/dashboard/recent-activity";

interface DashboardStats {
  totals: {
    projects: number;
    activeProjects: number;
    completedProjects: number;
    tasks: number;
    doneTasks: number;
    inProgressTasks: number;
    overdueTasks: number;
    members: number;
  };
  recentProjects: Array<{
    id: string;
    name: string;
    status: string;
    priority: string;
    dueDate: string | null;
    memberCount: number;
    taskCount: number;
    doneCount: number;
    progress: number;
  }>;
  myTasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    projectName: string;
    projectId: string;
  }>;
  tasksByStatus: Array<{ name: string; value: number; key: string }>;
}

interface MeResponse {
  id: string;
  name: string;
  email: string;
}

interface ActivityItem {
  id: string;
  action: string;
  message: string;
  createdAt: string;
  userName: string | null;
  userImage: string | null;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Chào buổi sáng";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

export default function DashboardPage() {
  const { data: me } = useQuery<MeResponse>({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/api/me"),
    staleTime: 5 * 60 * 1000,
  });

  const { data: invitations, refetch: refetchInvitations } = useQuery<any[]>({
    queryKey: ["workspace-invitations"],
    queryFn: () => apiFetch<any[]>("/api/workspaces/invitations"),
    staleTime: 10 * 1000,
  });

  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  async function handleAcceptInvite(workspaceId: string) {
    setActionLoading(workspaceId);
    try {
      await apiFetch("/api/workspaces/invitations/accept", {
        method: "POST",
        body: JSON.stringify({ workspaceId }),
      });
      toast.success("Đã tham gia workspace thành công!");
      refetchInvitations();
      // Reload page to refresh sidebar workspaces and load stats
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Thao tác thất bại");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeclineInvite(workspaceId: string) {
    setActionLoading(workspaceId);
    try {
      await apiFetch("/api/workspaces/invitations/decline", {
        method: "POST",
        body: JSON.stringify({ workspaceId }),
      });
      toast.success("Đã từ chối lời mời");
      refetchInvitations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Thao tác thất bại");
    } finally {
      setActionLoading(null);
    }
  }

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
  } = useQuery<DashboardStats>({
    queryKey: ["stats"],
    queryFn: () => apiFetch<DashboardStats>("/api/stats"),
    staleTime: 30 * 1000,
  });

  const {
    data: activities,
    isLoading: activitiesLoading,
  } = useQuery<ActivityItem[]>({
    queryKey: ["activities"],
    queryFn: () => apiFetch<ActivityItem[]>("/api/activities"),
    staleTime: 30 * 1000,
  });

  const totals = stats?.totals;
  const firstName = me?.name?.split(" ")[0] ?? me?.name ?? "";

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      {/* Page header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-amber-500" aria-hidden />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {me ? (
                <>
                  {getGreeting()},{" "}
                  <span className="font-bold">{firstName}</span>
                  <span className="text-muted-foreground">.</span>
                </>
              ) : (
                <Skeleton className="inline-block h-7 w-56 align-middle" />
              )}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Theo dõi tiến độ dự án và tác vụ của bạn trong một nơi.
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0 gap-1.5">
          <Link href="/projects">
            <Plus className="size-4" />
            Dự án mới
          </Link>
        </Button>
      </header>

      {/* Pending Workspace Invitations */}
      {invitations && invitations.length > 0 && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-center gap-2">
            <span className="text-lg">✉️</span>
            <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
              Lời mời tham gia Workspace ({invitations.length})
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-col justify-between gap-3 rounded-lg border border-amber-100 bg-card p-4 shadow-sm dark:border-amber-950"
              >
                <div>
                  <h3 className="font-semibold text-foreground text-sm">
                    {inv.workspace?.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Được mời vào {new Date(inv.joinedAt).toLocaleDateString("vi-VN")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white border-0"
                    disabled={actionLoading === inv.workspaceId}
                    onClick={() => handleAcceptInvite(inv.workspaceId)}
                  >
                    Chấp nhận
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={actionLoading === inv.workspaceId}
                    onClick={() => handleDeclineInvite(inv.workspaceId)}
                  >
                    Từ chối
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stat cards — staggered fade-up */}
      <section
        aria-label="Tổng quan"
        className="stagger grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4"
      >
        <StatCard
          label="Tổng dự án"
          icon={FolderKanban}
          tone="zinc"
          value={totals?.projects ?? 0}
          helper={
            totals
              ? `${totals.activeProjects} đang hoạt động`
              : undefined
          }
          loading={statsLoading && !totals}
        />
        <StatCard
          label="Dự án đang hoạt động"
          icon={CheckCircle2}
          tone="emerald"
          value={totals?.activeProjects ?? 0}
          helper={
            totals ? `${totals.completedProjects} đã hoàn thành` : undefined
          }
          loading={statsLoading && !totals}
        />
        <StatCard
          label="Tác vụ hoàn thành"
          icon={ListTodo}
          tone="violet"
          value={
            totals ? (
              <>
                <span className="tabular-nums">{totals.doneTasks}</span>
                <span className="text-lg font-normal text-muted-foreground">
                  /{totals.tasks}
                </span>
              </>
            ) : (
              0
            )
          }
          helper={
            totals
              ? `${totals.inProgressTasks} đang thực hiện`
              : undefined
          }
          loading={statsLoading && !totals}
        />
        <StatCard
          label="Tác vụ quá hạn"
          icon={AlertTriangle}
          tone="amber"
          alert={(totals?.overdueTasks ?? 0) > 0}
          value={totals?.overdueTasks ?? 0}
          helper={
            totals
              ? totals.overdueTasks > 0
                ? `Trên ${totals.tasks} tác vụ`
                : "Không có tác vụ quá hạn"
              : undefined
          }
          loading={statsLoading && !totals}
        />
      </section>

      {/* Error banner */}
      {statsError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Không thể tải dữ liệu dashboard. Vui lòng làm mới trang để thử lại.
        </div>
      )}

      {/* Main 2-column grid */}
      <section className="grid grid-cols-1 gap-4 lg:gap-6 xl:grid-cols-3">
        {/* Left column (span-2 on xl) */}
        <div className="flex flex-col gap-4 lg:gap-6 xl:col-span-2">
          <RecentProjects
            projects={stats?.recentProjects ?? []}
            loading={statsLoading && !stats}
          />
          <TasksByStatusChart
            data={stats?.tasksByStatus ?? []}
            loading={statsLoading && !stats}
          />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4 lg:gap-6">
          <MyTasksList
            tasks={stats?.myTasks ?? []}
            loading={statsLoading && !stats}
          />
          <RecentActivity
            activities={activities ?? []}
            loading={activitiesLoading && !activities}
          />
        </div>
      </section>
    </div>
  );
}
