import { Layers, CheckCircle2 } from "lucide-react";

const features = [
  "Tạo workspace và quản lý dự án trong một nơi",
  "Kanban board kéo thả — theo dõi tác vụ trực quan",
  "Cộng tác đội nhóm theo thời gian thực",
  "Dashboard tổng hợp tiến độ toàn dự án",
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-white lg:flex">
        {/* Subtle radial glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-zinc-800/60 blur-2xl" />
        </div>

        {/* Dot grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2.5 text-lg font-semibold">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/30">
            <Layers className="h-5 w-5" />
          </div>
          <span className="tracking-tight">ProjectFlow</span>
        </div>

        {/* Main headline */}
        <div className="relative z-10 space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold leading-tight tracking-tight">
              Quản lý dự án, task &amp; đội nhóm —{" "}
              <span className="text-zinc-400">tất cả trong một nơi.</span>
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-zinc-500">
              Nền tảng quản lý công việc full-stack dành cho đội nhóm hiện đại.
              Từ lên kế hoạch đến bàn giao, mọi thứ đều trong tầm kiểm soát.
            </p>
          </div>

          {/* Feature list */}
          <ul className="space-y-2.5">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-400">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between">
          <p className="text-xs text-zinc-600">
            © {new Date().getFullYear()} ProjectFlow. Demo full-stack.
          </p>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1 rounded-full bg-zinc-700"
                style={{ width: i === 0 ? "20px" : "6px" }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-sm animate-fade-up">{children}</div>
      </div>
    </div>
  );
}
