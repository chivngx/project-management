import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { WorkspaceRepository } from "@/repositories/workspace.repository";
import { ProjectRepository } from "@/repositories/project.repository";
import { ActivityRepository } from "@/repositories/activity.repository";
import { NotificationRepository } from "@/repositories/notification.repository";
import crypto from "crypto";

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

    if (membership && (membership.role === "MEMBER" || membership.role === "ADMIN" || membership.role === "OWNER")) {
      // Idempotency: Already accepted, make sure notification record is cleaned up
      await NotificationRepository.updateInvitationNotificationStatus(
        user.id,
        workspaceId,
        "accepted",
        workspaceName
      );
      return NextResponse.json({ success: true });
    }

    if (!membership || membership.role !== "PENDING") {
      return NextResponse.json({ error: "No pending invitation found" }, { status: 404 });
    }

    // Update role to MEMBER (which accepts the invitation)
    await WorkspaceRepository.updateMembership(workspaceId, user.id, "MEMBER");

    // Automatically add the user as a member of all existing projects in this workspace
    try {
      const projects = await ProjectRepository.findByWorkspaceId(workspaceId);
      const projectMembers = projects.map((p: any) => ({
        id: crypto.randomUUID(),
        projectId: p.id,
        userId: user.id,
        role: "MEMBER",
      }));
      if (projectMembers.length > 0) {
        await ProjectRepository.createProjectMembers(projectMembers);
      }
    } catch (projectJoinErr) {
      console.error("Failed to automatically join user to workspace projects:", projectJoinErr);
      // Don't crash the accept flow if this secondary step fails
    }

    // Update notification record
    await NotificationRepository.updateInvitationNotificationStatus(
      user.id,
      workspaceId,
      "accepted",
      workspaceName
    );

    // Add activity
    await ActivityRepository.create({
      id: crypto.randomUUID(),
      workspaceId,
      userId: user.id,
      action: "updated_project",
      entityType: "WORKSPACE",
      entityId: workspaceId,
      message: `${user.name} đã chấp nhận lời mời tham gia workspace`,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Accept invite error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
