import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getApiContext, canAdmin, forbidden } from "@/lib/api-context";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  const { data: project, error: projErr } = await db
    .from("Project")
    .select("id")
    .eq("id", id)
    .eq("workspaceId", workspace.id)
    .maybeSingle();

  if (projErr) throw projErr;
  if (!project)
    return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });

  const { data: tasks, error: tasksErr } = await db
    .from("Task")
    .select("*, assignee:User!Task_assigneeId_fkey(*), creator:User!Task_creatorId_fkey(*)")
    .eq("projectId", id)
    .order("createdAt", { ascending: true });

  if (tasksErr) throw tasksErr;

  return NextResponse.json(tasks || []);
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
  const { data: project, error: projErr } = await db
    .from("Project")
    .select("id, name")
    .eq("id", id)
    .eq("workspaceId", workspace.id)
    .maybeSingle();

  if (projErr) throw projErr;
  if (!project)
    return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });

  // Authorization: caller must be a member of this project OR a workspace admin.
  const { data: isProjectMember, error: pmErr } = await db
    .from("ProjectMember")
    .select("id")
    .eq("projectId", id)
    .eq("userId", user.id)
    .maybeSingle();

  if (pmErr) throw pmErr;

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
    const { data: member, error: assigneeErr } = await db
      .from("ProjectMember")
      .select("id")
      .eq("projectId", id)
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

  const newTaskId = crypto.randomUUID();
  const { data: task, error: createErr } = await db
    .from("Task")
    .insert({
      id: newTaskId,
      projectId: id,
      title: d.title,
      description: d.description ?? null,
      status: d.status ?? "TODO",
      priority: d.priority ?? "MEDIUM",
      assigneeId,
      creatorId: user.id,
      dueDate: d.dueDate ? new Date(d.dueDate).toISOString() : null,
    })
    .select()
    .single();

  if (createErr) throw createErr;

  const newActivityId = crypto.randomUUID();
  const { error: actErr } = await db
    .from("Activity")
    .insert({
      id: newActivityId,
      workspaceId: workspace.id,
      userId: user.id,
      action: "created_task",
      entityType: "TASK",
      entityId: task.id,
      message: `${user.name ?? "Someone"} created task ${task.title}`,
    });

  if (actErr) throw actErr;

  return NextResponse.json({ id: task.id });
}
