import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getApiContext, isOwner, forbidden } from "@/lib/api-context";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  // Transfer ownership to another workspace member.
  newOwnerId: z.string().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  const { user, workspace, membership } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  // The path id should match the active workspace id (defense-in-depth).
  const { id } = await params;
  if (id !== workspace.id) {
    return NextResponse.json({ error: "Workspace không khớp" }, { status: 400 });
  }

  // Only OWNER may rename or transfer ownership.
  if (!isOwner(membership)) return forbidden("Chỉ chủ workspace mới được thay đổi");

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );

  // Transfer ownership if requested.
  if (parsed.data.newOwnerId) {
    const newOwner = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: parsed.data.newOwnerId,
        },
      },
    });
    if (!newOwner)
      return NextResponse.json({ error: "Thành viên không hợp lệ" }, { status: 400 });

    await db.$transaction([
      db.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
        data: { role: "ADMIN" },
      }),
      db.workspaceMember.update({
        where: {
          workspaceId_userId: { workspaceId: workspace.id, userId: newOwner.userId },
        },
        data: { role: "OWNER" },
      }),
      db.workspace.update({
        where: { id: workspace.id },
        data: { ownerId: newOwner.userId },
      }),
      db.activity.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          action: "transferred_ownership",
          entityType: "WORKSPACE",
          entityId: workspace.id,
          message: `${user.name ?? "Someone"} transferred workspace ownership`,
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  // Otherwise rename.
  if (parsed.data.name) {
    await db.workspace.update({
      where: { id: workspace.id },
      data: { name: parsed.data.name },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { user, workspace, membership } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  if (id !== workspace.id) {
    return NextResponse.json({ error: "Workspace không khớp" }, { status: 400 });
  }

  // Only OWNER may delete the workspace.
  if (!isOwner(membership)) return forbidden("Chỉ chủ workspace mới được xóa");

  await db.$transaction([
    db.activity.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        action: "deleted_workspace",
        entityType: "WORKSPACE",
        entityId: workspace.id,
        message: `${user.name ?? "Someone"} deleted workspace ${workspace.name}`,
      },
    }),
    db.workspace.delete({ where: { id: workspace.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
