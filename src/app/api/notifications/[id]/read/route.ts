import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";

type Params = { params: Promise<{ id: string }> };

/** Mark a single notification as read. */
export async function PATCH(_req: Request, { params }: Params) {
  const { user } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { error } = await db
    .from("Notification")
    .update({ read: true })
    .eq("id", id)
    .eq("userId", user.id);

  if (error) throw error;

  return NextResponse.json({ ok: true });
}
