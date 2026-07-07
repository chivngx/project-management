import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lịch",
  description: "Tác vụ theo ngày hết hạn.",
};

export default function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
