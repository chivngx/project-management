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
import {
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  PRIORITY_LABEL,
  PROJECT_STATUS_LABEL,
} from "@/lib/constants";

import { isoToDateInput, dateInputToISO } from "./helpers";
import type { ProjectDetail } from "./types";

interface ProjectSettingsDialogProps {
  project: ProjectDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
}

interface PatchPayload {
  name?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  startDate?: string | null;
  dueDate?: string | null;
}

export function ProjectSettingsDialog({
  project,
  open,
  onOpenChange,
  trigger,
}: ProjectSettingsDialogProps) {
  const queryClient = useQueryClient();

  const [name, setName] = React.useState(project.name);
  const [description, setDescription] = React.useState(project.description ?? "");
  const [status, setStatus] = React.useState<string>(project.status);
  const [priority, setPriority] = React.useState<string>(project.priority);
  const [startDate, setStartDate] = React.useState(
    isoToDateInput(project.startDate)
  );
  const [dueDate, setDueDate] = React.useState(isoToDateInput(project.dueDate));

  // Re-sync local state whenever the dialog opens or the project changes.
  React.useEffect(() => {
    if (open) {
      setName(project.name);
      setDescription(project.description ?? "");
      setStatus(project.status);
      setPriority(project.priority);
      setStartDate(isoToDateInput(project.startDate));
      setDueDate(isoToDateInput(project.dueDate));
    }
  }, [open, project]);

  const patchMutation = useMutation({
    mutationFn: (payload: PatchPayload) =>
      apiFetch<{ id: string }>(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Đã cập nhật dự án");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error("Tên dự án phải có ít nhất 2 ký tự");
      return;
    }
    if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
      toast.error("Ngày kết thúc không được trước ngày bắt đầu");
      return;
    }
    patchMutation.mutate({
      name: name.trim(),
      description: description.trim() || null,
      status,
      priority,
      startDate: dateInputToISO(startDate),
      dueDate: dateInputToISO(dueDate),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <>{trigger}</> : null}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cài đặt dự án</DialogTitle>
          <DialogDescription>
            Chỉnh sửa thông tin chi tiết của dự án.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">
              Tên dự án <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-desc">Mô tả</Label>
            <Textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-status">Trạng thái</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="edit-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PROJECT_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-priority">Ưu tiên</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="edit-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_PRIORITIES.map((p) => (
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
              <Label htmlFor="edit-start">Ngày bắt đầu</Label>
              <Input
                id="edit-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-due">Hạn hoàn thành</Label>
              <Input
                id="edit-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

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
