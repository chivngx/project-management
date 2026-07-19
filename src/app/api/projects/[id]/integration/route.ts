import { NextResponse } from "next/server";
import { z } from "zod";
import { GitService } from "@/services/git.service";
import { getApiContext } from "@/lib/api-context";

type Params = { params: Promise<{ id: string }> };

const integrationSchema = z.object({
  repoProvider: z.enum(["github", "gitlab"]),
  repoOwner: z.string().min(1, "Owner/Organization không được để trống"),
  repoName: z.string().min(1, "Tên repository không được để trống"),
  repoToken: z.string().min(1, "Personal Access Token không được để trống"),
  repoApiUrl: z.string().url("Đường dẫn API URL không hợp lệ").optional().nullable().or(z.literal("")),
  repoWebhookSecret: z.string().optional().nullable(),
});

export async function GET(req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id: projectId } = await params;
  const { searchParams } = new URL(req.url);
  const selectedIntegrationId = searchParams.get("integrationId");

  try {
    const meta = await GitService.getIntegrationMeta(projectId, workspace.id, selectedIntegrationId);
    return NextResponse.json(meta);
  } catch (e: any) {
    console.error("Fetch integration metadata error:", e);
    return NextResponse.json({ error: "Đã xảy ra lỗi khi lấy cấu hình tích hợp" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id: projectId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = integrationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu cấu hình không hợp lệ" },
      { status: 400 }
    );
  }

  try {
    const res = await GitService.createIntegration(projectId, workspace.id, parsed.data);
    return NextResponse.json(res);
  } catch (e: any) {
    if (e.message === "PROJECT_NOT_FOUND") {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }
    console.error("Create integration error:", e);
    return NextResponse.json({ error: "Đã xảy ra lỗi khi lưu cấu hình tích hợp" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id: projectId } = await params;
  const { searchParams } = new URL(req.url);
  const integrationId = searchParams.get("integrationId");

  try {
    await GitService.deleteIntegration(projectId, workspace.id, integrationId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message === "PROJECT_NOT_FOUND") {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }
    if (e.message === "INTEGRATION_NOT_FOUND") {
      return NextResponse.json({ error: "Không tìm thấy cấu hình tích hợp cần xóa" }, { status: 404 });
    }
    console.error("Delete integration error:", e);
    return NextResponse.json({ error: "Đã xảy ra lỗi khi xóa cấu hình tích hợp" }, { status: 500 });
  }
}
