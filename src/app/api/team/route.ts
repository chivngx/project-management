import { NextResponse } from "next/server";
import { z } from "zod";
import { TeamService } from "@/services/team.service";
import { getApiContext, canAdmin, forbidden } from "@/lib/api-context";

export async function GET() {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json([]);

  const members = await TeamService.listTeamMembers(workspace.id);
  return NextResponse.json(members);
}

const inviteSchema = z.object({ email: z.string().email() });

/** Add an existing user (by email) to the active workspace as a MEMBER. */
export async function POST(req: Request) {
  const { user, workspace, membership } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace)
    return NextResponse.json({ error: "No workspace" }, { status: 400 });

  // Authorization: only OWNER/ADMIN may invite members.
  if (!canAdmin(membership))
    return forbidden("Chỉ quản trị viên mới được mời thành viên");

  const parsed = inviteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "Email không hợp lệ" }, { status: 400 });

  const email = parsed.data.email;

  try {
    await TeamService.inviteTeamMember(
      workspace.id,
      { id: user.id, name: user.name },
      membership?.role ?? "MEMBER",
      email
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message === "FORBIDDEN") {
      return forbidden("Chỉ quản trị viên mới được mời thành viên");
    }
    if (e.message === "USER_NOT_FOUND") {
      return NextResponse.json(
        {
          error:
            "Chưa có tài khoản với email này. Họ cần đăng ký trước, sau đó bạn mới thêm được.",
        },
        { status: 404 }
      );
    }
    if (e.message === "ALREADY_MEMBER") {
      return NextResponse.json(
        { error: "Thành viên đã có trong workspace" },
        { status: 409 }
      );
    }
    console.error("Invite team member error:", e);
    return NextResponse.json({ error: "Đã xảy ra lỗi hệ thống" }, { status: 500 });
  }
}
