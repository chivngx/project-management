import { NextResponse } from "next/server";
import { z } from "zod";
import { TaskService } from "@/services/task.service";
import { getApiContext, canAdmin, forbidden } from "@/lib/api-context";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { ProjectRepository } from "@/repositories/project.repository";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { user, workspace, membership } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;

  const isProjectMember = await ProjectRepository.findMembership(id, user.id);
  const isOwnerOrAdmin = membership?.role === "OWNER" || membership?.role === "ADMIN";
  if (!isProjectMember && !isOwnerOrAdmin) {
    return forbidden("Bạn không có quyền truy cập tác vụ của dự án này");
  }

  try {
    const tasks = await TaskService.listTasks(id, workspace.id);
    return NextResponse.json(tasks);
  } catch (e: any) {
    if (e.message === "PROJECT_NOT_FOUND") {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }
    console.error("List tasks error:", e);
    return NextResponse.json({ error: "Đã xảy ra lỗi hệ thống" }, { status: 500 });
  }
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
  dueDate: z
    .string()
    .datetime()
    .refine((val) => {
      if (!val) return true;
      const limit = new Date();
      limit.setDate(limit.getDate() - 1); // 1-day safety margin for timezone offsets
      limit.setHours(0, 0, 0, 0);
      const selected = new Date(val);
      return selected >= limit;
    }, "Ngày hạn không được trước ngày hiện tại")
    .optional()
    .nullable(),
});

export async function POST(req: Request, { params }: Params) {
  const { user, workspace, membership } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;

  // Authorization: caller must be a member of this project OR a workspace admin.
  const isProjectMember = await ProjectRepository.findMembership(id, user.id);

  if (!isProjectMember && !canAdmin(membership))
    return forbidden("Bạn phải là thành viên dự án để tạo tác vụ");

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );

  try {
    const task = await TaskService.createTask(id, workspace.id, { id: user.id, name: user.name }, parsed.data);
    return NextResponse.json(task);
  } catch (e: any) {
    if (e.message === "PROJECT_NOT_FOUND") {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }
    if (e.message === "ASSIGNEE_NOT_PROJECT_MEMBER") {
      return NextResponse.json(
        { error: "Người được giao không phải thành viên dự án" },
        { status: 400 }
      );
    }
    console.error("Task creation error:", e);
    return NextResponse.json({ error: "Đã xảy ra lỗi hệ thống" }, { status: 500 });
  }
}
