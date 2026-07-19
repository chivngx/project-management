import { requireUser } from "@/lib/session";
import { getActiveWorkspace } from "@/lib/workspace";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { GlobalSearch } from "@/components/global-search";
import { CommandPalette } from "@/components/command-palette";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { CreateWorkspaceFallback } from "@/components/create-workspace-fallback";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const { workspace, workspaces } = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <CreateWorkspaceFallback />;
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
