import crypto from "crypto";
import { UserRepository } from "@/repositories/user.repository";
import { WorkspaceRepository } from "@/repositories/workspace.repository";
import { ActivityRepository } from "@/repositories/activity.repository";
import { NotificationRepository } from "@/repositories/notification.repository";

export const TeamService = {
  async listTeamMembers(workspaceId: string) {
    const rawMembers = await WorkspaceRepository.findMembershipsByWorkspaceId(workspaceId);
    return rawMembers.map((m: any) => ({
      id: m.user?.id,
      name: m.user?.name,
      username: m.user?.username,
      email: m.user?.email,
      image: m.user?.image,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  },

  async inviteTeamMember(
    workspaceId: string,
    callerUser: { id: string; name?: string | null },
    callerRole: string,
    email: string
  ) {
    // Only OWNER/ADMIN can invite members
    if (callerRole !== "OWNER" && callerRole !== "ADMIN") {
      throw new Error("FORBIDDEN");
    }

    const normalized = email.trim().toLowerCase();
    const target = await UserRepository.findByEmail(normalized);
    if (!target) {
      throw new Error("USER_NOT_FOUND");
    }

    const existing = await WorkspaceRepository.findMembership(workspaceId, target.id);
    if (existing) {
      throw new Error("ALREADY_MEMBER");
    }

    await WorkspaceRepository.createMembership({
      id: crypto.randomUUID(),
      workspaceId,
      userId: target.id,
      role: "PENDING",
    });

    const workspace = await WorkspaceRepository.findById(workspaceId);

    // Notify the user about the invitation
    await NotificationRepository.create({
      id: crypto.randomUUID(),
      userId: target.id,
      workspaceId,
      type: "team_invited",
      message: `${callerUser.name ?? "Ai đó"} đã mời bạn tham gia workspace "${workspace?.name ?? ""}"`,
      link: "/",
    });

    await ActivityRepository.create({
      id: crypto.randomUUID(),
      workspaceId,
      userId: callerUser.id,
      action: "added_member",
      entityType: "MEMBER",
      entityId: target.id,
      message: `${callerUser.name ?? "Someone"} đã mời ${target.name} tham gia workspace (đang chờ)`,
    });

    return true;
  },

  async changeMemberRole(
    workspaceId: string,
    callerRole: string,
    targetUserId: string,
    newRole: "OWNER" | "ADMIN" | "MEMBER"
  ) {
    // Only OWNER can promote/demote
    if (callerRole !== "OWNER") {
      throw new Error("FORBIDDEN");
    }

    const target = await WorkspaceRepository.findMembership(workspaceId, targetUserId);
    if (!target) {
      throw new Error("MEMBER_NOT_FOUND");
    }

    // Can't change your own OWNER role directly here (must transfer ownership via WorkspaceService.updateWorkspace instead).
    if (target.role === "OWNER" && newRole !== "OWNER") {
      throw new Error("OWNER_ROLE_LOCKED");
    }

    await WorkspaceRepository.updateMembership(workspaceId, targetUserId, newRole);
    return true;
  },

  async removeTeamMember(
    workspaceId: string,
    callerUser: { id: string; name?: string | null },
    callerRole: string,
    targetUserId: string
  ) {
    const target = await WorkspaceRepository.findMembership(workspaceId, targetUserId);
    if (!target) {
      throw new Error("MEMBER_NOT_FOUND");
    }

    const isSelf = targetUserId === callerUser.id;

    // Removing someone else requires admin; removing yourself is always allowed.
    if (!isSelf && callerRole !== "OWNER" && callerRole !== "ADMIN") {
      throw new Error("FORBIDDEN");
    }

    // Can't remove the OWNER
    if (target.role === "OWNER") {
      throw new Error("OWNER_CANNOT_BE_REMOVED");
    }

    await WorkspaceRepository.deleteMembership(workspaceId, targetUserId);

    await ActivityRepository.create({
      id: crypto.randomUUID(),
      workspaceId,
      userId: callerUser.id,
      action: "removed_member",
      entityType: "MEMBER",
      entityId: targetUserId,
      message: isSelf
        ? `${callerUser.name ?? "Someone"} đã rời khỏi workspace`
        : `${callerUser.name ?? "Someone"} đã xóa thành viên khỏi workspace`,
    });

    return true;
  },
};
