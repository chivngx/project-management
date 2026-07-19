import { NextResponse } from "next/server";
import { z } from "zod";
import { GitService } from "@/services/git.service";
import { getApiContext } from "@/lib/api-context";

type Params = { params: Promise<{ id: string }> };

const reposSchema = z.object({
  repoProvider: z.enum(["github", "gitlab"]),
  repoToken: z.string().min(1, "Personal Access Token không được để trống"),
  repoApiUrl: z.string().url("Đường dẫn API URL không hợp lệ").optional().nullable().or(z.literal("")),
});

export async function POST(req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const parsed = reposSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );
  }

  const { repoProvider, repoToken, repoApiUrl } = parsed.data;

  try {
    const repos = await GitService.fetchUserRepositories(repoProvider, repoToken, repoApiUrl);
    return NextResponse.json({ repos });
  } catch (err: any) {
    console.error("Error in fetching repos:", err);
    return NextResponse.json({ error: err.message || "Không thể tải danh sách repository" }, { status: 500 });
  }
}
