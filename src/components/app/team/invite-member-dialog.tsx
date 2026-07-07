"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface InviteMemberDialogProps {
  /** Controlled open state. If omitted, the component manages its own state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function InviteMemberDialog({
  open: openProp,
  onOpenChange,
}: InviteMemberDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (isControlled) onOpenChange?.(next);
      else setInternalOpen(next);
    },
    [isControlled, onOpenChange]
  );

  const [email, setEmail] = React.useState("");
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const queryClient = useQueryClient();

  const inviteMutation = useMutation({
    mutationFn: (targetEmail: string) =>
      apiFetch<{ ok: true }>("/api/team", {
        method: "POST",
        body: JSON.stringify({ email: targetEmail }),
      }),
    onSuccess: () => {
      toast.success("Đã thêm thành viên vào workspace.");
      queryClient.invalidateQueries({ queryKey: ["team"] });
      // Member count changed + activity logged.
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      setOpen(false);
      setEmail("");
      setValidationError(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Không thể mời thành viên.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setValidationError("Vui lòng nhập email.");
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setValidationError("Email không hợp lệ.");
      return;
    }
    setValidationError(null);
    inviteMutation.mutate(trimmed);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setEmail("");
      setValidationError(null);
      inviteMutation.reset();
    }
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" />
          Mời thành viên
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mời thành viên</DialogTitle>
          <DialogDescription>
            Nhập email của thành viên đã đăng ký tài khoản. Họ phải tạo tài khoản
            trước khi được thêm vào workspace.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-1.5">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="email@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (validationError) setValidationError(null);
            }}
            disabled={inviteMutation.isPending}
            aria-invalid={Boolean(validationError)}
          />
          {validationError ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              {validationError}
            </p>
          ) : null}
          <DialogFooter className="pt-4 gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={inviteMutation.isPending}>
                Hủy
              </Button>
            </DialogClose>
            <Button type="submit" disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Đang mời…
                </>
              ) : (
                "Gửi lời mời"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
