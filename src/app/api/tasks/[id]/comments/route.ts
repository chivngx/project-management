import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";
import { decrypt } from "@/lib/encryption";

type Params = { params: Promise<{ id: string }> };

/** List comments for a task (scoped to the active workspace). */
export async function GET(_req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  // Verify the task belongs to the active workspace.
  const { data: task, error: findErr } = await db
    .from("Task")
    .select("*, project:Project(*)")
    .eq("id", id)
    .maybeSingle();

  if (findErr) throw findErr;
  if (!task || task.project?.workspaceId !== workspace.id) {
    return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });
  }

  const { data: commentsRaw, error: commentsErr } = await db
    .from("Comment")
    .select("*, user:User(id, name, email, image)")
    .eq("taskId", id)
    .order("createdAt", { ascending: true });

  if (commentsErr) throw commentsErr;
  const comments = commentsRaw || [];

  return NextResponse.json(
    comments.map((c) => ({
      id: c.id,
      taskId: c.taskId,
      body: c.body,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      user: {
        id: c.user?.id,
        name: c.user?.name,
        email: c.user?.email,
        image: c.user?.image,
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
  const { data: task, error: findErr } = await db
    .from("Task")
    .select("*, project:Project(*), gitIntegration:GitIntegration(*)")
    .eq("id", id)
    .maybeSingle();

  if (findErr) throw findErr;
  if (!task || task.project?.workspaceId !== workspace.id) {
    return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );

  const newCommentId = crypto.randomUUID();
  const { data: comment, error: createCommentErr } = await db
    .from("Comment")
    .insert({
      id: newCommentId,
      taskId: id,
      userId: user.id,
      body: parsed.data.body.trim(),
    })
    .select("*, user:User(id, name, email, image)")
    .single();

  if (createCommentErr) throw createCommentErr;

  // Notify the task's assignee and creator (excluding the commenter).
  const recipients = new Set<string>();
  if (task.assigneeId && task.assigneeId !== user.id) recipients.add(task.assigneeId);
  if (task.creatorId && task.creatorId !== user.id) recipients.add(task.creatorId);
  if (recipients.size > 0) {
    const notificationsToInsert = Array.from(recipients).map((recipientId) => ({
      id: crypto.randomUUID(),
      userId: recipientId,
      workspaceId: workspace.id,
      type: "task_commented",
      message: `${user.name ?? "Someone"} đã bình luận về tác vụ "${task.title}"`,
      link: `/projects/${task.projectId}`,
    }));

    const { error: notifErr } = await db
      .from("Notification")
      .insert(notificationsToInsert);

    if (notifErr) throw notifErr;
  }

  // TWO-WAY SYNC: Post comment to GitHub / GitLab issue if linked
  if (task.externalNumber && task.gitIntegration) {
    try {
      const integration = task.gitIntegration;
      const token = decrypt(integration.token);
      const provider = integration.provider;
      const owner = integration.owner;
      const name = integration.name;
      const issueNumber = task.externalNumber;
      
      const commentBody = `**[ProjectFlow] ${user.name || "Someone"}:** ${comment.body}`;

      if (provider === "github") {
        const headers = {
          Accept: "application/vnd.github.v3+json",
          Authorization: `token ${token}`,
          "Content-Type": "application/json",
        };

        await fetch(`https://api.github.com/repos/${owner}/${name}/issues/${issueNumber}/comments`, {
          method: "POST",
          headers,
          body: JSON.stringify({ body: commentBody }),
        });
      } else if (provider === "gitlab") {
        const apiBase = integration.apiUrl || "https://gitlab.com";
        const projectPath = encodeURIComponent(`${owner}/${name}`);
        const headers = {
          "PRIVATE-TOKEN": token,
          "Content-Type": "application/json",
        };

        await fetch(`${apiBase}/api/v4/projects/${projectPath}/issues/${issueNumber}/notes`, {
          method: "POST",
          headers,
          body: JSON.stringify({ body: commentBody }),
        });
      }
    } catch (e) {
      console.error("Failed to sync comment to Git issue:", e);
    }
  }

  return NextResponse.json({
    id: comment.id,
    taskId: comment.taskId,
    body: comment.body,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    user: {
      id: comment.user?.id,
      name: comment.user?.name,
      email: comment.user?.email,
      image: comment.user?.image,
    },
  });
}
