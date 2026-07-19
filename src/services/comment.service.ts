import crypto from "crypto";
import { CommentRepository } from "@/repositories/comment.repository";
import { TaskRepository } from "@/repositories/task.repository";
import { NotificationRepository } from "@/repositories/notification.repository";
import { decrypt } from "@/lib/encryption";

export const CommentService = {
  async listComments(taskId: string, workspaceId: string) {
    const task = await TaskRepository.findByIdWithDetails(taskId);
    if (!task || task.project?.workspaceId !== workspaceId) {
      throw new Error("TASK_NOT_FOUND");
    }
    return CommentRepository.findByTaskId(taskId);
  },

  async createComment(
    taskId: string,
    workspaceId: string,
    callerUser: { id: string; name?: string | null },
    body: string
  ) {
    const task = await TaskRepository.findByIdWithDetails(taskId);
    if (!task || task.project?.workspaceId !== workspaceId) {
      throw new Error("TASK_NOT_FOUND");
    }

    const newCommentId = crypto.randomUUID();
    const comment = await CommentRepository.create({
      id: newCommentId,
      taskId,
      userId: callerUser.id,
      body: body.trim(),
    });

    // Notify task assignee and creator
    const recipients = new Set<string>();
    if (task.assigneeId && task.assigneeId !== callerUser.id) recipients.add(task.assigneeId);
    if (task.creatorId && task.creatorId !== callerUser.id) recipients.add(task.creatorId);
    
    if (recipients.size > 0) {
      const notifications = Array.from(recipients).map((recipientId) => ({
        id: crypto.randomUUID(),
        userId: recipientId,
        workspaceId,
        type: "task_commented",
        message: `${callerUser.name ?? "Someone"} đã bình luận về tác vụ "${task.title}"`,
        link: `/projects/${task.projectId}`,
      }));
      await NotificationRepository.createMany(notifications);
    }

    // TWO-WAY SYNC: Post comment to GitHub / GitLab issue if linked
    if (task.externalNumber && task.gitIntegration) {
      try {
        const integration = task.gitIntegration;
        const token = decrypt(integration.token);
        const provider = integration.provider;
        const owner = integration.owner;
        const name = integration.name;
        const issueNumber = task.externalNumber;
        
        const commentBody = `**[ProjectFlow] ${callerUser.name || "Someone"}:** ${comment.body}`;

        if (provider === "github") {
          const headers = {
            Accept: "application/vnd.github.v3+json",
            Authorization: `token ${token}`,
            "Content-Type": "application/json",
          };

          await fetch(`https://api.github.com/repos/${owner}/${name}/issues/${issueNumber}/comments`, {
            method: "POST",
            headers,
            body: JSON.stringify({ body: commentBody }),
          });
        } else if (provider === "gitlab") {
          const apiBase = integration.apiUrl || "https://gitlab.com";
          const projectPath = encodeURIComponent(`${owner}/${name}`);
          const headers = {
            "PRIVATE-TOKEN": token,
            "Content-Type": "application/json",
          };

          await fetch(`${apiBase}/api/v4/projects/${projectPath}/issues/${issueNumber}/notes`, {
            method: "POST",
            headers,
            body: JSON.stringify({ body: commentBody }),
          });
        }
      } catch (e) {
        console.error("Failed to sync comment to Git issue:", e);
      }
    }

    return comment;
  },
};
