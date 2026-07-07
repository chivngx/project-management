import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().min(2).max(120).optional(),
  description: z.string().max(1000).optional().nullable(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
});

export async function PATCH(req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  const task = await db.task.findFirst({
    where: { id, project: { workspaceId: workspace.id } },
    include: { project: true },
  });
  if (!task)
    return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });

  const d = parsed.data;
  const beforeStatus = task.status;

  let assigneeId = task.assigneeId;
  if (d.assigneeId !== undefined) {
    if (d.assigneeId === null) assigneeId = null;
    else {
      const member = await db.projectMember.findUnique({
        where: {
          projectId_userId: { projectId: task.projectId, userId: d.assigneeId },
        },
      });
      assigneeId = member ? d.assigneeId : task.assigneeId;
    }
  }

  const updated = await db.task.update({
    where: { id },
    data: {
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.description !== undefined ? { description: d.description } : {}),
      ...(d.status ? { status: d.status } : {}),
      ...(d.priority ? { priority: d.priority } : {}),
      ...(d.assigneeId !== undefined ? { assigneeId } : {}),
      ...(d.dueDate !== undefined
        ? { dueDate: d.dueDate ? new Date(d.dueDate) : null }
        : {}),
    },
  });

  if (d.status === "DONE" && beforeStatus !== "DONE") {
    await db.activity.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        action: "completed_task",
        entityType: "TASK",
        entityId: updated.id,
        message: `${user.name ?? "Someone"} completed task ${updated.title}`,
      },
    });
  }

  return NextResponse.json({ id: updated.id });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  const task = await db.task.findFirst({
    where: { id, project: { workspaceId: workspace.id } },
  });
  if (!task)
    return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });

  await db.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
