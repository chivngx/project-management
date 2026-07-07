import { Layers } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-white lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_45%)]" />
        <div className="relative z-10 flex items-center gap-2 text-lg font-semibold">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-zinc-950">
            <Layers className="h-5 w-5" />
          </div>
          ProjectFlow
        </div>
        <div className="relative z-10 space-y-3">
          <h1 className="text-3xl font-bold leading-tight">
            Quản lý dự án, task &amp; đội nhóm — tất cả trong một nơi.
          </h1>
          <p className="max-w-md text-zinc-400">
            Tạo workspace, dự án, giao task, theo dõi tiến độ và cộng tác cùng
            đội ngũ của bạn theo thời gian thực.
          </p>
        </div>
        <div className="relative z-10 text-sm text-zinc-500">
          © {new Date().getFullYear()} ProjectFlow. Demo full-stack.
        </div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
