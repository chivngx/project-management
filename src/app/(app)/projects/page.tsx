"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FolderKanban, Plus, Search } from "lucide-react";

import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRIORITY_LABEL,
  PROJECT_PRIORITIES,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUSES,
} from "@/lib/constants";

import {
  ProjectCard,
  ProjectCardSkeleton,
} from "@/components/app/projects/project-card";
import { CreateProjectDialog } from "@/components/app/projects/create-project-dialog";
import type { ProjectListItem } from "@/components/app/projects/types";

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<string>("ALL");
  const [priority, setPriority] = React.useState<string>("ALL");
  const [createOpen, setCreateOpen] = React.useState(false);

  const { data: projects, isLoading } = useQuery<ProjectListItem[]>({
    queryKey: ["projects"],
    queryFn: () => apiFetch<ProjectListItem[]>("/api/projects"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Đã xóa dự án");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = React.useMemo(() => {
    if (!projects) return [];
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (q) {
        const haystack = `${p.name} ${p.description ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (status !== "ALL" && p.status !== status) return false;
      if (priority !== "ALL" && p.priority !== priority) return false;
      return true;
    });
  }, [projects, search, status, priority]);

  const total = projects?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Dự án
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Đang tải danh sách dự án…"
              : total === 0
                ? "Quản lý tất cả dự án trong workspace hiện tại."
                : `${total} dự án · hiển thị ${filtered.length} kết quả`}
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          size="sm"
          className="shrink-0"
        >
          <Plus className="size-4" />
          Dự án mới
        </Button>
      </header>

      {/* Toolbar */}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc mô tả…"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
            {PROJECT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {PROJECT_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Ưu tiên" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả ưu tiên</SelectItem>
            {PROJECT_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          hasProjects={total > 0}
          onCreate={() => setCreateOpen(true)}
          onReset={() => {
            setSearch("");
            setStatus("ALL");
            setPriority("ALL");
          }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onDelete={(id) => deleteMutation.mutate(id)}
              deleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

interface EmptyStateProps {
  hasProjects: boolean;
  onCreate: () => void;
  onReset: () => void;
}

function EmptyState({ hasProjects, onCreate, onReset }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <FolderKanban className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {hasProjects
            ? "Không tìm thấy dự án phù hợp"
            : "Chưa có dự án nào"}
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          {hasProjects
            ? "Thử thay đổi từ khoá hoặc bỏ bộ lọc để xem tất cả dự án."
            : "Tạo dự án đầu tiên để bắt đầu quản lý công việc cùng đội nhóm."}
        </p>
      </div>
      {hasProjects ? (
        <Button variant="outline" size="sm" onClick={onReset}>
          Xoá bộ lọc
        </Button>
      ) : (
        <Button size="sm" onClick={onCreate}>
          <Plus className="size-4" />
          Tạo dự án đầu tiên
        </Button>
      )}
    </div>
  );
}
