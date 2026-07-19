import crypto from "crypto";
import { ProjectRepository } from "@/repositories/project.repository";
import { WorkspaceRepository } from "@/repositories/workspace.repository";
import { ActivityRepository } from "@/repositories/activity.repository";

export const ProjectService = {
  async listProjects(workspaceId: string) {
    const rawProjects = await ProjectRepository.findByWorkspaceId(workspaceId);
    return rawProjects.map((p: any) => {
      const total = p.tasks?.length || 0;
      const done = (p.tasks || []).filter((t: any) => t.status === "DONE").length;
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        priority: p.priority,
        startDate: p.startDate,
        dueDate: p.dueDate,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        memberCount: p.members?.length || 0,
        members: (p.members || []).map((m: any) => ({
          id: m.user?.id,
          name: m.user?.name,
          username: m.user?.username,
          email: m.user?.email,
          image: m.user?.image,
        })),
        taskCount: total,
        doneCount: done,
      };
    });
  },

  async getProjectDetail(projectId: string, workspaceId: string) {
    const project = await ProjectRepository.findByIdAndWorkspaceId(projectId, workspaceId);
    if (!project) return null;

    // Sort tasks in memory by createdAt ascending
    const tasks = (project.tasks || []).sort(
      (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return {
      id: project.id,
      workspaceId: project.workspaceId,
      name: project.name,
      description: project.description,
      status: project.status,
      priority: project.priority,
      startDate: project.startDate,
      dueDate: project.dueDate,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      repoProvider: project.repoProvider,
      repoOwner: project.repoOwner,
      repoName: project.repoName,
      repoToken: project.repoToken,
      repoApiUrl: project.repoApiUrl,
      repoWebhookSecret: project.repoWebhookSecret,
      members: (project.members || []).map((m: any) => ({
        id: m.user?.id,
        name: m.user?.name,
        username: m.user?.username,
        email: m.user?.email,
        image: m.user?.image,
        role: m.role,
      })),
      tasks: tasks.map((t: any) => ({
        id: t.id,
        projectId: t.projectId,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        assigneeId: t.assigneeId,
        assignee: t.assignee
          ? {
              id: t.assignee.id,
              name: t.assignee.name,
              username: t.assignee.username,
              email: t.assignee.email,
              image: t.assignee.image,
            }
          : null,
        creatorId: t.creatorId,
        creator: {
          id: t.creator?.id,
          name: t.creator?.name,
          email: t.creator?.email,
          image: t.creator?.image,
        },
        dueDate: t.dueDate,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        externalId: t.externalId,
        externalNumber: t.externalNumber,
        externalUrl: t.externalUrl,
        externalProvider: t.externalProvider,
      })),
      taskCount: tasks.length,
    };
  },

  async createProject(
    workspaceId: string,
    callerUser: { id: string; name?: string | null },
    data: {
      name: string;
      description?: string | null;
      status?: string;
      priority?: string;
      startDate?: string | null;
      dueDate?: string | null;
      memberIds?: string[];
    }
  ) {
    if (data.startDate && data.dueDate && new Date(data.dueDate) < new Date(data.startDate)) {
      throw new Error("INVALID_DATES");
    }

    // Validate memberIds belong to the workspace
    let validMembers: any[] = [];
    if (data.memberIds && data.memberIds.length > 0) {
      // Direct query WorkspaceMembers to check valid ids
      const workspaceMembers = await WorkspaceRepository.findMembershipsByWorkspaceId(workspaceId);
      validMembers = workspaceMembers.filter((m: any) => data.memberIds?.includes(m.userId));
    }

    const newProjectId = crypto.randomUUID();
    const project = await ProjectRepository.create({
      id: newProjectId,
      workspaceId,
      name: data.name,
      description: data.description ?? null,
      status: data.status ?? "ACTIVE",
      priority: data.priority ?? "MEDIUM",
      startDate: data.startDate ? new Date(data.startDate).toISOString() : null,
      dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
    });

    // Insert project members
    const memberInserts = [
      {
        id: crypto.randomUUID(),
        projectId: project.id,
        userId: callerUser.id,
        role: "MEMBER",
      },
      ...validMembers
        .filter((m) => m.userId !== callerUser.id)
        .map((m) => ({
          id: crypto.randomUUID(),
          projectId: project.id,
          userId: m.userId,
          role: "MEMBER",
        })),
    ];

    await ProjectRepository.createProjectMembers(memberInserts);

    await ActivityRepository.create({
      id: crypto.randomUUID(),
      workspaceId,
      userId: callerUser.id,
      action: "created_project",
      entityType: "PROJECT",
      entityId: project.id,
      message: `${callerUser.name ?? "Someone"} đã tạo dự án "${project.name}"`,
    });

    return project;
  },

  async updateProject(
    projectId: string,
    workspaceId: string,
    callerUser: { id: string; name?: string | null },
    data: {
      name?: string;
      description?: string | null;
      status?: string;
      priority?: string;
      startDate?: string | null;
      dueDate?: string | null;
    }
  ) {
    const existing = await ProjectRepository.findById(projectId);
    if (!existing || existing.workspaceId !== workspaceId) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    const effectiveStart = data.startDate !== undefined ? data.startDate : existing.startDate;
    const effectiveDue = data.dueDate !== undefined ? data.dueDate : existing.dueDate;
    if (effectiveStart && effectiveDue && new Date(effectiveDue) < new Date(effectiveStart)) {
      throw new Error("INVALID_DATES");
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate).toISOString() : null;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate).toISOString() : null;

    const updated = await ProjectRepository.update(projectId, updateData);

    await ActivityRepository.create({
      id: crypto.randomUUID(),
      workspaceId,
      userId: callerUser.id,
      action: "updated_project",
      entityType: "PROJECT",
      entityId: projectId,
      message: `${callerUser.name ?? "Someone"} đã cập nhật dự án "${existing.name}"`,
    });

    return updated;
  },

  async deleteProject(
    projectId: string,
    workspaceId: string,
    callerUser: { id: string; name?: string | null },
    callerRole: string
  ) {
    // Only OWNER/ADMIN can delete a project
    if (callerRole !== "OWNER" && callerRole !== "ADMIN") {
      throw new Error("FORBIDDEN");
    }

    const existing = await ProjectRepository.findById(projectId);
    if (!existing || existing.workspaceId !== workspaceId) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    await ProjectRepository.delete(projectId);

    await ActivityRepository.create({
      id: crypto.randomUUID(),
      workspaceId,
      userId: callerUser.id,
      action: "deleted_project",
      entityType: "PROJECT",
      entityId: projectId,
      message: `${callerUser.name ?? "Someone"} đã xóa dự án "${existing.name}"`,
    });

    return true;
  },
};
