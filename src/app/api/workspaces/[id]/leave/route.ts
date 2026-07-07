import { NextResponse } from "next/server";
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

  await db.$transaction([
    db.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    }),
    db.projectMember.deleteMany({
      where: { userId: user.id, project: { workspaceId: workspace.id } },
    }),
    db.activity.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        action: "left_workspace",
        entityType: "WORKSPACE",
        entityId: workspace.id,
        message: `${user.name ?? "Someone"} left the workspace`,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
