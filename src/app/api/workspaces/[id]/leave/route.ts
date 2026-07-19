import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getApiContext, isOwner, forbidden } from "@/lib/api-context";

type Params = { params: Promise<{ id: string }> };

/** Leave a workspace (remove your own membership). Owners must transfer
 * ownership or delete the workspace instead. */
export async function DELETE(_req: Request, { params }: Params) {
  const { user, workspace, membership } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  if (id !== workspace.id) {
    return NextResponse.json({ error: "Workspace không khớp" }, { status: 400 });
  }

  // Owners can't just leave — they'd orphan the workspace.
  if (isOwner(membership)) {
    return NextResponse.json(
      {
        error:
          "Chủ workspace không thể rời đi. Hãy chuyển quyền sở hữu hoặc xóa workspace.",
      },
      { status: 400 }
    );
  }

  const { data: projects, error: projErr } = await db
    .from("Project")
    .select("id")
    .eq("workspaceId", workspace.id);

  if (projErr) throw projErr;
  const projectIds = (projects || []).map((p) => p.id);

  if (projectIds.length > 0) {
    const { error: pmErr } = await db
      .from("ProjectMember")
      .delete()
      .eq("userId", user.id)
      .in("projectId", projectIds);

    if (pmErr) throw pmErr;
  }

  const { error: memberErr } = await db
    .from("WorkspaceMember")
    .delete()
    .eq("workspaceId", workspace.id)
    .eq("userId", user.id);

  if (memberErr) throw memberErr;

  const newActivityId = crypto.randomUUID();
  const { error: actErr } = await db
    .from("Activity")
    .insert({
      id: newActivityId,
      workspaceId: workspace.id,
      userId: user.id,
      action: "left_workspace",
      entityType: "WORKSPACE",
      entityId: workspace.id,
      message: `${user.name ?? "Someone"} left the workspace`,
    });

  if (actErr) throw actErr;

  return NextResponse.json({ ok: true });
}
