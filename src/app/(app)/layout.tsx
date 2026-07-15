import { requireUser } from "@/lib/session";
import { getActiveWorkspace } from "@/lib/workspace";
import dynamic from "next/dynamic";
import { GlobalSearch } from "@/components/global-search";
import { CommandPalette } from "@/components/command-palette";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const AppSidebar = dynamic(
  () => import("@/components/app-sidebar").then((mod) => mod.AppSidebar),
  { ssr: false }
);

const NotificationBell = dynamic(
  () => import("@/components/notification-bell").then((mod) => mod.NotificationBell),
  { ssr: false }
);

const ThemeToggle = dynamic(
  () => import("@/components/theme-toggle").then((mod) => mod.ThemeToggle),
  { ssr: false }
);

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const { workspace, workspaces } = await getActiveWorkspace(user.id);

  if (!workspace) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center space-y-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <span className="text-2xl">🏗️</span>
          </div>
          <h1 className="text-xl font-semibold">Chưa có workspace</h1>
          <p className="text-sm text-muted-foreground">
            Vui lòng đăng xuất và đăng ký lại, hoặc liên hệ quản trị viên.
          </p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        }}
        activeWorkspace={workspace}
        workspaces={workspaces}
      />
      <SidebarInset>
        {/* Sticky topbar with glassmorphism */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md backdrop-saturate-150">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
          <Separator orientation="vertical" className="h-5 opacity-50" />
          <GlobalSearch />
          <div className="flex-1" />
          <NotificationBell />
          <ThemeToggle />
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
        <CommandPalette />
      </SidebarInset>
    </SidebarProvider>
  );
}
