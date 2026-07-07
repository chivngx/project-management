"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, Save, Trash2, LogOut, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiFetch } from "@/lib/api-fetch";

type WsLite = { id: string; name: string; image: string | null };
type Member = { id: string; name: string | null; email: string; role: string };

export function WorkspaceTab({
  activeWorkspace,
  currentUserRole,
}: {
  activeWorkspace?: WsLite;
  currentUserRole?: string;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const isOwner = currentUserRole === "OWNER";
  const [name, setName] = React.useState("");
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (activeWorkspace && !loaded) {
      setName(activeWorkspace.name);
      setLoaded(true);
    }
  }, [activeWorkspace, loaded]);

  // Fetch members for ownership transfer.
  const { data: members } = useQuery<Member[]>({
    queryKey: ["team"],
    queryFn: () => apiFetch("/api/team"),
    enabled: isOwner,
  });

  const [newOwnerId, setNewOwnerId] = React.useState("");
  const [deleteConfirm, setDeleteConfirm] = React.useState("");

  const renameMutation = useMutation({
    mutationFn: (newName: string) =>
      apiFetch(`/api/workspaces/${activeWorkspace?.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: newName }),
      }),
    onSuccess: () => {
      toast.success("Đã đổi tên workspace");
      qc.invalidateQueries();
      window.location.reload();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const transferMutation = useMutation({
    mutationFn: (ownerId: string) =>
      apiFetch(`/api/workspaces/${activeWorkspace?.id}`, {
        method: "PATCH",
        body: JSON.stringify({ newOwnerId: ownerId }),
      }),
    onSuccess: () => {
      toast.success("Đã chuyển quyền sở hữu");
      qc.invalidateQueries();
      router.replace("/");
      router.refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const leaveMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/workspaces/${activeWorkspace?.id}/leave`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Đã rời workspace");
      qc.invalidateQueries();
      router.replace("/");
      router.refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/workspaces/${activeWorkspace?.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success("Đã xóa workspace");
      await signOut({ redirect: false });
      router.replace("/login");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!activeWorkspace) {
    return <p className="text-sm text-muted-foreground">Không có workspace hoạt động.</p>;
  }

  const otherMembers = (members ?? []).filter((m) => m.role !== "OWNER");

  return (
    <div className="max-w-xl space-y-8">
      {/* Rename */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Tên workspace</h3>
        {isOwner ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim() && name !== activeWorkspace.name) {
                renameMutation.mutate(name.trim());
              }
            }}
            className="flex gap-2"
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} minLength={2} />
            <Button type="submit" disabled={renameMutation.isPending}>
              {renameMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Lưu
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            {activeWorkspace.name}{" "}
            <span className="text-xs">(chỉ chủ workspace mới được đổi tên)</span>
          </p>
        )}
      </section>

      {/* Transfer ownership */}
      {isOwner && otherMembers.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Crown className="h-4 w-4" /> Chuyển quyền sở hữu
          </h3>
          <p className="text-xs text-muted-foreground">
            Bạn sẽ trở thành Admin sau khi chuyển. Hành động không thể hoàn tác.
          </p>
          <div className="flex gap-2">
            <Select value={newOwnerId} onValueChange={setNewOwnerId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Chọn thành viên mới" />
              </SelectTrigger>
              <SelectContent>
                {otherMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name ?? m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={!newOwnerId || transferMutation.isPending}>
                  Chuyển
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Chuyển quyền sở hữu?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Bạn sẽ không còn là chủ workspace. Hành động không thể hoàn tác.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => newOwnerId && transferMutation.mutate(newOwnerId)}
                    disabled={transferMutation.isPending}
                  >
                    {transferMutation.isPending ? "Đang chuyển…" : "Xác nhận"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </section>
      )}

      {/* Leave workspace */}
      {!isOwner && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Rời workspace</h3>
          <p className="text-xs text-muted-foreground">
            Bạn sẽ mất quyền truy cập vào tất cả dự án và thành viên trong workspace này.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">
                <LogOut className="mr-2 h-4 w-4" /> Rời workspace
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Rời workspace?</AlertDialogTitle>
                <AlertDialogDescription>
                  Hành động không thể hoàn tác. Bạn sẽ cần được mời lại để quay lại.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={leaveMutation.isPending}>Hủy</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => leaveMutation.mutate()}
                  disabled={leaveMutation.isPending}
                >
                  {leaveMutation.isPending ? "Đang xử lý…" : "Rời workspace"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      )}

      {/* Delete workspace (owner only) */}
      {isOwner && (
        <section className="space-y-3 border-t pt-6">
          <h3 className="text-sm font-semibold text-destructive">Xóa workspace</h3>
          <p className="text-xs text-muted-foreground">
            Xóa vĩnh viễn workspace, tất cả dự án, tác vụ và thành viên. Hành động không thể hoàn tác.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Xóa workspace
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Xóa workspace "{activeWorkspace.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tất cả dữ liệu sẽ bị xóa vĩnh viễn. Nhập tên workspace để xác nhận.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={activeWorkspace.name}
              />
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteMutation.isPending}>Hủy</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  disabled={
                    deleteMutation.isPending || deleteConfirm !== activeWorkspace.name
                  }
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteMutation.isPending ? "Đang xóa…" : "Xóa vĩnh viễn"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      )}
    </div>
  );
}
