"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-fetch";

export function SecurityTab() {
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const { data: me, isLoading } = useQuery<any>({
    queryKey: ["me"],
    queryFn: () => apiFetch("/api/me"),
  });

  const mutation = useMutation({
    mutationFn: (payload: {
      currentPassword?: string;
      newPassword: string;
    }) =>
      apiFetch("/api/me/password", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success("Đã thiết lập mật khẩu thành công!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setError(null);
      // Reload page to refresh query cache if necessary
      window.location.reload();
    },
    onError: (e: Error) => {
      setError(e.message);
    },
  });

  const hasPassword = me?.hasPassword ?? true;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }
    if (newPassword !== confirm) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }
    mutation.mutate({
      currentPassword: hasPassword ? currentPassword : "",
      newPassword,
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang tải…
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <KeyRound className="h-4 w-4" />
        <span>
          {hasPassword
            ? "Đổi mật khẩu đăng nhập của bạn."
            : "Tài khoản của bạn đăng nhập bằng Google. Hãy thiết lập mật khẩu đăng nhập tại đây."}
        </span>
      </div>

      {hasPassword && (
        <div className="space-y-2">
          <Label htmlFor="current">Mật khẩu hiện tại</Label>
          <Input
            id="current"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="new">Mật khẩu mới</Label>
        <Input
          id="new"
          type="password"
          placeholder="Ít nhất 6 ký tự"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Xác nhận mật khẩu mới</Label>
        <Input
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {hasPassword ? "Đổi mật khẩu" : "Thiết lập mật khẩu mới"}
      </Button>
    </form>
  );
}
