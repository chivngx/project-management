import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đội nhóm",
  description: "Thành viên workspace và quản lý vai trò.",
};

export default function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
