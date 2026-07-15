import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getApiContext, canAdmin, forbidden } from "@/lib/api-context";
import { PROJECT_PRIORITIES, PROJECT_STATUSES } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  // SECURITY: only select safe user fields (never expose passwordHash).
  const project = await db.project.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
      tasks: {
        include: {
          assignee: { select: { id: true, name: true, email: true, image: true } },
          creator: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { tasks: true } },
    },
  });
  if (!project)
    return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });

  // Map to a flat, consistent response shape (matches GET /api/projects).
  return NextResponse.json({
    id: project.id,
    workspaceId: project.workspaceId,
    name: project.name,
    description: project.description,
    status: project.status,
    priority: project.priority,
    startDate: project.startDate,
    dueDate: project.dueDate,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    repoProvider: project.repoProvider,
    repoOwner: project.repoOwner,
    repoName: project.repoName,
    repoToken: project.repoToken,
    repoApiUrl: project.repoApiUrl,
    repoWebhookSecret: project.repoWebhookSecret,
    members: project.members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      image: m.user.image,
      role: m.role,
    })),
    tasks: project.tasks.map((t) => ({
      id: t.id,
      projectId: t.projectId,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      assigneeId: t.assigneeId,
      assignee: t.assignee
        ? {
            id: t.assignee.id,
            name: t.assignee.name,
            email: t.assignee.email,
            image: t.assignee.image,
          }
        : null,
      creatorId: t.creatorId,
      creator: {
        id: t.creator.id,
        name: t.creator.name,
        email: t.creator.email,
        image: t.creator.image,
      },
      dueDate: t.dueDate,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      externalId: t.externalId,
      externalNumber: t.externalNumber,
      externalUrl: t.externalUrl,
      externalProvider: t.externalProvider,
    })),
    taskCount: project._count.tasks,
  });
}

const patchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(PROJECT_STATUSES).optional(),
  priority: z.enum(PROJECT_PRIORITIES).optional(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
});

export async function PATCH(req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );

  const existing = await db.project.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!existing)
    return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });

  const d = parsed.data;

  // Cross-field validation: if both startDate and dueDate are provided in
  // this patch, dueDate must be on/after startDate. If only one is provided,
  // compare against the existing value.
  const effectiveStart = d.startDate !== undefined ? d.startDate : existing.startDate?.toISOString();
  const effectiveDue = d.dueDate !== undefined ? d.dueDate : existing.dueDate?.toISOString();
  if (effectiveStart && effectiveDue && new Date(effectiveDue) < new Date(effectiveStart)) {
    return NextResponse.json(
      { error: "Ngày kết thúc không được trước ngày bắt đầu" },
      { status: 400 }
    );
  }
  const [updated] = await db.$transaction([
    db.project.update({
      where: { id },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.description !== undefined ? { description: d.description } : {}),
        ...(d.status ? { status: d.status } : {}),
        ...(d.priority ? { priority: d.priority } : {}),
        ...(d.startDate !== undefined
          ? { startDate: d.startDate ? new Date(d.startDate) : null }
          : {}),
        ...(d.dueDate !== undefined
          ? { dueDate: d.dueDate ? new Date(d.dueDate) : null }
          : {}),
      },
    }),
    db.activity.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        action: "updated_project",
        entityType: "PROJECT",
        entityId: id,
        message: `${user.name ?? "Someone"} updated project ${existing.name}`,
      },
    }),
  ]);

  return NextResponse.json({ id: updated.id });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { user, workspace, membership } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  // Authorization: only OWNER/ADMIN may delete a project.
  if (!canAdmin(membership)) return forbidden("Chỉ quản trị viên mới được xóa dự án");

  const { id } = await params;
  const existing = await db.project.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!existing)
    return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });

  await db.$transaction([
    db.project.delete({ where: { id } }),
    db.activity.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        action: "deleted_project",
        entityType: "PROJECT",
        entityId: id,
        message: `${user.name ?? "Someone"} deleted project ${existing.name}`,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
