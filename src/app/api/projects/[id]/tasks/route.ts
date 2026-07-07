import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getApiContext, canAdmin, forbidden } from "@/lib/api-context";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  const project = await db.project.findFirst({
    where: { id, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!project)
    return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });

  const tasks = await db.task.findMany({
    where: { projectId: id },
    include: { assignee: true, creator: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(tasks);
}

const createSchema = z.object({
  title: z
    .string()
    .min(2, "Tiêu đề phải có ít nhất 2 ký tự")
    .max(120, "Tiêu đề không quá 120 ký tự"),
  description: z
    .string()
    .max(1000, "Mô tả không quá 1000 ký tự")
    .optional()
    .nullable(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
});

export async function POST(req: Request, { params }: Params) {
  const { user, workspace, membership } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  const project = await db.project.findFirst({
    where: { id, workspaceId: workspace.id },
    select: { id: true, name: true },
  });
  if (!project)
    return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });

  // Authorization: caller must be a member of this project OR a workspace admin.
  const isProjectMember = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId: id, userId: user.id } },
    select: { id: true },
  });
  if (!isProjectMember && !canAdmin(membership))
    return forbidden("Bạn phải là thành viên dự án để tạo tác vụ");

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );
  const d = parsed.data;

  // Validate assignee is a project member (return 400, not silent drop).
  let assigneeId: string | null = null;
  if (d.assigneeId) {
    const member = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: d.assigneeId } },
    });
    if (!member)
      return NextResponse.json(
        { error: "Người được giao không phải thành viên dự án" },
        { status: 400 }
      );
    assigneeId = d.assigneeId;
  }

  const task = await db.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        projectId: id,
        title: d.title,
        description: d.description ?? null,
        status: d.status ?? "TODO",
        priority: d.priority ?? "MEDIUM",
        assigneeId,
        creatorId: user.id,
        dueDate: d.dueDate ? new Date(d.dueDate) : null,
      },
    });

    await tx.activity.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        action: "created_task",
        entityType: "TASK",
        entityId: created.id,
        message: `${user.name ?? "Someone"} created task ${created.title}`,
      },
    });

    return created;
  });

  return NextResponse.json({ id: task.id });
}
