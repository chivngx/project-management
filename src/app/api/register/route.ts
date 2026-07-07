import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
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

    const existing = await db.user.findUnique({ where: { email: normalized } });
    if (existing) {
      return NextResponse.json(
        { error: "Email đã được sử dụng" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    // Wrap all writes in a transaction so a failure mid-flow can't leave an
    // un-loginable user (user without workspace, etc.).
    const { workspace } = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email: normalized,
          passwordHash,
        },
      });

      // Give the new user their own workspace + a starter project so the
      // workspace isn't empty.
      const workspace = await tx.workspace.create({
        data: {
          name: `${name.split(" ")[0]}'s Workspace`,
          ownerId: user.id,
          members: {
            create: { userId: user.id, role: "OWNER" },
          },
        },
      });

      const starter = await tx.project.create({
        data: {
          workspaceId: workspace.id,
          name: "Getting Started",
          description:
            "A starter project to explore the app. Feel free to rename or delete it.",
          status: "ACTIVE",
          priority: "MEDIUM",
          startDate: new Date(),
          dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
          members: { create: { userId: user.id, role: "MEMBER" } },
        },
      });

      await tx.task.createMany({
        data: [
          {
            projectId: starter.id,
            title: "Create your first project",
            status: "TODO",
            priority: "MEDIUM",
            creatorId: user.id,
            assigneeId: user.id,
            dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
          },
          {
            projectId: starter.id,
            title: "Invite a team member",
            status: "TODO",
            priority: "LOW",
            creatorId: user.id,
            assigneeId: user.id,
          },
          {
            projectId: starter.id,
            title: "Explore the dashboard",
            status: "DONE",
            priority: "LOW",
            creatorId: user.id,
            assigneeId: user.id,
          },
        ],
      });

      await tx.activity.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          action: "created_workspace",
          entityType: "WORKSPACE",
          entityId: workspace.id,
          message: `${name} created workspace ${workspace.name}`,
        },
      });

      return { workspace };
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[register]", e);
    return NextResponse.json(
      { error: "Đăng ký thất bại, vui lòng thử lại" },
      { status: 500 }
    );
  }
}
