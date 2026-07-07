"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  ListTodo,
  Settings,
  Plus,
  Moon,
  Sun,
  LogOut,
  Search,
} from "lucide-react";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function CommandPalette() {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const [open, setOpen] = React.useState(false);

  // Cmd/Ctrl+K to open.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const go = (href: string) => run(() => router.push(href));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="overflow-hidden p-0 shadow-lg sm:max-w-lg"
        // Hide the default close button to keep the palette minimal.
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Bảng lệnh</DialogTitle>
        <Command
          label="Bảng lệnh"
          className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-input-wrapper]]:px-3 [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2 [&_[cmdk-item]]:gap-2.5 [&_[cmdk-list]]:max-h-80"
        >
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              autoFocus
              placeholder="Nhập lệnh hoặc tìm trang…"
              className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="thin-scroll overflow-y-auto">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              Không tìm thấy.
            </Command.Empty>

            <Command.Group heading="Điều hướng">
              <Command.Item onSelect={() => go("/")} value="dashboard trang chủ">
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </Command.Item>
              <Command.Item onSelect={() => go("/projects")} value="dự án projects">
                <FolderKanban className="h-4 w-4" /> Dự án
              </Command.Item>
              <Command.Item onSelect={() => go("/my-tasks")} value="tác vụ của tôi my tasks">
                <ListTodo className="h-4 w-4" /> Tác vụ của tôi
              </Command.Item>
              <Command.Item onSelect={() => go("/team")} value="đội nhóm team members">
                <Users className="h-4 w-4" /> Đội nhóm
              </Command.Item>
              <Command.Item onSelect={() => go("/settings")} value="cài đặt settings">
                <Settings className="h-4 w-4" /> Cài đặt
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Tạo mới">
              <Command.Item onSelect={() => go("/projects")} value="tạo dự án mới">
                <Plus className="h-4 w-4" /> Tạo dự án mới
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Giao diện">
              <Command.Item
                onSelect={() =>
                  run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))
                }
                value="đổi giao diện sáng tối theme"
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
                {resolvedTheme === "dark" ? "Giao diện sáng" : "Giao diện tối"}
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Tài khoản">
              <Command.Item
                onSelect={() =>
                  run(async () => {
                    await signOut({ redirect: false });
                    router.replace("/login");
                  })
                }
                value="đăng xuất logout"
              >
                <LogOut className="h-4 w-4" /> Đăng xuất
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
