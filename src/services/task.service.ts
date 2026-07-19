import crypto from "crypto";
import { TaskRepository } from "@/repositories/task.repository";
import { ProjectRepository } from "@/repositories/project.repository";
import { ActivityRepository } from "@/repositories/activity.repository";
import { NotificationRepository } from "@/repositories/notification.repository";
import { emitToWorkspace } from "@/lib/realtime";
import { decrypt } from "@/lib/encryption";

export const TaskService = {
  async listTasks(projectId: string, workspaceId: string) {
    const project = await ProjectRepository.findById(projectId);
    if (!project || project.workspaceId !== workspaceId) {
      throw new Error("PROJECT_NOT_FOUND");
    }
    return TaskRepository.findByProjectId(projectId);
  },

  async createTask(
    projectId: string,
    workspaceId: string,
    callerUser: { id: string; name?: string | null },
    data: {
      title: string;
      description?: string | null;
      status?: string;
      priority?: string;
      assigneeId?: string | null;
      dueDate?: string | null;
    }
  ) {
    const project = await ProjectRepository.findById(projectId);
    if (!project || project.workspaceId !== workspaceId) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    let assigneeId = data.assigneeId;
    if (assigneeId) {
      const isMember = await ProjectRepository.findMembership(projectId, assigneeId);
      if (!isMember) {
        throw new Error("ASSIGNEE_NOT_PROJECT_MEMBER");
      }
    } else {
      assigneeId = null;
    }

    const newTaskId = crypto.randomUUID();
    const task = await TaskRepository.create({
      id: newTaskId,
      projectId,
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? "TODO",
      priority: data.priority ?? "MEDIUM",
      assigneeId,
      creatorId: callerUser.id,
      dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
    });

    // Notify assignee
    if (assigneeId && assigneeId !== callerUser.id) {
      await NotificationRepository.create({
        id: crypto.randomUUID(),
        userId: assigneeId,
        workspaceId,
        type: "task_assigned",
        message: `${callerUser.name ?? "Someone"} đã giao tác vụ "${task.title}" cho bạn`,
        link: `/projects/${projectId}`,
      });
    }

    await ActivityRepository.create({
      id: crypto.randomUUID(),
      workspaceId,
      userId: callerUser.id,
      action: "created_task",
      entityType: "TASK",
      entityId: task.id,
      message: `${callerUser.name ?? "Someone"} đã tạo tác vụ "${task.title}"`,
    });

    // Broadcast realtime event
    await emitToWorkspace(workspaceId, "task:created", {
      id: task.id,
      projectId,
      task,
    });

    return task;
  },

  async updateTask(
    taskId: string,
    workspaceId: string,
    callerUser: { id: string; name?: string | null },
    callerRole: string,
    data: {
      title?: string;
      description?: string | null;
      status?: string;
      priority?: string;
      assigneeId?: string | null;
      dueDate?: string | null;
    }
  ) {
    const task = await TaskRepository.findByIdWithDetails(taskId);
    if (!task || task.project?.workspaceId !== workspaceId) {
      throw new Error("TASK_NOT_FOUND");
    }

    // Authorization: creator, assignee, or workspace admin/owner may edit
    const isAuthorized =
      task.creatorId === callerUser.id ||
      task.assigneeId === callerUser.id ||
      callerRole === "OWNER" ||
      callerRole === "ADMIN";

    if (!isAuthorized) {
      throw new Error("FORBIDDEN");
    }

    const beforeStatus = task.status;
    let assigneeId = task.assigneeId;

    if (data.assigneeId !== undefined) {
      if (data.assigneeId === null) {
        assigneeId = null;
      } else {
        const isMember = await ProjectRepository.findMembership(task.projectId, data.assigneeId);
        if (!isMember) {
          throw new Error("ASSIGNEE_NOT_PROJECT_MEMBER");
        }
        assigneeId = data.assigneeId;
      }
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.assigneeId !== undefined) updateData.assigneeId = assigneeId;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate).toISOString() : null;

    const updated = await TaskRepository.update(taskId, updateData);

    // TWO-WAY SYNC: If status changed and has Git integration
    if (data.status !== undefined && data.status !== beforeStatus && task.externalNumber && task.gitIntegration) {
      try {
        const integration = task.gitIntegration;
        const token = decrypt(integration.token);
        const provider = integration.provider;
        const owner = integration.owner;
        const name = integration.name;
        const issueNumber = task.externalNumber;
        const targetGitState = data.status === "DONE" ? "closed" : "open";

        if (provider === "github") {
          const headers = {
            Accept: "application/vnd.github.v3+json",
            Authorization: `token ${token}`,
            "Content-Type": "application/json",
          };
          // Sync state (open/close)
          await fetch(`https://api.github.com/repos/${owner}/${name}/issues/${issueNumber}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ state: targetGitState }),
          });
          // Sync labels
          const statusLabel = `status/${data.status.toLowerCase().replace("_", "-")}`;
          await fetch(`https://api.github.com/repos/${owner}/${name}/issues/${issueNumber}/labels`, {
            method: "PUT",
            headers,
            body: JSON.stringify({ labels: [statusLabel] }),
          });
        } else if (provider === "gitlab") {
          const apiBase = integration.apiUrl || "https://gitlab.com";
          const projectPath = encodeURIComponent(`${owner}/${name}`);
          const headers = {
            "PRIVATE-TOKEN": token,
            "Content-Type": "application/json",
          };
          const targetGitlabStateEvent = data.status === "DONE" ? "close" : "reopen";
          // Sync state
          await fetch(`${apiBase}/api/v4/projects/${projectPath}/issues/${issueNumber}`, {
            method: "PUT",
            headers,
            body: JSON.stringify({ state_event: targetGitlabStateEvent }),
          });
          // Sync labels
          const statusLabel = `status/${data.status.toLowerCase().replace("_", "-")}`;
          await fetch(`${apiBase}/api/v4/projects/${projectPath}/issues/${issueNumber}`, {
            method: "PUT",
            headers,
            body: JSON.stringify({ labels: statusLabel }),
          });
        }
      } catch (e) {
        console.error("Failed to sync task status change to Git:", e);
      }
    }

    if (data.status === "DONE" && beforeStatus !== "DONE") {
      await ActivityRepository.create({
        id: crypto.randomUUID(),
        workspaceId,
        userId: callerUser.id,
        action: "completed_task",
        entityType: "TASK",
        entityId: updated.id,
        message: `${callerUser.name ?? "Someone"} đã hoàn thành tác vụ "${updated.title}"`,
      });
    }

    // Notify new assignee
    if (
      data.assigneeId !== undefined &&
      assigneeId &&
      assigneeId !== task.assigneeId &&
      assigneeId !== callerUser.id
    ) {
      await NotificationRepository.create({
        id: crypto.randomUUID(),
        userId: assigneeId,
        workspaceId,
        type: "task_assigned",
        message: `${callerUser.name ?? "Someone"} đã giao tác vụ "${updated.title}" cho bạn`,
        link: `/projects/${task.projectId}`,
      });
    }

    // Broadcast realtime event
    await emitToWorkspace(workspaceId, "task:updated", {
      id: updated.id,
      projectId: task.projectId,
      changes: data,
    });

    return updated;
  },

  async deleteTask(
    taskId: string,
    workspaceId: string,
    callerUser: { id: string; name?: string | null },
    callerRole: string
  ) {
    const task = await TaskRepository.findByIdWithDetails(taskId);
    if (!task || task.project?.workspaceId !== workspaceId) {
      throw new Error("TASK_NOT_FOUND");
    }

    // Authorization: task creator or workspace admin/owner may delete
    const isAuthorized =
      task.creatorId === callerUser.id ||
      callerRole === "OWNER" ||
      callerRole === "ADMIN";

    if (!isAuthorized) {
      throw new Error("FORBIDDEN");
    }

    await TaskRepository.delete(taskId);

    await ActivityRepository.create({
      id: crypto.randomUUID(),
      workspaceId,
      userId: callerUser.id,
      action: "deleted_task",
      entityType: "TASK",
      entityId: taskId,
      message: `${callerUser.name ?? "Someone"} đã xóa tác vụ "${task.title}"`,
    });

    // Broadcast realtime event
    await emitToWorkspace(workspaceId, "task:deleted", {
      id: taskId,
      projectId: task.projectId,
    });

    return true;
  },
};
