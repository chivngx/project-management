import { NextResponse } from "next/server";
import { ActivityRepository } from "@/repositories/activity.repository";
import { getApiContext } from "@/lib/api-context";

export async function GET() {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json([]);

  try {
    const activities = await ActivityRepository.findByWorkspaceId(workspace.id, 12);
    return NextResponse.json(
      activities.map((a: any) => ({
        id: a.id,
        action: a.action,
        message: a.message,
        createdAt: a.createdAt,
        userName: a.user?.name ?? null,
        userImage: a.user?.image ?? null,
      }))
    );
  } catch (e: any) {
    console.error("List activities error:", e);
    return NextResponse.json({ error: "Lỗi tải lịch sử hoạt động" }, { status: 500 });
  }
}
