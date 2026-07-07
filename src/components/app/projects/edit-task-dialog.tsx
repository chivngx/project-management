"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

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
}: EditTaskDialogProps) {
  const queryClient = useQueryClient();

  const [title, setTitle] = React.useState(task.title);
  const [description, setDescription] = React.useState(task.description ?? "");
  const [status, setStatus] = React.useState<string>(task.status);
  const [priority, setPriority] = React.useState<string>(task.priority);
  const [assigneeId, setAssigneeId] = React.useState<string>(task.assigneeId ?? "__none__");
  const [dueDate, setDueDate] = React.useState(isoToDateInput(task.dueDate));

  React.useEffect(() => {
    if (open) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setStatus(task.status);
      setPriority(task.priority);
      setAssigneeId(task.assigneeId ?? "__none__");
      setDueDate(isoToDateInput(task.dueDate));
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
    patchMutation.mutate({
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
          <DialogTitle>Chỉnh sửa tác vụ</DialogTitle>
          <DialogDescription>
            Cập nhật thông tin chi tiết của tác vụ.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="task-status">Trạng thái</Label>
              <Select value={status} onValueChange={setStatus}>
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
              <Select value={priority} onValueChange={setPriority}>
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
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger id="task-assignee" className="w-full">
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
              <Label htmlFor="task-due">Hạn hoàn thành</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
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
                  {task.assignee.name}
                </span>
              </span>
            </div>
          )}

          <DialogFooter>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
