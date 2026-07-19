import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";

export async function GET() {
  const { user } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch the full user record (including image) from the DB, since the
  // session may lag behind after an edit.
  const { data: full, error } = await db
    .from("User")
    .select("id, name, email, image")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!full) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(full);
}

const patchSchema = z.object({
  name: z
    .string()
    .min(2, "Tên phải có ít nhất 2 ký tự")
    .max(60, "Tên không quá 60 ký tự")
    .optional(),
  image: z
    .string()
    .url("URL ảnh không hợp lệ")
    .max(2048, "URL quá dài")
    .nullable()
    .optional(),
});

export async function PATCH(req: Request) {
  const { user } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );
  }

  const updateData: any = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.image !== undefined) updateData.image = parsed.data.image;

  const { data: updated, error: updateErr } = await db
    .from("User")
    .update(updateData)
    .eq("id", user.id)
    .select("id, name, email, image")
    .single();

  if (updateErr) throw updateErr;

  return NextResponse.json(updated);
}
