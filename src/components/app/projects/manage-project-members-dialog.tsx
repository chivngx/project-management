"use client";

import * as React from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Search, Check } from "lucide-react";

import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "./helpers";
import type { Member, ProjectDetail } from "./types";

interface ManageProjectMembersDialogProps {
  project: ProjectDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageProjectMembersDialog({
  project,
  open,
  onOpenChange,
}: ManageProjectMembersDialogProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");

  // Get all members of the active workspace
  const { data: team = [], isLoading: loadingTeam } = useQuery<Member[]>({
    queryKey: ["team"],
    queryFn: () => apiFetch<Member[]>("/api/team"),
    enabled: open,
  });

  // Track checked member IDs in local state
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  // Initialize selected IDs with current project members
  React.useEffect(() => {
    if (open) {
      const currentIds = project.members.map((m) => m.id);
      setSelectedIds(currentIds);
    }
  }, [open, project.members]);

  const updateMembersMutation = useMutation({
    mutationFn: (memberIds: string[]) =>
      apiFetch<{ success: boolean }>(`/api/projects/${project.id}/members`, {
        method: "PUT",
        body: JSON.stringify({ memberIds }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Đã cập nhật thành viên dự án");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleToggle = (memberId: string) => {
    setSelectedIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMembersMutation.mutate(selectedIds);
  };

  // Filter workspace members by search query
  const filteredTeam = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return team;
    return team.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.username && m.username.toLowerCase().includes(q))
    );
  }, [team, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Quản lý thành viên</DialogTitle>
          <DialogDescription>
            Chọn thành viên trong Workspace để tham gia dự án &ldquo;{project.name}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm thành viên theo tên, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto thin-scroll my-4 min-h-[15rem] max-h-[25rem] space-y-2.5 pr-1">
          {loadingTeam ? (
            <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground gap-2">
              <Loader2 className="size-5 animate-spin text-primary" />
              Đang tải danh sách thành viên...
            </div>
          ) : filteredTeam.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Không tìm thấy thành viên phù hợp
            </div>
          ) : (
            filteredTeam.map((m) => {
              const isChecked = selectedIds.includes(m.id);
              return (
                <div
                  key={m.id}
                  onClick={() => handleToggle(m.id)}
                  className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-muted/40 cursor-pointer transition-colors border bg-card"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => handleToggle(m.id)}
                      onClick={(e) => e.stopPropagation()} // Prevent double trigger
                      id={`cb-${m.id}`}
                    />
                    <Avatar size="sm" className="shrink-0">
                      {m.image ? (
                        <AvatarImage src={m.image} alt={m.name} />
                      ) : null}
                      <AvatarFallback>{getInitials(m.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-none truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-1">{m.email}</p>
                    </div>
                  </div>
                  {isChecked && <Check className="size-4 text-primary shrink-0 mr-1" />}
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="mt-auto border-t pt-3 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={updateMembersMutation.isPending}
          >
            {updateMembersMutation.isPending && (
              <Loader2 className="size-4 animate-spin mr-1.5" />
            )}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
