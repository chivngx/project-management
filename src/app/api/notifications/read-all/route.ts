import { NextResponse } from "next/server";
import { NotificationService } from "@/services/notification.service";
import { getApiContext } from "@/lib/api-context";

/** Mark all of the current user's notifications (in the active workspace) as read. */
export async function PATCH() {
  const { user } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await NotificationService.readAllNotifications(user.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Read all notifications error:", e);
    return NextResponse.json({ error: "Lỗi cập nhật thông báo" }, { status: 500 });
  }
}
