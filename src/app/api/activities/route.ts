import { NextResponse } from "next/server";
import { ActivityRepository } from "@/repositories/activity.repository";
import { ProjectRepository } from "@/repositories/project.repository";
import { getApiContext } from "@/lib/api-context";
import { db } from "@/lib/db";

export async function GET() {
  const { user, workspace, membership } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json([]);

  try {
    const activities = await ActivityRepository.findByWorkspaceId(workspace.id, 50); // fetch slightly more to allow filtering

    const isOwnerOrAdmin = membership?.role === "OWNER" || membership?.role === "ADMIN";
    if (isOwnerOrAdmin) {
      return NextResponse.json(activities.slice(0, 12).map(mapActivity));
    }

    // Member: get all projects the user is in
    const userProjects = await ProjectRepository.findByWorkspaceId(workspace.id);
    const myProjectIds = userProjects
      .filter((p: any) => (p.members || []).some((m: any) => m.userId === user.id))
      .map((p: any) => p.id);

    // Get project mapping for tasks
    const taskIds = activities.filter((a: any) => a.entityType === "TASK").map((a: any) => a.entityId);
    let taskProjectMap: Record<string, string> = {};
    if (taskIds.length > 0) {
      const { data: tasksData } = await db.from("Task").select("id, projectId").in("id", taskIds);
      if (tasksData) {
        tasksData.forEach((t: any) => {
          taskProjectMap[t.id] = t.projectId;
        });
      }
    }

    // Filter activities
    const filtered = activities.filter((a: any) => {
      if (a.entityType === "WORKSPACE") return true;
      if (a.entityType === "PROJECT") return myProjectIds.includes(a.entityId);
      if (a.entityType === "TASK") {
        const pid = taskProjectMap[a.entityId];
        return pid && myProjectIds.includes(pid);
      }
      return false;
    });

    return NextResponse.json(filtered.slice(0, 12).map(mapActivity));
  } catch (e: any) {
    console.error("List activities error:", e);
    return NextResponse.json({ error: "Lỗi tải lịch sử hoạt động" }, { status: 500 });
  }
}

function mapActivity(a: any) {
  return {
    id: a.id,
    action: a.action,
    message: a.message,
    createdAt: a.createdAt,
    userName: a.user?.name ?? null,
    userImage: a.user?.image ?? null,
  };
}
