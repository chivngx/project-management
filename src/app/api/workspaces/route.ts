import { NextResponse } from "next/server";
import { z } from "zod";
import { WorkspaceRepository } from "@/repositories/workspace.repository";
import { WorkspaceService } from "@/services/workspace.service";
import { getApiContext } from "@/lib/api-context";

export async function GET() {
  const { user } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await WorkspaceRepository.findMembershipsByUserId(user.id);

  return NextResponse.json(
    memberships.map((m: any) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      image: m.workspace.image,
      role: m.role,
    }))
  );
}

const createSchema = z.object({
  name: z
    .string()
    .min(2, "Tên workspace phải có ít nhất 2 ký tự")
    .max(60, "Tên workspace không quá 60 ký tự"),
});

export async function POST(req: Request) {
  const { user } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Tên không hợp lệ" }, { status: 400 });
  }

  try {
    const workspace = await WorkspaceService.createWorkspace(
      user.id,
      user.name ?? "Someone",
      parsed.data.name
    );

    return NextResponse.json({
      id: workspace.id,
      name: workspace.name,
      image: workspace.image,
    });
  } catch (e: any) {
    console.error("Workspace creation failed:", e);
    return NextResponse.json({ error: "Đã xảy ra lỗi hệ thống" }, { status: 500 });
  }
}
