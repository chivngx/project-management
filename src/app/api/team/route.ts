import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";

export async function GET() {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json([]);

  const members = await db.workspaceMember.findMany({
    where: { workspaceId: workspace.id },
    include: { user: true },
    orderBy: { joinedAt: "asc" },
  });

  return NextResponse.json(
    members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      image: m.user.image,
      role: m.role,
      joinedAt: m.joinedAt,
    }))
  );
}

const inviteSchema = z.object({ email: z.string().email() });

/** Add an existing user (by email) to the active workspace as a MEMBER. */
export async function POST(req: Request) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace)
    return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const parsed = inviteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "Email không hợp lệ" }, { status: 400 });

  const normalized = parsed.data.email.trim().toLowerCase();
  const target = await db.user.findUnique({ where: { email: normalized } });
  if (!target) {
    return NextResponse.json(
      {
        error:
          "Chưa có tài khoản với email này. Họ cần đăng ký trước, sau đó bạn mới thêm được.",
      },
      { status: 404 }
    );
  }

  const existing = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: target.id } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Thành viên đã có trong workspace" },
      { status: 409 }
    );
  }

  await db.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: target.id, role: "MEMBER" },
  });

  await db.activity.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      action: "added_member",
      entityType: "MEMBER",
      entityId: target.id,
      message: `${user.name ?? "Someone"} added ${target.name} to the workspace`,
    },
  });

  return NextResponse.json({ ok: true });
}
