import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cài đặt",
  description: "Quản lý hồ sơ, bảo mật, workspace và thành viên.",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
