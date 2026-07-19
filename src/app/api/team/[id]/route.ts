import { NextResponse } from "next/server";
import { z } from "zod";
import { TeamService } from "@/services/team.service";
import { getApiContext, isOwner, canAdmin, forbidden } from "@/lib/api-context";

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

  try {
    await TeamService.changeMemberRole(
      workspace.id,
      membership.role,
      targetUserId,
      parsed.data
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message === "FORBIDDEN") {
      return forbidden("Chỉ chủ workspace mới được đổi vai trò thành viên");
    }
    if (e.message === "MEMBER_NOT_FOUND") {
      return NextResponse.json({ error: "Không tìm thấy thành viên" }, { status: 404 });
    }
    if (e.message === "OWNER_ROLE_LOCKED") {
      return NextResponse.json(
        { error: "Không thể đổi vai trò của chủ workspace. Hãy chuyển quyền sở hữu trước." },
        { status: 400 }
      );
    }
    console.error("Change member role error:", e);
    return NextResponse.json({ error: "Đã xảy ra lỗi hệ thống" }, { status: 500 });
  }
}

/** Remove a member from the active workspace. */
export async function DELETE(_req: Request, { params }: Params) {
  const { user, workspace, membership } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id: targetUserId } = await params;

  try {
    await TeamService.removeTeamMember(
      workspace.id,
      { id: user.id, name: user.name },
      membership?.role ?? "MEMBER",
      targetUserId
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message === "FORBIDDEN") {
      return forbidden("Chỉ quản trị viên mới được xóa thành viên");
    }
    if (e.message === "MEMBER_NOT_FOUND") {
      return NextResponse.json({ error: "Không tìm thấy thành viên" }, { status: 404 });
    }
    if (e.message === "OWNER_CANNOT_BE_REMOVED") {
      return NextResponse.json(
        { error: "Không thể xóa chủ workspace. Hãy chuyển quyền sở hữu trước." },
        { status: 400 }
      );
    }
    console.error("Remove team member error:", e);
    return NextResponse.json({ error: "Đã xảy ra lỗi hệ thống" }, { status: 500 });
  }
}
