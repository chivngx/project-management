import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";

/** List the current user's notifications (newest first, max 30). */
export async function GET() {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ items: [], unread: 0 });

  const { data: notifications, error: listErr } = await db
    .from("Notification")
    .select("*")
    .eq("userId", user.id)
    .eq("workspaceId", workspace.id)
    .order("createdAt", { ascending: false })
    .limit(30);

  if (listErr) throw listErr;

  const { count: unread, error: countErr } = await db
    .from("Notification")
    .select("*", { count: "exact", head: true })
    .eq("userId", user.id)
    .eq("workspaceId", workspace.id)
    .eq("read", false);

  if (countErr) throw countErr;

  return NextResponse.json({ items: notifications || [], unread: unread || 0 });
}
