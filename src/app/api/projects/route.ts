import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";
import { PROJECT_PRIORITIES, PROJECT_STATUSES } from "@/lib/constants";

export async function GET() {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json([]);

  const { data: rawProjects, error } = await db
    .from("Project")
    .select("*, members:ProjectMember(*, user:User(id, name, email, image)), tasks:Task(status)")
    .eq("workspaceId", workspace.id)
    .order("createdAt", { ascending: false });

  if (error) throw error;
  const projects = (rawProjects || []) as any[];

  return NextResponse.json(
    projects.map((p) => {
      const total = p.tasks?.length || 0;
      const done = (p.tasks || []).filter((t: any) => t.status === "DONE").length;
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        priority: p.priority,
        startDate: p.startDate,
        dueDate: p.dueDate,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        memberCount: p.members?.length || 0,
        members: (p.members || []).map((m: any) => ({
          id: m.user?.id,
          name: m.user?.name,
          email: m.user?.email,
          image: m.user?.image,
        })),
        taskCount: total,
        doneCount: done,
      };
    })
  );
}

const createSchema = z.object({
  name: z
    .string()
    .min(2, "Tên dự án phải có ít nhất 2 ký tự")
    .max(80, "Tên dự án không quá 80 ký tự"),
  description: z
    .string()
    .max(500, "Mô tả không quá 500 ký tự")
    .optional()
    .nullable(),
  status: z.enum(PROJECT_STATUSES).optional(),
  priority: z.enum(PROJECT_PRIORITIES).optional(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  memberIds: z.array(z.string().min(1)).optional(),
});

export async function POST(req: Request) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace)
    return NextResponse.json({ error: "Không có workspace" }, { status: 400 });

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );
  }
  const d = parsed.data;

  // Cross-field validation: dueDate must be on/after startDate (if both set).
  if (d.startDate && d.dueDate && new Date(d.dueDate) < new Date(d.startDate)) {
    return NextResponse.json(
      { error: "Ngày kết thúc không được trước ngày bắt đầu" },
      { status: 400 }
    );
  }

  // Validate memberIds belong to the workspace.
  let validMembers: any[] = [];
  if (d.memberIds && d.memberIds.length > 0) {
    const { data: membersData, error: memberErr } = await db
      .from("WorkspaceMember")
      .select("userId")
      .eq("workspaceId", workspace.id)
      .in("userId", d.memberIds);
    if (memberErr) throw memberErr;
    validMembers = membersData || [];
  }

  const newProjectId = crypto.randomUUID();
  const { data: project, error: projErr } = await db
    .from("Project")
    .insert({
      id: newProjectId,
      workspaceId: workspace.id,
      name: d.name,
      description: d.description ?? null,
      status: d.status ?? "ACTIVE",
      priority: d.priority ?? "MEDIUM",
      startDate: d.startDate ? new Date(d.startDate).toISOString() : null,
      dueDate: d.dueDate ? new Date(d.dueDate).toISOString() : null,
    })
    .select()
    .single();

  if (projErr) throw projErr;

  // Insert project members
  const memberInserts = [
    {
      id: crypto.randomUUID(),
      projectId: project.id,
      userId: user.id,
      role: "MEMBER",
    },
    ...validMembers
      .filter((m) => m.userId !== user.id)
      .map((m) => ({
        id: crypto.randomUUID(),
        projectId: project.id,
        userId: m.userId,
        role: "MEMBER",
      })),
  ];

  const { error: pmErr } = await db
    .from("ProjectMember")
    .insert(memberInserts);

  if (pmErr) throw pmErr;

  const newActivityId = crypto.randomUUID();
  const { error: actErr } = await db
    .from("Activity")
    .insert({
      id: newActivityId,
      workspaceId: workspace.id,
      userId: user.id,
      action: "created_project",
      entityType: "PROJECT",
      entityId: project.id,
      message: `${user.name ?? "Someone"} created project ${project.name}`,
    });

  if (actErr) throw actErr;

  return NextResponse.json({ id: project.id });
}
