import { NextResponse } from "next/server";
import { z } from "zod";
import { WorkspaceService } from "@/services/workspace.service";
import { getApiContext } from "@/lib/api-context";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  newOwnerId: z.string().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  if (id !== workspace.id) {
    return NextResponse.json({ error: "Workspace không khớp" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );

  try {
    await WorkspaceService.updateWorkspace(workspace.id, user.id, user.name ?? "Someone", {
      name: parsed.data.name,
      ownerId: parsed.data.newOwnerId,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Chỉ chủ workspace mới được thay đổi" }, { status: 403 });
    }
    if (e.message === "NEW_OWNER_NOT_MEMBER") {
      return NextResponse.json({ error: "Thành viên không hợp lệ" }, { status: 400 });
    }
    console.error("Workspace update error:", e);
    return NextResponse.json({ error: "Đã xảy ra lỗi hệ thống" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  if (id !== workspace.id) {
    return NextResponse.json({ error: "Workspace không khớp" }, { status: 400 });
  }

  try {
    await WorkspaceService.deleteWorkspace(workspace.id, user.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Chỉ chủ workspace mới được xóa" }, { status: 403 });
    }
    console.error("Workspace deletion error:", e);
    return NextResponse.json({ error: "Đã xảy ra lỗi hệ thống" }, { status: 500 });
  }
}
