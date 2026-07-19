import { NextResponse } from "next/server";
import { z } from "zod";
import { ProjectService } from "@/services/project.service";
import { getApiContext, canAdmin, forbidden } from "@/lib/api-context";
import { PROJECT_PRIORITIES, PROJECT_STATUSES } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  const project = await ProjectService.getProjectDetail(id, workspace.id);
  if (!project) {
    return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
  }

  return NextResponse.json(project);
}

const patchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(PROJECT_STATUSES).optional(),
  priority: z.enum(PROJECT_PRIORITIES).optional(),
  startDate: z.string().datetime().optional().nullable(),
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

  try {
    const updated = await ProjectService.updateProject(id, workspace.id, { id: user.id, name: user.name }, parsed.data);
    return NextResponse.json({ id: updated.id });
  } catch (e: any) {
    if (e.message === "PROJECT_NOT_FOUND") {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }
    if (e.message === "INVALID_DATES") {
      return NextResponse.json(
        { error: "Ngày kết thúc không được trước ngày bắt đầu" },
        { status: 400 }
      );
    }
    console.error("Project update error:", e);
    return NextResponse.json({ error: "Đã xảy ra lỗi hệ thống" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { user, workspace, membership } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  // Authorization: only OWNER/ADMIN may delete a project.
  if (!canAdmin(membership)) return forbidden("Chỉ quản trị viên mới được xóa dự án");

  const { id } = await params;

  try {
    await ProjectService.deleteProject(id, workspace.id, { id: user.id, name: user.name }, membership?.role ?? "MEMBER");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message === "FORBIDDEN") {
      return forbidden("Chỉ quản trị viên mới được xóa dự án");
    }
    if (e.message === "PROJECT_NOT_FOUND") {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }
    console.error("Project deletion error:", e);
    return NextResponse.json({ error: "Đã xảy ra lỗi hệ thống" }, { status: 500 });
  }
}
