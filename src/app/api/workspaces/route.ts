import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";

export async function GET() {
  const { user } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: rawMemberships, error } = await db
    .from("WorkspaceMember")
    .select("*, workspace:Workspace(*)")
    .eq("userId", user.id)
    .order("joinedAt", { ascending: true });

  if (error) throw error;
  const memberships = (rawMemberships || []) as any[];

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

  const newWorkspaceId = crypto.randomUUID();
  const { data: workspace, error: wsErr } = await db
    .from("Workspace")
    .insert({
      id: newWorkspaceId,
      name: parsed.data.name,
      ownerId: user.id,
    })
    .select()
    .single();

  if (wsErr) throw wsErr;

  const newMemberId = crypto.randomUUID();
  const { error: memberErr } = await db
    .from("WorkspaceMember")
    .insert({
      id: newMemberId,
      workspaceId: workspace.id,
      userId: user.id,
      role: "OWNER",
    });

  if (memberErr) throw memberErr;

  const newActivityId = crypto.randomUUID();
  const { error: actErr } = await db
    .from("Activity")
    .insert({
      id: newActivityId,
      workspaceId: workspace.id,
      userId: user.id,
      action: "created_workspace",
      entityType: "WORKSPACE",
      entityId: workspace.id,
      message: `${user.name ?? "Someone"} created workspace ${workspace.name}`,
    });

  if (actErr) throw actErr;

  return NextResponse.json({
    id: workspace.id,
    name: workspace.name,
    image: workspace.image,
  });
}
