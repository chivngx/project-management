"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiFetch } from "@/lib/api-fetch";

type Me = { id: string; name: string; email: string; image: string | null };

function initials(name?: string | null) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProfileTab() {
  const qc = useQueryClient();
  const { data: me, isLoading } = useQuery<Me>({
    queryKey: ["me"],
    queryFn: () => apiFetch("/api/me"),
  });

  const [name, setName] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState("");
  const [loaded, setLoaded] = React.useState(false);

  // Sync form state once data loads.
  React.useEffect(() => {
    if (me && !loaded) {
      setName(me.name);
      setImageUrl(me.image ?? "");
      setLoaded(true);
    }
  }, [me, loaded]);

  const mutation = useMutation({
    mutationFn: (payload: { name?: string; image?: string | null }) =>
      apiFetch<Me>("/api/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: (updated) => {
      toast.success("Đã cập nhật hồ sơ");
      qc.setQueryData(["me"], updated);
      qc.invalidateQueries({ queryKey: ["me"] });
      // Refresh server components so the sidebar user menu updates.
      window.location.reload();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: { name?: string; image?: string | null } = {};
    if (name.trim() && name !== me?.name) payload.name = name.trim();
    if (imageUrl !== (me?.image ?? "")) {
      payload.image = imageUrl.trim() === "" ? null : imageUrl.trim();
    }
    if (Object.keys(payload).length === 0) {
      toast.info("Không có thay đổi");
      return;
    }
    mutation.mutate(payload);
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
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={imageUrl || undefined} alt={name} />
          <AvatarFallback className="text-lg">{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>Ảnh đại diện</p>
          <p className="text-xs">
            Dán URL ảnh (avatar). Hỗ trợ upload file sẽ có sau.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="image">URL ảnh đại diện</Label>
        <Input
          id="image"
          placeholder="https://example.com/avatar.jpg"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Dán đường dẫn ảnh trực tiếp (.jpg, .png, .webp). Hỗ trợ upload file sẽ có sau.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Họ và tên</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={me?.email ?? ""} disabled />
        <p className="text-xs text-muted-foreground">
          Email không thể thay đổi. Liên hệ quản trị viên nếu cần.
        </p>
      </div>

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Lưu thay đổi
      </Button>
    </form>
  );
}
