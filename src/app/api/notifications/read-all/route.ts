import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";

/** Mark all of the current user's notifications (in the active workspace) as read. */
export async function PATCH() {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ ok: true });

  const { error } = await db
    .from("Notification")
    .update({ read: true })
    .eq("userId", user.id)
    .eq("workspaceId", workspace.id)
    .eq("read", false);

  if (error) throw error;

  return NextResponse.json({ ok: true });
}
