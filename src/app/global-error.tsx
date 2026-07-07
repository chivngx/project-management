"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";

// Catastrophic error boundary — renders when the root layout itself crashes.
// Must include its own <html> and <body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="vi">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#ffffff",
          color: "#18181b",
        }}
      >
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "9999px",
              background: "rgba(239,68,68,0.1)",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AlertTriangle size={28} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
            Lỗi ứng dụng
          </h1>
          <p style={{ color: "#71717a", maxWidth: 400, margin: 0 }}>
            Ứng dụng gặp lỗi nghiêm trọng. Vui lòng tải lại trang hoặc liên hệ
            quản trị viên nếu lỗi vẫn tiếp diễn.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 8,
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #e4e4e7",
              background: "#18181b",
              color: "#ffffff",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Thử lại
          </button>
        </div>
      </body>
    </html>
  );
}
