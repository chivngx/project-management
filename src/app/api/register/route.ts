import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const BCRYPT_COST = 12;

const schema = z.object({
  name: z.string().min(2, "Tên phải có ít nhất 2 ký tự").max(60),
  email: z.string().email("Email không hợp lệ"),
  password: z
    .string()
    .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
    .regex(/[A-Z]/, "Mật khẩu phải có ít nhất 1 chữ in hoa")
    .regex(/[a-z]/, "Mật khẩu phải có ít nhất 1 chữ thường")
    .regex(/[0-9]/, "Mật khẩu phải có ít nhất 1 chữ số"),
});

export async function POST(req: Request) {
  try {
    // Rate limit: 5 registrations per hour per IP.
    const ip = getClientIp(req);
    const rl = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Quá nhiều lần đăng ký. Vui lòng thử lại sau." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { name, email, password } = parsed.data;
    const normalized = email.trim().toLowerCase();

    const { data: existing, error: existingErr } = await db
      .from("User")
      .select("id")
      .eq("email", normalized)
      .maybeSingle();

    if (existingErr) throw existingErr;
    if (existing) {
      return NextResponse.json(
        { error: "Email đã được sử dụng" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    let userIdToCleanup: string | null = null;

    try {
      // 1. Create User
      const newUserId = crypto.randomUUID();
      const { data: user, error: userErr } = await db
        .from("User")
        .insert({
          id: newUserId,
          name,
          email: normalized,
          passwordHash,
        })
        .select()
        .single();

      if (userErr) throw userErr;
      userIdToCleanup = user.id;

      // 2. Create Workspace
      const newWorkspaceId = crypto.randomUUID();
      const { data: workspace, error: wsErr } = await db
        .from("Workspace")
        .insert({
          id: newWorkspaceId,
          name: `${name.split(" ")[0]}'s Workspace`,
          ownerId: user.id,
        })
        .select()
        .single();

      if (wsErr) throw wsErr;

      // 3. Create WorkspaceMember
      const newMemberId = crypto.randomUUID();
      const { error: memberErr } = await db
        .from("WorkspaceMember")
        .insert({
          id: newMemberId,
          workspaceId: workspace.id,
          userId: user.id,
          role: "OWNER",
        });

      if (memberErr) throw memberErr;

      // 4. Create Project
      const newProjectId = crypto.randomUUID();
      const { data: starter, error: projErr } = await db
        .from("Project")
        .insert({
          id: newProjectId,
          workspaceId: workspace.id,
          name: "Getting Started",
          description:
            "A starter project to explore the app. Feel free to rename or delete it.",
          status: "ACTIVE",
          priority: "MEDIUM",
          startDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
        })
        .select()
        .single();

      if (projErr) throw projErr;

      // 5. Create ProjectMember
      const newProjMemberId = crypto.randomUUID();
      const { error: pmErr } = await db
        .from("ProjectMember")
        .insert({
          id: newProjMemberId,
          projectId: starter.id,
          userId: user.id,
          role: "MEMBER",
        });

      if (pmErr) throw pmErr;

      // 6. Create Tasks
      const tasksData = [
        {
          id: crypto.randomUUID(),
          projectId: starter.id,
          title: "Create your first project",
          status: "TODO",
          priority: "MEDIUM",
          creatorId: user.id,
          assigneeId: user.id,
          dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
        },
        {
          id: crypto.randomUUID(),
          projectId: starter.id,
          title: "Invite a team member",
          status: "TODO",
          priority: "LOW",
          creatorId: user.id,
          assigneeId: user.id,
        },
        {
          id: crypto.randomUUID(),
          projectId: starter.id,
          title: "Explore the dashboard",
          status: "DONE",
          priority: "LOW",
          creatorId: user.id,
          assigneeId: user.id,
        },
      ];

      const { error: tasksErr } = await db
        .from("Task")
        .insert(tasksData);

      if (tasksErr) throw tasksErr;

      // 7. Create Activity
      const newActivityId = crypto.randomUUID();
      const { error: actErr } = await db
        .from("Activity")
        .insert({
          id: newActivityId,
          workspaceId: workspace.id,
          userId: user.id,
          action: "created_workspace",
          entityType: "WORKSPACE",
          entityId: workspace.id,
          message: `${name} created workspace ${workspace.name}`,
        });

      if (actErr) throw actErr;

    } catch (e) {
      console.error("[register]", e);
      if (userIdToCleanup) {
        await db.from("User").delete().eq("id", userIdToCleanup);
      }
      throw e;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[register]", e);
    return NextResponse.json(
      { error: "Đăng ký thất bại, vui lòng thử lại" },
      { status: 500 }
    );
  }
}
