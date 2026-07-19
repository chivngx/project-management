import { NextResponse } from "next/server";
import { z } from "zod";
import { ProjectService } from "@/services/project.service";
import { getApiContext } from "@/lib/api-context";
import { PROJECT_PRIORITIES, PROJECT_STATUSES } from "@/lib/constants";

export async function GET() {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json([]);

  const projects = await ProjectService.listProjects(workspace.id);
  return NextResponse.json(projects);
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
  memberIds: z.array(z.string().min(1)).optional(),
});

export async function POST(req: Request) {
  const { user, workspace, membership } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace)
    return NextResponse.json({ error: "Không có workspace" }, { status: 400 });

  const role = membership?.role;
  if (role !== "OWNER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ chủ sở hữu hoặc quản trị viên mới được phép tạo dự án" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );
  }

  try {
    const project = await ProjectService.createProject(workspace.id, { id: user.id, name: user.name }, parsed.data);
    return NextResponse.json({ id: project.id });
  } catch (e: any) {
    if (e.message === "INVALID_DATES") {
      return NextResponse.json(
        { error: "Ngày kết thúc không được trước ngày bắt đầu" },
        { status: 400 }
      );
    }
    console.error("Project creation error:", e);
    return NextResponse.json({ error: "Đã xảy ra lỗi hệ thống" }, { status: 500 });
  }
}
