import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";
import { setActiveWorkspaceCookie } from "@/lib/workspace";

export async function GET() {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No active workspace" }, { status: 400 });

  return NextResponse.json({
    id: workspace.id,
    name: workspace.name,
    image: workspace.image,
  });
}

const schema = z.object({ workspaceId: z.string().min(1) });

export async function POST(req: Request) {
  const { user } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "workspaceId là bắt buộc" }, { status: 400 });
  }

  // Verify membership before setting the cookie.
  const membership = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: parsed.data.workspaceId,
        userId: user.id,
      },
    },
  });
  if (!membership) {
    return NextResponse.json(
      { error: "Bạn không thuộc workspace này" },
      { status: 403 }
    );
  }

  await setActiveWorkspaceCookie(parsed.data.workspaceId);
  return NextResponse.json({ ok: true });
}
