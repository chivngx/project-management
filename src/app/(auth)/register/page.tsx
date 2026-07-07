"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, Layers, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";

const registerSchema = z
  .object({
    name: z.string().min(2, "Tên phải có ít nhất 2 ký tự").max(60),
    email: z.string().email("Email không hợp lệ"),
    password: z
      .string()
      .min(8, "Ít nhất 8 ký tự")
      .regex(/[A-Z]/, "Phải có ít nhất 1 chữ in hoa")
      .regex(/[a-z]/, "Phải có ít nhất 1 chữ thường")
      .regex(/[0-9]/, "Phải có ít nhất 1 chữ số"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirm"],
  });

// Password strength rules
const passwordRules = [
  { label: "Ít nhất 8 ký tự", test: (p: string) => p.length >= 8 },
  { label: "Có chữ in hoa", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Có chữ thường", test: (p: string) => /[a-z]/.test(p) },
  { label: "Có chữ số", test: (p: string) => /[0-9]/.test(p) },
];

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [values, setValues] = React.useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  function setField<K extends keyof typeof values>(key: K, v: string) {
    setValues((p) => ({ ...p, [key]: v }));
    setErrors((p) => (p[key] ? { ...p, [key]: "" } : p));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString();
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const { name, email, password } = parsed.data;
      await apiFetch("/api/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!res || res.error) throw new Error("Đăng nhập sau đăng ký thất bại");
      toast.success("Tài khoản đã được tạo thành công!");
      router.replace("/");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  }

  const showStrength = values.password.length > 0;

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm lg:hidden">
          <Layers className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Tạo tài khoản</h1>
        <p className="text-sm text-muted-foreground">
          Bắt đầu quản lý dự án của bạn miễn phí.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm font-medium">
            Họ và tên
          </Label>
          <Input
            id="name"
            placeholder="Nguyễn Văn A"
            value={values.name}
            onChange={(e) => setField("name", e.target.value)}
            autoComplete="name"
            aria-invalid={!!errors.name}
            className="transition-shadow focus:shadow-sm"
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name}</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={values.email}
            onChange={(e) => setField("email", e.target.value)}
            autoComplete="email"
            aria-invalid={!!errors.email}
            className="transition-shadow focus:shadow-sm"
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium">
            Mật khẩu
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Ít nhất 8 ký tự"
              value={values.password}
              onChange={(e) => setField("password", e.target.value)}
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              className="pr-10 transition-shadow focus:shadow-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>

          {/* Password strength checklist */}
          {showStrength && (
            <div className="grid grid-cols-2 gap-1 pt-1">
              {passwordRules.map((rule) => {
                const ok = rule.test(values.password);
                return (
                  <div
                    key={rule.label}
                    className={cn(
                      "flex items-center gap-1.5 text-[11px] transition-colors",
                      ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                    )}
                  >
                    {ok ? (
                      <CheckCircle2 className="size-3 shrink-0" />
                    ) : (
                      <XCircle className="size-3 shrink-0 opacity-40" />
                    )}
                    {rule.label}
                  </div>
                );
              })}
            </div>
          )}
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password}</p>
          )}
        </div>

        {/* Confirm password */}
        <div className="space-y-1.5">
          <Label htmlFor="confirm" className="text-sm font-medium">
            Xác nhận mật khẩu
          </Label>
          <div className="relative">
            <Input
              id="confirm"
              type={showConfirm ? "text" : "password"}
              placeholder="Nhập lại mật khẩu"
              value={values.confirm}
              onChange={(e) => setField("confirm", e.target.value)}
              autoComplete="new-password"
              aria-invalid={!!errors.confirm}
              className="pr-10 transition-shadow focus:shadow-sm"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showConfirm ? "Ẩn" : "Hiện"}
            >
              {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.confirm && (
            <p className="text-xs text-destructive">{errors.confirm}</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full gap-2"
          disabled={loading}
          size="default"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          {loading ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
        </Button>
      </form>

      {/* Login link */}
      <div className="text-center text-sm text-muted-foreground">
        Đã có tài khoản?{" "}
        <Link
          href="/login"
          className="font-semibold text-foreground underline-offset-4 hover:underline"
        >
          Đăng nhập
        </Link>
      </div>
    </div>
  );
}
