import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRepository } from "@/repositories/user.repository";
import { getApiContext } from "@/lib/api-context";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { user } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const full = await UserRepository.findById(user.id);
  if (!full) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: full.id,
    name: full.name,
    username: full.username,
    email: full.email,
    image: full.image,
    hasPassword: full.passwordHash !== "google_oauth_no_password",
  });
}

const patchSchema = z.object({
  name: z
    .string()
    .min(2, "Tên phải có ít nhất 2 ký tự")
    .max(60, "Tên không quá 60 ký tự")
    .optional(),
  username: z
    .string()
    .min(3, "Username phải có ít nhất 3 ký tự")
    .max(30, "Username không quá 30 ký tự")
    .regex(/^[a-zA-Z0-9_]+$/, "Username chỉ chứa chữ cái, số và dấu gạch dưới")
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

  const record = await UserRepository.findById(user.id);
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updateData: any = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  
  if (parsed.data.image !== undefined) {
    updateData.image = parsed.data.image;
    // Delete old avatar from storage if removing
    if (parsed.data.image === null && record.image && record.image.includes("/avatars/")) {
      const oldFileName = record.image.split("/avatars/").pop();
      if (oldFileName) {
        try {
          await supabaseAdmin.storage.from("avatars").remove([oldFileName]);
        } catch (delErr) {
          console.error("Failed to delete old avatar file on removal:", delErr);
        }
      }
    }
  }

  if (parsed.data.username !== undefined) {
    const normalizedUsername = parsed.data.username.trim().toLowerCase();
    const existing = await UserRepository.findByUsername(normalizedUsername);
    if (existing && existing.id !== user.id) {
      return NextResponse.json({ error: "Username đã được sử dụng" }, { status: 409 });
    }
    updateData.username = normalizedUsername;
  }

  const updated = await UserRepository.update(user.id, updateData);

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    username: updated.username,
    email: updated.email,
    image: updated.image,
    hasPassword: updated.passwordHash !== "google_oauth_no_password",
  });
}
