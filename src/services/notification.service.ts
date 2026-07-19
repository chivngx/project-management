import { NotificationRepository } from "@/repositories/notification.repository";

export const NotificationService = {
  async listNotifications(userId: string, workspaceId?: string) {
    const list = await NotificationRepository.findByUserAndWorkspace(userId, workspaceId);
    const unreadCount = await NotificationRepository.countUnread(userId, workspaceId);
    return { list, unreadCount };
  },

  async readAllNotifications(userId: string, workspaceId?: string) {
    await NotificationRepository.updateReadStatus(userId, workspaceId, true);
    return true;
  },

  async readSingleNotification(notificationId: string, userId: string) {
    await NotificationRepository.updateSingleReadStatus(notificationId, userId, true);
    return true;
  },
};
