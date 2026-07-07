import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";

export async function GET() {
  const { user } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await db.workspaceMember.findMany({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { joinedAt: "asc" },
  });

  return NextResponse.json(
    memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      image: m.workspace.image,
      role: m.role,
    }))
  );
}

const createSchema = z.object({
  name: z.string().min(2).max(60),
});

export async function POST(req: Request) {
  const { user } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Tên không hợp lệ" }, { status: 400 });
  }

  const workspace = await db.workspace.create({
    data: {
      name: parsed.data.name,
      ownerId: user.id,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  await db.activity.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      action: "created_workspace",
      entityType: "WORKSPACE",
      entityId: workspace.id,
      message: `${user.name ?? "Someone"} created workspace ${workspace.name}`,
    },
  });

  return NextResponse.json({
    id: workspace.id,
    name: workspace.name,
    image: workspace.image,
  });
}
