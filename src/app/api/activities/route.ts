import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";

export async function GET() {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json([]);

  const { data: rawActivities, error } = await db
    .from("Activity")
    .select("*, user:User(name, image)")
    .eq("workspaceId", workspace.id)
    .order("createdAt", { ascending: false })
    .limit(12);

  if (error) throw error;
  const activities = (rawActivities || []) as any[];

  return NextResponse.json(
    activities.map((a) => ({
      id: a.id,
      action: a.action,
      message: a.message,
      createdAt: a.createdAt,
      userName: a.user?.name ?? null,
      userImage: a.user?.image ?? null,
    }))
  );
}
