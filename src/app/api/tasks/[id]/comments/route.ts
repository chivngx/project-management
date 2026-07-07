import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";

type Params = { params: Promise<{ id: string }> };

/** List comments for a task (scoped to the active workspace). */
export async function GET(_req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  // Verify the task belongs to the active workspace.
  const task = await db.task.findFirst({
    where: { id, project: { workspaceId: workspace.id } },
    select: { id: true },
  });
  if (!task) return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });

  const comments = await db.comment.findMany({
    where: { taskId: id },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    comments.map((c) => ({
      id: c.id,
      taskId: c.taskId,
      body: c.body,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      user: {
        id: c.user.id,
        name: c.user.name,
        email: c.user.email,
        image: c.user.image,
      },
    }))
  );
}

const createSchema = z.object({
  body: z.string().min(1, "Nội dung bình luận là bắt buộc").max(2000),
});

/** Create a comment on a task. */
export async function POST(req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  const task = await db.task.findFirst({
    where: { id, project: { workspaceId: workspace.id } },
    select: { id: true, title: true, assigneeId: true, creatorId: true, projectId: true },
  });
  if (!task) return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );

  const comment = await db.comment.create({
    data: {
      taskId: id,
      userId: user.id,
      body: parsed.data.body.trim(),
    },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  // Notify the task's assignee and creator (excluding the commenter).
  const recipients = new Set<string>();
  if (task.assigneeId && task.assigneeId !== user.id) recipients.add(task.assigneeId);
  if (task.creatorId && task.creatorId !== user.id) recipients.add(task.creatorId);
  if (recipients.size > 0) {
    await db.notification.createMany({
      data: Array.from(recipients).map((recipientId) => ({
        userId: recipientId,
        workspaceId: workspace.id,
        type: "task_commented",
        message: `${user.name ?? "Someone"} đã bình luận về tác vụ "${task.title}"`,
        link: `/projects/${task.projectId}`,
      })),
    });
  }

  return NextResponse.json({
    id: comment.id,
    taskId: comment.taskId,
    body: comment.body,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    user: {
      id: comment.user.id,
      name: comment.user.name,
      email: comment.user.email,
      image: comment.user.image,
    },
  });
}
