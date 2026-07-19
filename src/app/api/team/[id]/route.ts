import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getApiContext, canAdmin, isOwner, forbidden } from "@/lib/api-context";

type Params = { params: Promise<{ id: string }> };

const WORKSPACE_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
const roleSchema = z.enum(WORKSPACE_ROLES);

/** Change a member's role in the active workspace. */
export async function PATCH(req: Request, { params }: Params) {
  const { user, workspace, membership } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  // Only OWNER can promote/demote; ADMIN can manage MEMBERs but not roles.
  if (!isOwner(membership))
    return forbidden("Chỉ chủ workspace mới được đổi vai trò thành viên");

  const { id: targetUserId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = roleSchema.safeParse(body.role);
  if (!parsed.success)
    return NextResponse.json({ error: "Vai trò không hợp lệ" }, { status: 400 });

  const { data: target, error: targetErr } = await db
    .from("WorkspaceMember")
    .select("*")
    .eq("workspaceId", workspace.id)
    .eq("userId", targetUserId)
    .maybeSingle();

  if (targetErr) throw targetErr;
  if (!target)
    return NextResponse.json({ error: "Không tìm thấy thành viên" }, { status: 404 });

  // Can't change your own OWNER role (would leave workspace without owner).
  if (target.role === "OWNER" && parsed.data !== "OWNER") {
    return NextResponse.json(
      { error: "Không thể đổi vai trò của chủ workspace. Hãy chuyển quyền sở hữu trước." },
      { status: 400 }
    );
  }

  const { error: updateErr } = await db
    .from("WorkspaceMember")
    .update({ role: parsed.data })
    .eq("workspaceId", workspace.id)
    .eq("userId", targetUserId);

  if (updateErr) throw updateErr;

  return NextResponse.json({ ok: true });
}

/** Remove a member from the active workspace. */
export async function DELETE(_req: Request, { params }: Params) {
  const { user, workspace, membership } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  // Only OWNER/ADMIN can remove members; members can also "leave" by removing
  // themselves (handled by the separate /leave route for clarity, but we allow
  // self-removal here too).
  const { id: targetUserId } = await params;

  const { data: target, error: targetErr } = await db
    .from("WorkspaceMember")
    .select("*")
    .eq("workspaceId", workspace.id)
    .eq("userId", targetUserId)
    .maybeSingle();

  if (targetErr) throw targetErr;
  if (!target)
    return NextResponse.json({ error: "Không tìm thấy thành viên" }, { status: 404 });

  const isSelf = targetUserId === user.id;

  // Removing someone else requires admin; removing yourself is always allowed.
  if (!isSelf && !canAdmin(membership))
    return forbidden("Chỉ quản trị viên mới được xóa thành viên");

  // Can't remove the OWNER (must transfer ownership first).
  if (target.role === "OWNER") {
    return NextResponse.json(
      { error: "Không thể xóa chủ workspace. Hãy chuyển quyền sở hữu trước." },
      { status: 400 }
    );
  }

  const { error: delErr } = await db
    .from("WorkspaceMember")
    .delete()
    .eq("workspaceId", workspace.id)
    .eq("userId", targetUserId);

  if (delErr) throw delErr;

  const newActivityId = crypto.randomUUID();
  const { error: actErr } = await db
    .from("Activity")
    .insert({
      id: newActivityId,
      workspaceId: workspace.id,
      userId: user.id,
      action: "removed_member",
      entityType: "MEMBER",
      entityId: targetUserId,
      message: isSelf
        ? `${user.name ?? "Someone"} left the workspace`
        : `${user.name ?? "Someone"} removed a member`,
    });

  if (actErr) throw actErr;

  return NextResponse.json({ ok: true });
}
