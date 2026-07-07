import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tác vụ của tôi",
  description: "Tất cả tác vụ được giao cho bạn trong workspace.",
};

export default function MyTasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
