import { NextResponse } from "next/server";
import { WorkspaceService } from "@/services/workspace.service";
import { getApiContext } from "@/lib/api-context";

type Params = { params: Promise<{ id: string }> };

/** Leave a workspace (remove your own membership). Owners must transfer
 * ownership or delete the workspace instead. */
export async function DELETE(_req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  if (id !== workspace.id) {
    return NextResponse.json({ error: "Workspace không khớp" }, { status: 400 });
  }

  try {
    await WorkspaceService.leaveWorkspace(workspace.id, user.id, user.name ?? "Someone");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message === "OWNER_CANNOT_LEAVE") {
      return NextResponse.json(
        {
          error:
            "Chủ workspace không thể rời đi. Hãy chuyển quyền sở hữu hoặc xóa workspace.",
        },
        { status: 400 }
      );
    }
    console.error("Leave workspace error:", e);
    return NextResponse.json({ error: "Đã xảy ra lỗi hệ thống" }, { status: 500 });
  }
}
