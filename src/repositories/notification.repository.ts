import { db } from "@/lib/db";
import { emitToUser } from "@/lib/realtime";
import { UserRepository } from "@/repositories/user.repository";
import { WorkspaceRepository } from "@/repositories/workspace.repository";
import crypto from "crypto";

export const NotificationRepository = {
  async findByUserAndWorkspace(userId: string, workspaceId?: string, limit = 30) {
    const { data, error } = await db
      .from("Notification")
      .select("*")
      .eq("userId", userId)
      .order("createdAt", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  async countUnread(userId: string, workspaceId?: string) {
    const { count, error } = await db
      .from("Notification")
      .select("*", { count: "exact", head: true })
      .eq("userId", userId)
      .eq("read", false);

    if (error) throw error;
    return count || 0;
  },

  async create(data: {
    id: string;
    userId: string;
    workspaceId: string;
    type: string;
    message: string;
    link?: string | null;
  }) {
    const { data: created, error } = await db
      .from("Notification")
      .insert(data)
      .select()
      .single();

    if (error) throw error;

    // Send real-time notification to the user
    await emitToUser(created.userId, "notification:new", created);

    return created;
  },

  async createMany(notifications: Array<{
    id: string;
    userId: string;
    workspaceId: string;
    type: string;
    message: string;
    link?: string | null;
  }>) {
    const { data: createdList, error } = await db
      .from("Notification")
      .insert(notifications)
      .select();

    if (error) throw error;

    // Broadcast to all users in parallel
    if (createdList && createdList.length > 0) {
      await Promise.all(
        createdList.map((n: any) => emitToUser(n.userId, "notification:new", n))
      );
    }

    return true;
  },

  async updateReadStatus(userId: string, workspaceId?: string, read?: boolean) {
    const { error } = await db
      .from("Notification")
      .update({ read: !!read })
      .eq("userId", userId)
      .eq("read", !read);

    if (error) throw error;
    return true;
  },

  async updateSingleReadStatus(id: string, userId: string, read: boolean) {
    const { error } = await db
      .from("Notification")
      .update({ read })
      .eq("id", id)
      .eq("userId", userId);

    if (error) throw error;
    return true;
  },

  async updateInvitationNotificationStatus(
    userId: string,
    workspaceId: string,
    status: "accepted" | "declined",
    workspaceName: string
  ) {
    const type = status === "accepted" ? "team_invited_accepted" : "team_invited_declined";
    const statusText = status === "accepted" ? "chấp nhận" : "từ chối";
    const message = `Bạn đã ${statusText} lời mời tham gia workspace "${workspaceName}"`;

    const { data, error } = await db
      .from("Notification")
      .update({ type, message, read: true })
      .eq("userId", userId)
      .eq("workspaceId", workspaceId)
      .eq("type", "team_invited")
      .select();

    if (error) throw error;

    console.log(`[NotificationRepository] updateInvitationNotificationStatus: status=${status}, matchedRows=${data?.length ?? 0}, data=`, data);

    // Notify the workspace owner that the invitation was accepted/declined
    try {
      const workspace = await WorkspaceRepository.findById(workspaceId);
      if (workspace && workspace.ownerId && workspace.ownerId !== userId) {
        const userRecord = await UserRepository.findById(userId);
        const userName = userRecord?.name ?? "Một thành viên";
        const notifyOwnerMessage = `${userName} đã ${statusText} lời mời tham gia workspace "${workspaceName}"`;
        
        await NotificationRepository.create({
          id: crypto.randomUUID(),
          userId: workspace.ownerId,
          workspaceId,
          type: status === "accepted" ? "team_invited_accepted_owner" : "team_invited_declined_owner",
          message: notifyOwnerMessage,
          link: "/team",
        });
      }
    } catch (notifyErr) {
      console.error("Failed to notify owner of invitation response:", notifyErr);
    }

    // Send instant real-time reload trigger to the user
    if (data && data[0]) {
      await emitToUser(userId, "notification:new", data[0]);
    } else {
      await emitToUser(userId, "notification:new", { userId, message });
    }
    return true;
  },
};
