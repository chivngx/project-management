import { db } from "@/lib/db";

export const ActivityRepository = {
  async findByWorkspaceId(workspaceId: string, limit = 12) {
    const { data, error } = await db
      .from("Activity")
      .select("*, user:User(name, image)")
      .eq("workspaceId", workspaceId)
      .order("createdAt", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  async create(data: {
    id: string;
    workspaceId: string;
    userId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    message: string;
  }) {
    const { data: created, error } = await db
      .from("Activity")
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return created;
  },
};
