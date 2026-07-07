"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Đã xảy ra lỗi</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Trang không tải được. Vui lòng thử lại, hoặc tải lại trang nếu lỗi vẫn
          tiếp diễn.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset} variant="default">
          <RotateCcw className="mr-2 h-4 w-4" /> Thử lại
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Về trang chủ</Link>
        </Button>
      </div>
    </div>
  );
}
