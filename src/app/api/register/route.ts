import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthService } from "@/services/auth.service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().min(2, "Tên phải có ít nhất 2 ký tự").max(60),
  username: z
    .string()
    .min(3, "Username phải có ít nhất 3 ký tự")
    .max(30, "Username không được vượt quá 30 ký tự")
    .regex(/^[a-zA-Z0-9_]+$/, "Username chỉ được chứa chữ cái, số và dấu gạch dưới"),
  email: z.string().email("Email không hợp lệ"),
  password: z
    .string()
    .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
    .regex(/[A-Z]/, "Mật khẩu phải có ít nhất 1 chữ in hoa")
    .regex(/[a-z]/, "Mật khẩu phải có ít nhất 1 chữ thường")
    .regex(/[0-9]/, "Mật khẩu phải có ít nhất 1 chữ số"),
});

export async function POST(req: Request) {
  try {
    // Rate limit: 5 registrations per hour per IP.
    const ip = getClientIp(req);
    const rl = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Quá nhiều lần đăng ký. Vui lòng thử lại sau." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { name, username, email, password } = parsed.data;

    await AuthService.registerUser(name, email, password, username);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message === "EMAIL_TAKEN") {
      return NextResponse.json({ error: "Email đã được sử dụng" }, { status: 409 });
    }
    if (e.message === "USERNAME_TAKEN") {
      return NextResponse.json({ error: "Username đã được sử dụng" }, { status: 409 });
    }
    console.error("Registration error:", e);
    return NextResponse.json({ error: "Đã xảy ra lỗi hệ thống" }, { status: 500 });
  }
}
