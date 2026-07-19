import crypto from "crypto";
import { WorkspaceRepository } from "@/repositories/workspace.repository";
import { ProjectRepository } from "@/repositories/project.repository";
import { ActivityRepository } from "@/repositories/activity.repository";

export const WorkspaceService = {
  async createWorkspace(userId: string, userName: string, workspaceName: string) {
    const workspaceId = crypto.randomUUID();
    
    const workspace = await WorkspaceRepository.create({
      id: workspaceId,
      name: workspaceName,
      ownerId: userId,
    });

    await WorkspaceRepository.createMembership({
      id: crypto.randomUUID(),
      workspaceId,
      userId,
      role: "OWNER",
    });

    await ActivityRepository.create({
      id: crypto.randomUUID(),
      workspaceId,
      userId,
      action: "created_workspace",
      entityType: "WORKSPACE",
      entityId: workspaceId,
      message: `${userName} đã tạo Workspace "${workspaceName}"`,
    });

    return workspace;
  },

  async updateWorkspace(
    workspaceId: string,
    callerUserId: string,
    userName: string,
    data: { name?: string; ownerId?: string }
  ) {
    const workspace = await WorkspaceRepository.findById(workspaceId);
    if (!workspace) throw new Error("WORKSPACE_NOT_FOUND");
    if (workspace.ownerId !== callerUserId) throw new Error("FORBIDDEN");

    const updates: any = {};
    if (data.name) updates.name = data.name;

    // Handle ownership transfer
    if (data.ownerId && data.ownerId !== workspace.ownerId) {
      const newOwnerMembership = await WorkspaceRepository.findMembership(workspaceId, data.ownerId);
      if (!newOwnerMembership) throw new Error("NEW_OWNER_NOT_MEMBER");

      // Transfer owner role: update workspace ownerId, change new owner to OWNER, change old owner to MEMBER
      updates.ownerId = data.ownerId;
      await WorkspaceRepository.updateMembership(workspaceId, data.ownerId, "OWNER");
      await WorkspaceRepository.updateMembership(workspaceId, callerUserId, "MEMBER");
    }

    const updated = await WorkspaceRepository.update(workspaceId, updates);

    await ActivityRepository.create({
      id: crypto.randomUUID(),
      workspaceId,
      userId: callerUserId,
      action: "updated_workspace",
      entityType: "WORKSPACE",
      entityId: workspaceId,
      message: `${userName} đã cập nhật thông tin Workspace "${updated.name}"`,
    });

    return updated;
  },

  async deleteWorkspace(workspaceId: string, callerUserId: string) {
    const workspace = await WorkspaceRepository.findById(workspaceId);
    if (!workspace) throw new Error("WORKSPACE_NOT_FOUND");
    if (workspace.ownerId !== callerUserId) throw new Error("FORBIDDEN");

    await WorkspaceRepository.delete(workspaceId);
    return true;
  },

  async leaveWorkspace(workspaceId: string, userId: string, userName: string) {
    const workspace = await WorkspaceRepository.findById(workspaceId);
    if (!workspace) throw new Error("WORKSPACE_NOT_FOUND");
    if (workspace.ownerId === userId) {
      throw new Error("OWNER_CANNOT_LEAVE");
    }

    const projects = await ProjectRepository.findByWorkspaceId(workspaceId);
    const projectIds = projects.map((p) => p.id);

    if (projectIds.length > 0) {
      await ProjectRepository.deleteProjectMembersByUserIdInProjects(userId, projectIds);
    }

    await WorkspaceRepository.deleteMembership(workspaceId, userId);

    await ActivityRepository.create({
      id: crypto.randomUUID(),
      workspaceId,
      userId,
      action: "left_workspace",
      entityType: "WORKSPACE",
      entityId: workspaceId,
      message: `${userName} đã rời khỏi Workspace`,
    });

    return true;
  },
};
