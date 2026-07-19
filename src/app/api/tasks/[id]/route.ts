import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getApiContext, canAdmin, forbidden } from "@/lib/api-context";
import { emitToWorkspace } from "@/lib/realtime";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { decrypt } from "@/lib/encryption";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z
    .string()
    .min(2, "Tiêu đề phải có ít nhất 2 ký tự")
    .max(120, "Tiêu đề không quá 120 ký tự")
    .optional(),
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

export async function PATCH(req: Request, { params }: Params) {
  const { user, workspace, membership } = await getApiContext();
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

  // Authorization: creator, assignee, or workspace admin may edit.
  const canEdit =
    task.creatorId === user.id ||
    task.assigneeId === user.id ||
    canAdmin(membership);
  if (!canEdit)
    return forbidden("Bạn chỉ có thể sửa tác vụ do mình tạo hoặc được giao");

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );

  const d = parsed.data;
  const beforeStatus = task.status;

  let assigneeId = task.assigneeId;
  if (d.assigneeId !== undefined) {
    if (d.assigneeId === null) assigneeId = null;
    else {
      const { data: member, error: assigneeErr } = await db
        .from("ProjectMember")
        .select("id")
        .eq("projectId", task.projectId)
        .eq("userId", d.assigneeId)
        .maybeSingle();

      if (assigneeErr) throw assigneeErr;
      if (!member)
        return NextResponse.json(
          { error: "Người được giao không phải thành viên dự án" },
          { status: 400 }
        );
      assigneeId = d.assigneeId;
    }
  }

  const updateData: any = {};
  if (d.title !== undefined) updateData.title = d.title;
  if (d.description !== undefined) updateData.description = d.description;
  if (d.status !== undefined) updateData.status = d.status;
  if (d.priority !== undefined) updateData.priority = d.priority;
  if (d.assigneeId !== undefined) updateData.assigneeId = assigneeId;
  if (d.dueDate !== undefined) updateData.dueDate = d.dueDate ? new Date(d.dueDate).toISOString() : null;

  const { data: updated, error: updateErr } = await db
    .from("Task")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (updateErr) throw updateErr;

  // TWO-WAY SYNC: If status has changed and task has Git integration, update issue state & labels
  if (d.status !== undefined && d.status !== beforeStatus && task.externalNumber && task.gitIntegration) {
    try {
      const integration = task.gitIntegration;
      const token = decrypt(integration.token);
      const provider = integration.provider;
      const owner = integration.owner;
      const name = integration.name;
      const issueNumber = task.externalNumber;

      const targetGitState = d.status === "DONE" ? "closed" : "open";

      if (provider === "github") {
        const headers = {
          Accept: "application/vnd.github.v3+json",
          Authorization: `token ${token}`,
          "Content-Type": "application/json",
        };
        
        // 1. Sync state (open/close)
        await fetch(`https://api.github.com/repos/${owner}/${name}/issues/${issueNumber}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ state: targetGitState }),
        });

        // 2. Sync label (status/todo, status/in-progress, status/review, status/done)
        const statusLabel = `status/${d.status.toLowerCase().replace("_", "-")}`;
        await fetch(`https://api.github.com/repos/${owner}/${name}/issues/${issueNumber}/labels`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ labels: [statusLabel] }),
        });
      } else if (provider === "gitlab") {
        const apiBase = integration.apiUrl || "https://gitlab.com";
        const projectPath = encodeURIComponent(`${owner}/${name}`);
        const headers = {
          "PRIVATE-TOKEN": token,
          "Content-Type": "application/json",
        };

        const targetGitlabStateEvent = d.status === "DONE" ? "close" : "reopen";

        // 1. Sync state
        await fetch(`${apiBase}/api/v4/projects/${projectPath}/issues/${issueNumber}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ state_event: targetGitlabStateEvent }),
        });

        // 2. Sync label
        const statusLabel = `status/${d.status.toLowerCase().replace("_", "-")}`;
        await fetch(`${apiBase}/api/v4/projects/${projectPath}/issues/${issueNumber}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ labels: statusLabel }),
        });
      }
    } catch (e) {
      console.error("Failed to sync task status change to Git:", e);
    }
  }

  if (d.status === "DONE" && beforeStatus !== "DONE") {
    const newActivityId = crypto.randomUUID();
    const { error: actErr } = await db
      .from("Activity")
      .insert({
        id: newActivityId,
        workspaceId: workspace.id,
        userId: user.id,
        action: "completed_task",
        entityType: "TASK",
        entityId: updated.id,
        message: `${user.name ?? "Someone"} completed task ${updated.title}`,
      });
    if (actErr) throw actErr;
  }

  // Notify the new assignee when a task is assigned to them (and it's not
  // a self-assignment).
  if (
    d.assigneeId !== undefined &&
    assigneeId &&
    assigneeId !== task.assigneeId &&
    assigneeId !== user.id
  ) {
    const newNotifId = crypto.randomUUID();
    const { error: notifErr } = await db
      .from("Notification")
      .insert({
        id: newNotifId,
        userId: assigneeId,
        workspaceId: workspace.id,
        type: "task_assigned",
        message: `${user.name ?? "Someone"} đã giao tác vụ "${updated.title}" cho bạn`,
        link: `/projects/${task.projectId}`,
      });
    if (notifErr) throw notifErr;
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
  const { data: task, error: findErr } = await db
    .from("Task")
    .select("*, project:Project(*)")
    .eq("id", id)
    .maybeSingle();

  if (findErr) throw findErr;
  if (!task || task.project?.workspaceId !== workspace.id) {
    return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });
  }

  // Authorization: task creator or workspace admin may delete.
  const canDelete = task.creatorId === user.id || canAdmin(membership);
  if (!canDelete)
    return forbidden("Bạn chỉ có thể xóa tác vụ do mình tạo");

  const { error: delErr } = await db
    .from("Task")
    .delete()
    .eq("id", id);

  if (delErr) throw delErr;

  const newActivityId = crypto.randomUUID();
  const { error: actErr } = await db
    .from("Activity")
    .insert({
      id: newActivityId,
      workspaceId: workspace.id,
      userId: user.id,
      action: "deleted_task",
      entityType: "TASK",
      entityId: id,
      message: `${user.name ?? "Someone"} deleted task ${task.title}`,
    });

  if (actErr) throw actErr;

  return NextResponse.json({ ok: true });
}
