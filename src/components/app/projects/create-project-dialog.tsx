"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  PRIORITY_LABEL,
  PROJECT_STATUS_LABEL,
} from "@/lib/constants";

import { getInitials, isoToDateInput, dateInputToISO } from "./helpers";
import type { Member } from "./types";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional trigger element (controlled usage is fine too). */
  trigger?: React.ReactNode;
}

interface CreatePayload {
  name: string;
  description?: string | null;
  status?: string;
  priority?: string;
  startDate?: string | null;
  dueDate?: string | null;
  memberIds?: string[];
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  trigger,
}: CreateProjectDialogProps) {
  const queryClient = useQueryClient();

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState<string>("ACTIVE");
  const [priority, setPriority] = React.useState<string>("MEDIUM");
  const [startDate, setStartDate] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [memberIds, setMemberIds] = React.useState<string[]>([]);

  const { data: team, isLoading: teamLoading } = useQuery<Member[]>({
    queryKey: ["team"],
    queryFn: () => apiFetch<Member[]>("/api/team"),
    enabled: open,
  });

  // Reset form whenever dialog opens.
  React.useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setStatus("ACTIVE");
      setPriority("MEDIUM");
      setStartDate("");
      setDueDate("");
      setMemberIds([]);
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: (payload: CreatePayload) =>
      apiFetch<{ id: string }>("/api/projects", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Đã tạo dự án mới");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMember = (id: string) => {
    setMemberIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

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
    if (dueDate) {
      const todayStr = new Date().toLocaleDateString("en-CA");
      if (dueDate < todayStr) {
        toast.error("Ngày hạn không được trước ngày hiện tại");
        return;
      }
    }
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || null,
      status,
      priority,
      startDate: dateInputToISO(startDate),
      dueDate: dateInputToISO(dueDate),
      memberIds,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <>{trigger}</> : null}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tạo dự án mới</DialogTitle>
          <DialogDescription>
            Điền thông tin cơ bản để bắt đầu quản lý công việc.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="proj-name">
              Tên dự án <span className="text-destructive">*</span>
            </Label>
            <Input
              id="proj-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Nâng cấp hệ thống thanh toán"
              autoFocus
              required
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proj-desc">Mô tả</Label>
            <Textarea
              id="proj-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mục tiêu, phạm vi, ghi chú…"
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="proj-status">Trạng thái</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="proj-status" className="w-full">
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
              <Label htmlFor="proj-priority">Ưu tiên</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="proj-priority" className="w-full">
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
              <Label htmlFor="proj-start">Ngày bắt đầu</Label>
              <Input
                id="proj-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-due">Hạn hoàn thành</Label>
              <Input
                id="proj-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toLocaleDateString("en-CA")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Thành viên</Label>
            <p className="text-xs text-muted-foreground">
              Bạn sẽ được thêm làm thành viên tự động. Chọn thêm đồng nghiệp để
              họ cùng tham gia dự án.
            </p>
            <div className="max-h-44 overflow-y-auto thin-scroll rounded-md border">
              {teamLoading ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : !team || team.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">
                  Workspace chưa có thành viên nào khác.
                </p>
              ) : (
                <ul className="divide-y">
                  {team.map((m) => {
                    const checked = memberIds.includes(m.id);
                    return (
                      <li key={m.id}>
                        <label
                          className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-accent"
                          htmlFor={`m-${m.id}`}
                        >
                          <Checkbox
                            id={`m-${m.id}`}
                            checked={checked}
                            onCheckedChange={() => toggleMember(m.id)}
                          />
                          <Avatar size="sm">
                            {m.image ? (
                              <AvatarImage src={m.image} alt={m.name} />
                            ) : null}
                            <AvatarFallback>
                              {getInitials(m.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">
                              {m.name} ({m.username})
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {m.email}
                            </span>
                          </span>
                          {m.role && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                              {m.role}
                            </span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {memberIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Đã chọn {memberIds.length} thành viên.
              </p>
            )}
          </div>

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
              Tạo dự án
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Re-export helper for callers that need to convert dates back for display.
export { isoToDateInput };
