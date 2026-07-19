import { db } from "@/lib/db";

export const CommentRepository = {
  async findByTaskId(taskId: string) {
    const { data, error } = await db
      .from("Comment")
      .select("*, user:User(id, name, username, email, image)")
      .eq("taskId", taskId)
      .order("createdAt", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async create(data: { id: string; taskId: string; userId: string; body: string }) {
    const { data: created, error } = await db
      .from("Comment")
      .insert(data)
      .select("*, user:User(id, name, username, email, image)")
      .single();

    if (error) throw error;
    return created;
  },
};
