"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, Check, Plus, Layers } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-fetch";

export type WorkspaceLite = { id: string; name: string; image: string | null };

export function WorkspaceSwitcher({
  active,
  workspaces,
}: {
  active: WorkspaceLite | null;
  workspaces: WorkspaceLite[];
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  async function switchTo(id: string) {
    if (id === active?.id) return;
    setMenuOpen(false);
    try {
      await apiFetch("/api/workspaces/active", {
        method: "POST",
        body: JSON.stringify({ workspaceId: id }),
      });
      qc.invalidateQueries();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không thể chuyển workspace");
    }
  }

  async function createWorkspace() {
    if (newName.trim().length < 2) return;
    setCreating(true);
    try {
      const ws = await apiFetch<WorkspaceLite>("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim() }),
      });
      await apiFetch("/api/workspaces/active", {
        method: "POST",
        body: JSON.stringify({ workspaceId: ws.id }),
      });
      setNewName("");
      setDialogOpen(false);
      setMenuOpen(false);
      qc.invalidateQueries();
      router.refresh();
      toast.success("Đã tạo workspace mới");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tạo workspace thất bại");
    } finally {
      setCreating(false);
    }
  }

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        className="w-full justify-between gap-2 px-2 font-normal"
        disabled
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Layers className="h-4 w-4" />
          </span>
          <span className="truncate text-sm font-medium">
            {active?.name ?? "Chọn workspace"}
          </span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between gap-2 px-2 font-normal"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Layers className="h-4 w-4" />
              </span>
              <span className="truncate text-sm font-medium">
                {active?.name ?? "Chọn workspace"}
              </span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {workspaces.length === 0 && (
            <div className="px-2 py-3 text-xs text-muted-foreground">
              Chưa có workspace nào.
            </div>
          )}
          {workspaces.map((w) => (
            <DropdownMenuItem
              key={w.id}
              onClick={() => switchTo(w.id)}
              className="gap-2"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded bg-muted text-[10px] font-semibold">
                {w.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="flex-1 truncate">{w.name}</span>
              {w.id === active?.id && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setMenuOpen(false);
              setNewName("");
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Tạo workspace mới
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo workspace mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ws-name">Tên workspace</Label>
            <Input
              id="ws-name"
              placeholder="Ví dụ: Marketing Team"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={creating}
            >
              Hủy
            </Button>
            <Button
              onClick={createWorkspace}
              disabled={creating || newName.trim().length < 2}
            >
              {creating ? "Đang tạo..." : "Tạo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
