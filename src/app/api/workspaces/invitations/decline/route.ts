import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { WorkspaceRepository } from "@/repositories/workspace.repository";
import { NotificationRepository } from "@/repositories/notification.repository";

export async function POST(req: Request) {
  const { user } = await getApiContext();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { workspaceId } = await req.json();
    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
    }

    const membership = await WorkspaceRepository.findMembership(workspaceId, user.id);
    const workspace = await WorkspaceRepository.findById(workspaceId);
    const workspaceName = workspace?.name ?? "";

    if (!membership) {
      // Idempotency: Already declined/deleted, make sure notification record is cleaned up
      await NotificationRepository.updateInvitationNotificationStatus(
        user.id,
        workspaceId,
        "declined",
        workspaceName
      );
      return NextResponse.json({ success: true });
    }

    if (membership.role !== "PENDING") {
      return NextResponse.json({ error: "No pending invitation found" }, { status: 404 });
    }

    // Delete membership (decline invitation)
    await WorkspaceRepository.deleteMembership(workspaceId, user.id);

    // Update notification record
    await NotificationRepository.updateInvitationNotificationStatus(
      user.id,
      workspaceId,
      "declined",
      workspaceName
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Decline invite error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
