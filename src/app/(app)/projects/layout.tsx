import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dự án",
  description: "Quản lý tất cả dự án trong workspace của bạn.",
};

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
