import { NextResponse } from "next/server";
import { NotificationService } from "@/services/notification.service";
import { getApiContext } from "@/lib/api-context";

/** List the current user's notifications (newest first, max 30). */
export async function GET() {
  const { user } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { list, unreadCount } = await NotificationService.listNotifications(user.id);
    return NextResponse.json({ items: list, unread: unreadCount });
  } catch (e: any) {
    console.error("List notifications error:", e);
    return NextResponse.json({ error: "Lỗi tải thông báo" }, { status: 500 });
  }
}
