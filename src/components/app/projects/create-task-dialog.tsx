"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

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
import {
  PRIORITY_LABEL,
  TASK_PRIORITIES,
  TASK_STATUS_LABEL,
  TASK_STATUSES,
} from "@/lib/constants";

import { dateInputToISO } from "./helpers";
import type { Member } from "./types";

interface CreateTaskDialogProps {
  projectId: string;
  members: Member[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
}

interface CreatePayload {
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
}

export function CreateTaskDialog({
  projectId,
  members,
  open,
  onOpenChange,
  trigger,
}: CreateTaskDialogProps) {
  const queryClient = useQueryClient();

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState<string>("TODO");
  const [priority, setPriority] = React.useState<string>("MEDIUM");
  const [assigneeId, setAssigneeId] = React.useState<string>("__none__");
  const [dueDate, setDueDate] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setStatus("TODO");
      setPriority("MEDIUM");
      setAssigneeId("__none__");
      setDueDate("");
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: (payload: CreatePayload) =>
      apiFetch<{ id: string }>(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Đã thêm tác vụ mới");
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
    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      assigneeId: assigneeId === "__none__" ? null : assigneeId,
      dueDate: dateInputToISO(dueDate),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <>{trigger}</> : null}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Thêm tác vụ mới</DialogTitle>
          <DialogDescription>
            Tạo một tác vụ và giao cho thành viên trong dự án.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-task-title">
              Tiêu đề <span className="text-destructive">*</span>
            </Label>
            <Input
              id="new-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Viết test cho API đăng nhập"
              required
              maxLength={120}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-task-desc">Mô tả</Label>
            <Textarea
              id="new-task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="new-task-status">Trạng thái</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="new-task-status" className="w-full">
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
              <Label htmlFor="new-task-priority">Ưu tiên</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="new-task-priority" className="w-full">
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
              <Label htmlFor="new-task-assignee">Người phụ trách</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger id="new-task-assignee" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Chưa giao</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-task-due">Hạn hoàn thành</Label>
              <Input
                id="new-task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {members.length === 0 && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              Dự án chưa có thành viên nào ngoài bạn. Hãy thêm thành viên từ
              workspace để có thể giao tác vụ.
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Thêm tác vụ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
