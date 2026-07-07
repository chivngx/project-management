import { Loader2 } from "lucide-react";

export default function AppLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Đang tải…</p>
      </div>
    </div>
  );
}
