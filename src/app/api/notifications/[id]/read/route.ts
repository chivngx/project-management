import { NextResponse } from "next/server";
import { NotificationService } from "@/services/notification.service";
import { getApiContext } from "@/lib/api-context";

type Params = { params: Promise<{ id: string }> };

/** Mark a single notification as read. */
export async function PATCH(_req: Request, { params }: Params) {
  const { user } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await NotificationService.readSingleNotification(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Read single notification error:", e);
    return NextResponse.json({ error: "Lỗi cập nhật thông báo" }, { status: 500 });
  }
}
