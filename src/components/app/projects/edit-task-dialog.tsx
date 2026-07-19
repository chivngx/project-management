"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save, GitBranch, Copy, Check, ExternalLink } from "lucide-react";

import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  PRIORITY_LABEL,
  TASK_PRIORITIES,
  TASK_STATUS_LABEL,
  TASK_STATUSES,
} from "@/lib/constants";

import { getInitials, isoToDateInput, dateInputToISO } from "./helpers";
import type { Member, Task } from "./types";

interface EditTaskDialogProps {
  task: Task;
  members: Member[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
  canEdit?: boolean;
}

interface PatchPayload {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
}

export function EditTaskDialog({
  task,
  members,
  open,
  onOpenChange,
  trigger,
  canEdit = true,
}: EditTaskDialogProps) {
  const queryClient = useQueryClient();

  const [title, setTitle] = React.useState(task.title);
  const [description, setDescription] = React.useState(task.description ?? "");
  const [status, setStatus] = React.useState<string>(task.status);
  const [priority, setPriority] = React.useState<string>(task.priority);
  const [assigneeId, setAssigneeId] = React.useState<string>(task.assigneeId ?? "__none__");
  const [dueDate, setDueDate] = React.useState(isoToDateInput(task.dueDate));

  const [creatingBranch, setCreatingBranch] = React.useState(false);
  const [createdBranchName, setCreatedBranchName] = React.useState("");
  const [copiedBranch, setCopiedBranch] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setStatus(task.status);
      setPriority(task.priority);
      setAssigneeId(task.assigneeId ?? "__none__");
      setDueDate(isoToDateInput(task.dueDate));
      setCreatedBranchName("");
      setCopiedBranch(false);
      setCreatingBranch(false);
    }
  }, [open, task]);

  const patchMutation = useMutation({
    mutationFn: (payload: PatchPayload) =>
      apiFetch<{ id: string }>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      // Invalidate both the parent project and any board-level queries.
      queryClient.invalidateQueries({ queryKey: ["project", task.projectId] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Đã cập nhật tác vụ");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) {
      toast.error("Tiêu đề tác vụ phải có ít nhất 2 ký tự");
      return;
    }
    if (dueDate) {
      const todayStr = new Date().toLocaleDateString("en-CA");
      if (dueDate < todayStr) {
        toast.error("Ngày hạn không được trước ngày hiện tại");
        return;
      }
    }
    patchMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      assigneeId: assigneeId === "__none__" ? null : assigneeId,
      dueDate: dateInputToISO(dueDate),
    });
  };

  const handleCreateBranch = async () => {
    setCreatingBranch(true);
    try {
      const res = await apiFetch<any>(`/api/tasks/${task.id}/git/branch`, {
        method: "POST",
      });
      if (res.error) throw new Error(res.error);
      setCreatedBranchName(res.branchName);
      if (res.alreadyExists) {
        toast.info("Nhánh Git này đã tồn tại trên repository.");
      } else {
        toast.success("Đã tạo nhánh Git thành công!");
      }
    } catch (e: any) {
      toast.error(e.message || "Không thể tạo nhánh Git");
    } finally {
      setCreatingBranch(false);
    }
  };

  const handleCopyBranchName = () => {
    if (!createdBranchName) return;
    navigator.clipboard.writeText(createdBranchName);
    setCopiedBranch(true);
    toast.success("Đã sao chép tên nhánh");
    setTimeout(() => setCopiedBranch(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <>{trigger}</> : null}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa tác vụ</DialogTitle>
          <DialogDescription>
            Cập nhật thông tin chi tiết của tác vụ.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!canEdit && (
            <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground border">
              Bạn đang xem tác vụ ở chế độ <strong>chỉ đọc</strong> vì không phải là người tạo, người được giao, hoặc quản trị viên.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="task-title">
              Tiêu đề <span className="text-destructive">*</span>
            </Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              autoFocus
              disabled={!canEdit}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-desc">Mô tả</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              disabled={!canEdit}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="task-status">Trạng thái</Label>
              <Select value={status} onValueChange={setStatus} disabled={!canEdit}>
                <SelectTrigger id="task-status" className="w-full">
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
            <div className="space-y-2">
              <Label htmlFor="task-priority">Ưu tiên</Label>
              <Select value={priority} onValueChange={setPriority} disabled={!canEdit}>
                <SelectTrigger id="task-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="task-assignee">Người phụ trách</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId} disabled={!canEdit}>
                <SelectTrigger id="task-assignee" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Chưa giao</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-due">Hạn hoàn thành</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toLocaleDateString("en-CA")}
                disabled={!canEdit}
              />
            </div>
          </div>

          {task.assignee && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
              <Avatar size="sm">
                {task.assignee.image ? (
                  <AvatarImage src={task.assignee.image} alt={task.assignee.name} />
                ) : null}
                <AvatarFallback>{getInitials(task.assignee.name)}</AvatarFallback>
              </Avatar>
              <span>
                Được giao cho{" "}
                <span className="font-medium text-foreground">
                  {task.assignee.name} ({task.assignee.username})
                </span>
              </span>
            </div>
          )}

          {/* Git Integration Section */}
          {task.externalNumber && (
            <div className="space-y-2 rounded-md border p-3 bg-accent/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <GitBranch className="size-4 text-muted-foreground" />
                  Tích hợp Git ({task.externalProvider === "github" ? "GitHub" : "GitLab"})
                </span>
                <a
                  href={task.externalUrl || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  #{task.externalNumber}
                  <ExternalLink className="size-3" />
                </a>
              </div>

              {!createdBranchName ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCreateBranch}
                  disabled={creatingBranch || !canEdit}
                  className="w-full flex items-center gap-2 justify-center text-xs h-8"
                >
                  {creatingBranch ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <GitBranch className="size-3.5" />
                  )}
                  Tạo nhánh Git mới
                </Button>
              ) : (
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 bg-background border rounded px-2 py-1 text-[11px] font-mono select-all truncate">
                    {createdBranchName}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyBranchName}
                    className="size-7 shrink-0 border"
                  >
                    {copiedBranch ? (
                      <Check className="size-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {canEdit ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Hủy
                </Button>
                <Button type="submit" disabled={patchMutation.isPending}>
                  {patchMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Lưu thay đổi
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Đóng
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
