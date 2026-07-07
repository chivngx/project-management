import { requireUser } from "@/lib/session";
import { getActiveWorkspace } from "@/lib/workspace";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const { workspace, workspaces } = await getActiveWorkspace(user.id);

  // Edge case: user has no workspace at all (shouldn't normally happen since
  // register creates one). Show a friendly prompt.
  if (!workspace) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">Chưa có workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">
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
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex-1" />
          <ThemeToggle />
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
