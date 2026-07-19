import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getApiContext, canAdmin, forbidden } from "@/lib/api-context";

export async function GET() {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json([]);

  const { data: rawMembers, error } = await db
    .from("WorkspaceMember")
    .select("*, user:User(*)")
    .eq("workspaceId", workspace.id)
    .order("joinedAt", { ascending: true });

  if (error) throw error;
  const members = (rawMembers || []) as any[];

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

  const normalized = parsed.data.email.trim().toLowerCase();
  const { data: target, error: targetErr } = await db
    .from("User")
    .select("id, name")
    .eq("email", normalized)
    .maybeSingle();

  if (targetErr) throw targetErr;
  if (!target) {
    return NextResponse.json(
      {
        error:
          "Chưa có tài khoản với email này. Họ cần đăng ký trước, sau đó bạn mới thêm được.",
      },
      { status: 404 }
    );
  }

  const { data: existing, error: existErr } = await db
    .from("WorkspaceMember")
    .select("id")
    .eq("workspaceId", workspace.id)
    .eq("userId", target.id)
    .maybeSingle();

  if (existErr) throw existErr;
  if (existing) {
    return NextResponse.json(
      { error: "Thành viên đã có trong workspace" },
      { status: 409 }
    );
  }

  const newMemberId = crypto.randomUUID();
  const { error: memberErr } = await db
    .from("WorkspaceMember")
    .insert({
      id: newMemberId,
      workspaceId: workspace.id,
      userId: target.id,
      role: "MEMBER",
    });

  if (memberErr) throw memberErr;

  const newActivityId = crypto.randomUUID();
  const { error: actErr } = await db
    .from("Activity")
    .insert({
      id: newActivityId,
      workspaceId: workspace.id,
      userId: user.id,
      action: "added_member",
      entityType: "MEMBER",
      entityId: target.id,
      message: `${user.name ?? "Someone"} added ${target.name} to the workspace`,
    });

  if (actErr) throw actErr;

  return NextResponse.json({ ok: true });
}
