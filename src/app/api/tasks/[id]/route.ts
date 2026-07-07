import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getApiContext, canAdmin, forbidden } from "@/lib/api-context";
import { emitToWorkspace } from "@/lib/realtime";
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
  const { user, workspace, membership } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  const task = await db.task.findFirst({
    where: { id, project: { workspaceId: workspace.id } },
    include: { project: true },
  });
  if (!task)
    return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });

  // Authorization: creator, assignee, or workspace admin may edit.
  const canEdit =
    task.creatorId === user.id ||
    task.assigneeId === user.id ||
    canAdmin(membership);
  if (!canEdit)
    return forbidden("Bạn chỉ có thể sửa tác vụ do mình tạo hoặc được giao");

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
      if (!member)
        return NextResponse.json(
          { error: "Người được giao không phải thành viên dự án" },
          { status: 400 }
        );
      assigneeId = d.assigneeId;
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

  // Notify the new assignee when a task is assigned to them (and it's not
  // a self-assignment).
  if (
    d.assigneeId !== undefined &&
    assigneeId &&
    assigneeId !== task.assigneeId &&
    assigneeId !== user.id
  ) {
    await db.notification.create({
      data: {
        userId: assigneeId,
        workspaceId: workspace.id,
        type: "task_assigned",
        message: `${user.name ?? "Someone"} đã giao tác vụ "${updated.title}" cho bạn`,
        link: `/projects/${task.projectId}`,
      },
    });
  }

  // Broadcast the change to other workspace members in realtime.
  await emitToWorkspace(workspace.id, "task:updated", {
    id: updated.id,
    projectId: task.projectId,
    changes: parsed.data,
  });

  return NextResponse.json({ id: updated.id });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { user, workspace, membership } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  const task = await db.task.findFirst({
    where: { id, project: { workspaceId: workspace.id } },
    select: { id: true, title: true, creatorId: true },
  });
  if (!task)
    return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });

  // Authorization: task creator or workspace admin may delete.
  const canDelete = task.creatorId === user.id || canAdmin(membership);
  if (!canDelete)
    return forbidden("Bạn chỉ có thể xóa tác vụ do mình tạo");

  await db.task.delete({ where: { id } });

  // Activity log for task deletion (was missing before).
  await db.activity.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      action: "deleted_task",
      entityType: "TASK",
      entityId: id,
      message: `${user.name ?? "Someone"} deleted task ${task.title}`,
    },
  });

  return NextResponse.json({ ok: true });
}
