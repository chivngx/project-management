"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!res || res.error) {
        throw new Error(res?.error ?? "Đăng nhập thất bại");
      }
      toast.success("Đăng nhập thành công");
      router.replace("/");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground lg:hidden">
          <Layers className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold">Đăng nhập</h1>
        <p className="text-sm text-muted-foreground">
          Chào mừng trở lại! Đăng nhập để tiếp tục.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Mật khẩu</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Đăng nhập
        </Button>
      </form>

      <div className="rounded-md border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Tài khoản demo:</p>
        <p className="mt-1">
          Email: <code className="font-mono">alex@example.com</code>
        </p>
        <p>
          Mật khẩu: <code className="font-mono">password123</code>
        </p>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Chưa có tài khoản?{" "}
        <Link
          href="/register"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Đăng ký
        </Link>
      </p>
    </div>
  );
}
