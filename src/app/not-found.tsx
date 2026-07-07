import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Compass className="h-8 w-8" />
      </div>
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">404</h1>
        <h2 className="text-lg font-medium">Không tìm thấy trang</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Trang bạn tìm có thể đã bị xóa, đổi tên, hoặc tạm thời không khả dụng.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Về trang chủ</Link>
      </Button>
    </div>
  );
}
