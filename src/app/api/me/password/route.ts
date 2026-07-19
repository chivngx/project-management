import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { UserRepository } from "@/repositories/user.repository";
import { getApiContext } from "@/lib/api-context";

const schema = z.object({
  currentPassword: z.string().optional(),
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

  const record = await UserRepository.findById(user.id);
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hasPassword = record.passwordHash !== "google_oauth_no_password";

  if (hasPassword) {
    if (!currentPassword) {
      return NextResponse.json(
        { error: "Vui lòng nhập mật khẩu hiện tại" },
        { status: 400 }
      );
    }

    const valid = await bcrypt.compare(currentPassword, record.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Mật khẩu hiện tại không đúng" },
        { status: 400 }
      );
    }

    // Disallow reusing the same password
    const sameAsOld = await bcrypt.compare(newPassword, record.passwordHash);
    if (sameAsOld) {
      return NextResponse.json(
        { error: "Mật khẩu mới phải khác mật khẩu hiện tại" },
        { status: 400 }
      );
    }
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  
  // Increment tokenVersion to invalidate all existing sessions
  await UserRepository.update(user.id, {
    passwordHash,
    tokenVersion: (record.tokenVersion || 0) + 1,
  });

  return NextResponse.json({ ok: true });
}
