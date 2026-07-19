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

type Me = { id: string; name: string; username: string; email: string; image: string | null };

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
  const [username, setUsername] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState("");
  const [loaded, setLoaded] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Sync form state once data loads.
  React.useEffect(() => {
    if (me && !loaded) {
      setName(me.name);
      setUsername(me.username ?? "");
      setImageUrl(me.image ?? "");
      setLoaded(true);
    }
  }, [me, loaded]);

  const mutation = useMutation({
    mutationFn: (payload: { name?: string; username?: string; image?: string | null }) =>
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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ảnh đại diện phải nhỏ hơn 2MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn tệp hình ảnh (.jpg, .png, .webp)");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/me/avatar", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Tải ảnh lên thất bại");
      }

      const data = await res.json();
      setImageUrl(data.image);
      toast.success("Tải ảnh lên tạm thời thành công! Bấm Lưu thay đổi để hoàn tất.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tải ảnh lên thất bại");
    } finally {
      setUploading(false);
    }
  }

  function handleRemovePhoto() {
    setImageUrl("");
    toast.info("Đã gỡ ảnh đại diện tạm thời. Bấm Lưu thay đổi để hoàn tất.");
  }

  function triggerFileInput() {
    fileInputRef.current?.click();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: { name?: string; username?: string; image?: string | null } = {};
    if (name.trim() && name !== me?.name) payload.name = name.trim();
    if (username.trim() && username !== me?.username) {
      payload.username = username.trim().toLowerCase();
    }
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
    <form onSubmit={onSubmit} className="max-w-md space-y-6">
      {/* Premium Profile Photo Picker */}
      <div className="flex items-center gap-4 rounded-xl border border-dashed border-border/80 p-4 bg-muted/10">
        <div className="relative group shrink-0">
          <Avatar className="h-20 w-20 border-2 border-border/60 shadow-sm transition-transform group-hover:scale-105 duration-200">
            <AvatarImage src={imageUrl || undefined} alt={name} />
            <AvatarFallback className="text-xl font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-white animate-fade-in">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </div>
        <div className="space-y-1.5 flex-1 min-w-0">
          <p className="text-sm font-semibold">Ảnh đại diện</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-medium"
              disabled={uploading}
              onClick={triggerFileInput}
            >
              Tải ảnh lên
            </Button>
            {imageUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs font-medium text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={uploading}
                onClick={handleRemovePhoto}
              >
                Gỡ ảnh
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground leading-normal">
            Hỗ trợ PNG, JPG, WEBP tối đa 2MB. Ảnh được lưu trữ trực tiếp trên Supabase Storage.
          </p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
        </div>
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
        <Label htmlFor="username">Username / Nickname</Label>
        <Input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          maxLength={30}
          placeholder="username_123"
        />
        <p className="text-xs text-muted-foreground">
          Username chỉ gồm chữ cái, số và dấu gạch dưới, không chứa khoảng trắng hoặc ký tự đặc biệt.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={me?.email ?? ""} disabled />
        <p className="text-xs text-muted-foreground">
          Email không thể thay đổi. Liên hệ quản trị viên nếu cần.
        </p>
      </div>

      <Button type="submit" disabled={mutation.isPending || uploading}>
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
