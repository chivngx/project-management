import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getApiContext, canAdmin, forbidden } from "@/lib/api-context";
import { PROJECT_PRIORITIES, PROJECT_STATUSES } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  const { data: project, error: projErr } = await db
    .from("Project")
    .select("*, members:ProjectMember(*, user:User(id, name, email, image)), tasks:Task(*, assignee:User!Task_assigneeId_fkey(id, name, email, image), creator:User!Task_creatorId_fkey(id, name, email, image))")
    .eq("id", id)
    .eq("workspaceId", workspace.id)
    .maybeSingle();

  if (projErr) throw projErr;
  if (!project)
    return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });

  // Sort tasks in memory by createdAt ascending
  const tasks = (project.tasks || []).sort(
    (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

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
    members: (project.members || []).map((m: any) => ({
      id: m.user?.id,
      name: m.user?.name,
      email: m.user?.email,
      image: m.user?.image,
      role: m.role,
    })),
    tasks: tasks.map((t: any) => ({
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
        id: t.creator?.id,
        name: t.creator?.name,
        email: t.creator?.email,
        image: t.creator?.image,
      },
      dueDate: t.dueDate,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      externalId: t.externalId,
      externalNumber: t.externalNumber,
      externalUrl: t.externalUrl,
      externalProvider: t.externalProvider,
    })),
    taskCount: tasks.length,
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

  const { data: existing, error: existErr } = await db
    .from("Project")
    .select("*")
    .eq("id", id)
    .eq("workspaceId", workspace.id)
    .maybeSingle();

  if (existErr) throw existErr;
  if (!existing)
    return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });

  const d = parsed.data;

  // Cross-field validation: if both startDate and dueDate are provided in
  // this patch, dueDate must be on/after startDate. If only one is provided,
  // compare against the existing value.
  const effectiveStart = d.startDate !== undefined ? d.startDate : existing.startDate;
  const effectiveDue = d.dueDate !== undefined ? d.dueDate : existing.dueDate;
  if (effectiveStart && effectiveDue && new Date(effectiveDue) < new Date(effectiveStart)) {
    return NextResponse.json(
      { error: "Ngày kết thúc không được trước ngày bắt đầu" },
      { status: 400 }
    );
  }

  const updateData: any = {};
  if (d.name !== undefined) updateData.name = d.name;
  if (d.description !== undefined) updateData.description = d.description;
  if (d.status !== undefined) updateData.status = d.status;
  if (d.priority !== undefined) updateData.priority = d.priority;
  if (d.startDate !== undefined) updateData.startDate = d.startDate ? new Date(d.startDate).toISOString() : null;
  if (d.dueDate !== undefined) updateData.dueDate = d.dueDate ? new Date(d.dueDate).toISOString() : null;

  const { data: updated, error: updateErr } = await db
    .from("Project")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (updateErr) throw updateErr;

  const newActivityId = crypto.randomUUID();
  const { error: actErr } = await db
    .from("Activity")
    .insert({
      id: newActivityId,
      workspaceId: workspace.id,
      userId: user.id,
      action: "updated_project",
      entityType: "PROJECT",
      entityId: id,
      message: `${user.name ?? "Someone"} updated project ${existing.name}`,
    });

  if (actErr) throw actErr;

  return NextResponse.json({ id: updated.id });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { user, workspace, membership } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  // Authorization: only OWNER/ADMIN may delete a project.
  if (!canAdmin(membership)) return forbidden("Chỉ quản trị viên mới được xóa dự án");

  const { id } = await params;
  const { data: existing, error: existErr } = await db
    .from("Project")
    .select("*")
    .eq("id", id)
    .eq("workspaceId", workspace.id)
    .maybeSingle();

  if (existErr) throw existErr;
  if (!existing)
    return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });

  const { error: delErr } = await db
    .from("Project")
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
      action: "deleted_project",
      entityType: "PROJECT",
      entityId: id,
      message: `${user.name ?? "Someone"} deleted project ${existing.name}`,
    });

  if (actErr) throw actErr;

  return NextResponse.json({ ok: true });
}
