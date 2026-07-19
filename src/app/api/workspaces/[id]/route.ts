import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
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
    const { data: newOwner, error: ownerErr } = await db
      .from("WorkspaceMember")
      .select("*")
      .eq("workspaceId", workspace.id)
      .eq("userId", parsed.data.newOwnerId)
      .maybeSingle();

    if (ownerErr) throw ownerErr;
    if (!newOwner)
      return NextResponse.json({ error: "Thành viên không hợp lệ" }, { status: 400 });

    const { error: err1 } = await db
      .from("WorkspaceMember")
      .update({ role: "ADMIN" })
      .eq("workspaceId", workspace.id)
      .eq("userId", user.id);
    if (err1) throw err1;

    const { error: err2 } = await db
      .from("WorkspaceMember")
      .update({ role: "OWNER" })
      .eq("workspaceId", workspace.id)
      .eq("userId", newOwner.userId);
    if (err2) throw err2;

    const { error: err3 } = await db
      .from("Workspace")
      .update({ ownerId: newOwner.userId })
      .eq("id", workspace.id);
    if (err3) throw err3;

    const newActivityId = crypto.randomUUID();
    const { error: err4 } = await db
      .from("Activity")
      .insert({
        id: newActivityId,
        workspaceId: workspace.id,
        userId: user.id,
        action: "transferred_ownership",
        entityType: "WORKSPACE",
        entityId: workspace.id,
        message: `${user.name ?? "Someone"} transferred workspace ownership`,
      });
    if (err4) throw err4;

    return NextResponse.json({ ok: true });
  }

  // Otherwise rename.
  if (parsed.data.name) {
    const { error: renameErr } = await db
      .from("Workspace")
      .update({ name: parsed.data.name })
      .eq("id", workspace.id);

    if (renameErr) throw renameErr;
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

  const newActivityId = crypto.randomUUID();
  const { error: actErr } = await db
    .from("Activity")
    .insert({
      id: newActivityId,
      workspaceId: workspace.id,
      userId: user.id,
      action: "deleted_workspace",
      entityType: "WORKSPACE",
      entityId: workspace.id,
      message: `${user.name ?? "Someone"} deleted workspace ${workspace.name}`,
    });

  if (actErr) throw actErr;

  const { error: delErr } = await db
    .from("Workspace")
    .delete()
    .eq("id", workspace.id);

  if (delErr) throw delErr;

  return NextResponse.json({ ok: true });
}
