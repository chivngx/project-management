import { NextResponse } from "next/server";
import { z } from "zod";
import { GitService } from "@/services/git.service";
import { getApiContext } from "@/lib/api-context";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id: projectId } = await params;
  const { searchParams } = new URL(req.url);
  const integrationId = searchParams.get("integrationId");

  try {
    const data = await GitService.getUnlinkedIssues(projectId, workspace.id, integrationId);
    return NextResponse.json(data);
  } catch (e: any) {
    if (e.message === "PROJECT_NOT_FOUND") {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }
    if (e.message === "INTEGRATION_NOT_FOUND") {
      return NextResponse.json({ error: "Dự án chưa cấu hình tích hợp Git" }, { status: 400 });
    }
    console.error("Git sync issues GET error:", e);
    return NextResponse.json({ error: e.message || "Không thể tải danh sách issue từ Git" }, { status: 500 });
  }
}

const syncSchema = z.object({
  integrationId: z.string().optional(),
  issues: z.array(z.object({
    id: z.string(),
    number: z.number(),
    title: z.string(),
    description: z.string().optional().nullable(),
    url: z.string(),
  })).optional(),
});

export async function POST(req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id: projectId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = syncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu yêu cầu không hợp lệ" }, { status: 400 });
  }

  const { integrationId, issues } = parsed.data;

  try {
    const res = await GitService.syncIssues(projectId, workspace.id, user.id, integrationId || null, issues || []);
    return NextResponse.json({ ok: true, ...res });
  } catch (e: any) {
    if (e.message === "PROJECT_NOT_FOUND") {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }
    if (e.message === "INTEGRATION_NOT_FOUND") {
      return NextResponse.json({ error: "Dự án chưa cấu hình tích hợp Git" }, { status: 400 });
    }
    console.error("Git sync issues POST error:", e);
    return NextResponse.json({ error: e.message || "Lỗi đồng bộ hoá" }, { status: 500 });
  }
}
