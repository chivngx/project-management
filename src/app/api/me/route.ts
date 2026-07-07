import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";

export async function GET() {
  const { user } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch the full user record (including image) from the DB, since the
  // session may lag behind after an edit.
  const full = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, email: true, image: true },
  });
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

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.image !== undefined ? { image: parsed.data.image } : {}),
    },
    select: { id: true, name: true, email: true, image: true },
  });

  return NextResponse.json(updated);
}
