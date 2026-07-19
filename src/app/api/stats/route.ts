import { NextResponse } from "next/server";
import { StatsService } from "@/services/stats.service";
import { getApiContext } from "@/lib/api-context";

/** Dashboard stats for the active workspace. */
export async function GET() {
  const { user, workspace, membership } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace)
    return NextResponse.json({
      totals: {
        projects: 0,
        activeProjects: 0,
        completedProjects: 0,
        tasks: 0,
        doneTasks: 0,
        inProgressTasks: 0,
        overdueTasks: 0,
        members: 0,
      },
      recentProjects: [],
      myTasks: [],
      tasksByStatus: [],
    });

  try {
    const isOwnerOrAdmin = membership?.role === "OWNER" || membership?.role === "ADMIN";
    const stats = await StatsService.getDashboardStats(workspace.id, user.id, isOwnerOrAdmin);
    return NextResponse.json(stats);
  } catch (e: any) {
    console.error("Dashboard stats calculation error:", e);
    return NextResponse.json({ error: "Lỗi tính toán thống kê" }, { status: 500 });
  }
}
