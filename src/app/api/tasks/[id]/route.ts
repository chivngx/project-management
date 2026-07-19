import { NextResponse } from "next/server";
import { z } from "zod";
import { TaskService } from "@/services/task.service";
import { getApiContext, forbidden } from "@/lib/api-context";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";

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

export async function PATCH(req: Request, { params }: Params) {
  const { user, workspace, membership } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );

  try {
    const updated = await TaskService.updateTask(
      id,
      workspace.id,
      { id: user.id, name: user.name },
      membership?.role ?? "MEMBER",
      parsed.data
    );
    return NextResponse.json({ id: updated.id });
  } catch (e: any) {
    if (e.message === "TASK_NOT_FOUND") {
      return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });
    }
    if (e.message === "FORBIDDEN") {
      return forbidden("Bạn chỉ có thể sửa tác vụ do mình tạo hoặc được giao");
    }
    if (e.message === "ASSIGNEE_NOT_PROJECT_MEMBER") {
      return NextResponse.json(
        { error: "Người được giao không phải thành viên dự án" },
        { status: 400 }
      );
    }
    console.error("Task update error:", e);
    return NextResponse.json({ error: "Đã xảy ra lỗi hệ thống" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { user, workspace, membership } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;

  try {
    await TaskService.deleteTask(id, workspace.id, { id: user.id, name: user.name }, membership?.role ?? "MEMBER");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message === "TASK_NOT_FOUND") {
      return NextResponse.json({ error: "Không tìm thấy task" }, { status: 404 });
    }
    if (e.message === "FORBIDDEN") {
      return forbidden("Bạn chỉ có thể xóa tác vụ do mình tạo");
    }
    console.error("Task deletion error:", e);
    return NextResponse.json({ error: "Đã xảy ra lỗi hệ thống" }, { status: 500 });
  }
}
