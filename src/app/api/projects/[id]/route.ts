import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";
import { PROJECT_PRIORITIES, PROJECT_STATUSES } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  const project = await db.project.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      members: { include: { user: true } },
      tasks: {
        include: {
          assignee: true,
          creator: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!project)
    return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });

  return NextResponse.json(project);
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
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });

  const existing = await db.project.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!existing)
    return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });

  const d = parsed.data;
  const updated = await db.project.update({
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
  });

  await db.activity.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      action: "updated_project",
      entityType: "PROJECT",
      entityId: updated.id,
      message: `${user.name ?? "Someone"} updated project ${updated.name}`,
    },
  });

  return NextResponse.json({ id: updated.id });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  const existing = await db.project.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!existing)
    return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });

  await db.project.delete({ where: { id } });

  await db.activity.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      action: "deleted_project",
      entityType: "PROJECT",
      entityId: id,
      message: `${user.name ?? "Someone"} deleted project ${existing.name}`,
    },
  });

  return NextResponse.json({ ok: true });
}
