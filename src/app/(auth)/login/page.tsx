"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, Layers, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [redirectTarget, setRedirectTarget] = React.useState("/");

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const cb = params.get("callbackUrl");
      if (cb) {
        setRedirectTarget(cb);
        // Clean URL parameter visually
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
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
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!res || res.error) {
        throw new Error(res?.error ?? "Email hoặc mật khẩu không đúng");
      }
      toast.success("Đăng nhập thành công");
      router.replace(redirectTarget);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm lg:hidden">
          <Layers className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Đăng nhập</h1>
        <p className="text-sm text-muted-foreground">
          Chào mừng trở lại! Đăng nhập để tiếp tục.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((p) => ({ ...p, email: "" }));
            }}
            required
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            className="transition-shadow focus:shadow-sm"
          />
          {errors.email && (
            <p id="email-error" className="text-xs text-destructive">
              {errors.email}
            </p>
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
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((p) => ({ ...p, password: "" }));
              }}
              required
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
              className="pr-10 transition-shadow focus:shadow-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className="text-xs text-destructive">
              {errors.password}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full gap-2"
          disabled={loading}
          size="default"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          {loading ? "Đang đăng nhập…" : "Đăng nhập"}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/80"></div>
        </div>
        <span className="relative bg-background px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Hoặc tiếp tục với
        </span>
      </div>

      {/* Google Sign-in */}
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2 transition-all hover:bg-accent/40"
        disabled={loading}
        onClick={() => {
          setLoading(true);
          signIn("google", { callbackUrl: redirectTarget });
        }}
      >
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#EA4335"
            d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.359 0 3.373 2.673 1.455 6.573l3.81 3.192z"
          />
          <path
            fill="#FBBC05"
            d="M1.455 6.573A11.968 11.968 0 0 0 0 12c0 1.95.464 3.791 1.286 5.427l3.968-3.073a7.037 7.037 0 0 1-.527-2.354c0-1.8.627-3.464 1.677-4.79L1.455 6.573z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.245 0 6.136-1.077 8.182-2.927l-3.955-3.064c-1.127.755-2.564 1.209-4.227 1.209-3.268 0-6.04-2.209-7.027-5.182l-3.968 3.073C3.018 21.145 6.945 24 12 24z"
          />
          <path
            fill="#4285F4"
            d="M23.49 12.273c0-.818-.082-1.609-.227-2.373H12v4.518h6.464a5.532 5.532 0 0 1-2.4 3.636l3.955 3.064c2.309-2.127 3.473-5.264 3.473-8.845z"
          />
        </svg>
        Google
      </Button>

      {/* Demo credentials */}
      {process.env.NODE_ENV === "development" && (
        <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">🔑 Tài khoản demo:</p>
          <p>
            Email:{" "}
            <button
              type="button"
              className="font-mono text-foreground hover:underline"
              onClick={() => setEmail("alex@example.com")}
            >
              alex@example.com
            </button>
          </p>
          <p>
            Mật khẩu:{" "}
            <button
              type="button"
              className="font-mono text-foreground hover:underline"
              onClick={() => setPassword("password123")}
            >
              password123
            </button>
          </p>
        </div>
      )}

      {/* Register link */}
      <div className="text-center text-sm text-muted-foreground">
        Chưa có tài khoản?{" "}
        <Link
          href="/register"
          className="font-semibold text-foreground underline-offset-4 hover:underline"
        >
          Đăng ký ngay
        </Link>
      </div>
    </div>
  );
}
