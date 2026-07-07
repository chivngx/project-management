import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";

const schema = z.object({
  currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại"),
  newPassword: z
    .string()
    .min(8, "Mật khẩu mới phải có ít nhất 8 ký tự")
    .regex(/[A-Z]/, "Mật khẩu mới phải có ít nhất 1 chữ in hoa")
    .regex(/[a-z]/, "Mật khẩu mới phải có ít nhất 1 chữ thường")
    .regex(/[0-9]/, "Mật khẩu mới phải có ít nhất 1 chữ số")
    .max(100),
});

export async function PATCH(req: Request) {
  const { user } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  // Fetch the current password hash.
  const record = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const valid = await bcrypt.compare(currentPassword, record.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Mật khẩu hiện tại không đúng" },
      { status: 400 }
    );
  }

  // Disallow reusing the same password.
  const sameAsOld = await bcrypt.compare(newPassword, record.passwordHash);
  if (sameAsOld) {
    return NextResponse.json(
      { error: "Mật khẩu mới phải khác mật khẩu hiện tại" },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  // Increment tokenVersion to invalidate all existing sessions (JWT
  // revocation): the jwt callback checks tokenVersion against the DB.
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash, tokenVersion: { increment: 1 } },
  });

  return NextResponse.json({ ok: true });
}
