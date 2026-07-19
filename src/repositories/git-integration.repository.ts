import { db } from "@/lib/db";

export const GitIntegrationRepository = {
  async findById(id: string) {
    const { data, error } = await db
      .from("GitIntegration")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async findByProjectId(projectId: string) {
    const { data, error } = await db
      .from("GitIntegration")
      .select("id, provider, owner, name, apiUrl, webhookSecret, createdAt")
      .eq("projectId", projectId);

    if (error) throw error;
    return data || [];
  },

  async findByComposite(projectId: string, provider: string, owner: string, name: string) {
    const { data, error } = await db
      .from("GitIntegration")
      .select("id")
      .eq("projectId", projectId)
      .eq("provider", provider)
      .eq("owner", owner)
      .eq("name", name)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async create(data: {
    id: string;
    projectId: string;
    provider: string;
    owner: string;
    name: string;
    token: string;
    apiUrl?: string | null;
    webhookSecret?: string | null;
  }) {
    const { data: created, error } = await db
      .from("GitIntegration")
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return created;
  },

  async update(id: string, data: any) {
    const { data: updated, error } = await db
      .from("GitIntegration")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return updated;
  },

  async delete(id: string) {
    const { error } = await db
      .from("GitIntegration")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  },

  async deleteByProjectId(projectId: string) {
    const { error } = await db
      .from("GitIntegration")
      .delete()
      .eq("projectId", projectId);

    if (error) throw error;
    return true;
  },

  async countByProjectId(projectId: string) {
    const { count, error } = await db
      .from("GitIntegration")
      .select("*", { count: "exact", head: true })
      .eq("projectId", projectId);

    if (error) throw error;
    return count || 0;
  },
};
