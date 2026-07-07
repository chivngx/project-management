import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";

/** List the current user's notifications (newest first, max 30). */
export async function GET() {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json([]);

  const notifications = await db.notification.findMany({
    where: { userId: user.id, workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const unread = await db.notification.count({
    where: { userId: user.id, workspaceId: workspace.id, read: false },
  });

  return NextResponse.json({ items: notifications, unread });
}
