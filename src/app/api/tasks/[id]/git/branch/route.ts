import { NextResponse } from "next/server";
import { GitService } from "@/services/git.service";
import { getApiContext } from "@/lib/api-context";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;

  try {
    const res = await GitService.createGitBranch(id, workspace.id, { id: user.id, name: user.name });
    return NextResponse.json(res);
  } catch (e: any) {
    if (e.message === "TASK_NOT_FOUND") {
      return NextResponse.json({ error: "Không tìm thấy tác vụ" }, { status: 404 });
    }
    if (e.message === "NO_GIT_INTEGRATION") {
      return NextResponse.json({ error: "Tác vụ này chưa được liên kết với Repository Git nào" }, { status: 400 });
    }
    console.error("Error creating branch:", e);
    return NextResponse.json({ error: e.message || "Không thể tạo nhánh Git" }, { status: 500 });
  }
}
