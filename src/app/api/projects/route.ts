import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";
import { PROJECT_PRIORITIES, PROJECT_STATUSES } from "@/lib/constants";

export async function GET() {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json([]);

  const projects = await db.project.findMany({
    where: { workspaceId: workspace.id },
    include: {
      members: { include: { user: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    projects.map((p) => {
      const done = p._count.tasks
        ? null // computed on demand below
        : 0;
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        priority: p.priority,
        startDate: p.startDate,
        dueDate: p.dueDate,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        memberCount: p.members.length,
        members: p.members.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          image: m.user.image,
        })),
        taskCount: p._count.tasks,
        doneCount: done,
      };
    })
  );
}

const createSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(PROJECT_STATUSES).optional(),
  priority: z.enum(PROJECT_PRIORITIES).optional(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  memberIds: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace)
    return NextResponse.json({ error: "Không có workspace" }, { status: 400 });

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );
  }
  const d = parsed.data;

  // Validate memberIds belong to the workspace.
  const validMembers = d.memberIds?.length
    ? await db.workspaceMember.findMany({
        where: { workspaceId: workspace.id, userId: { in: d.memberIds } },
        select: { userId: true },
      })
    : [];

  const project = await db.project.create({
    data: {
      workspaceId: workspace.id,
      name: d.name,
      description: d.description ?? null,
      status: d.status ?? "ACTIVE",
      priority: d.priority ?? "MEDIUM",
      startDate: d.startDate ? new Date(d.startDate) : null,
      dueDate: d.dueDate ? new Date(d.dueDate) : null,
      members: {
        create: [
          { userId: user.id, role: "MEMBER" },
          ...validMembers
            .filter((m) => m.userId !== user.id)
            .map((m) => ({ userId: m.userId, role: "MEMBER" as const })),
        ],
      },
    },
  });

  await db.activity.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      action: "created_project",
      entityType: "PROJECT",
      entityId: project.id,
      message: `${user.name ?? "Someone"} created project ${project.name}`,
    },
  });

  return NextResponse.json({ id: project.id });
}
