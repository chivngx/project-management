import { db } from "@/lib/db";

export const TaskRepository = {
  async findById(id: string) {
    const { data, error } = await db
      .from("Task")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async findByIdWithDetails(id: string) {
    const { data, error } = await db
      .from("Task")
      .select("*, project:Project(*), gitIntegration:GitIntegration(*)")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async findByProjectId(projectId: string) {
    const { data, error } = await db
      .from("Task")
      .select("*, assignee:User!Task_assigneeId_fkey(*), creator:User!Task_creatorId_fkey(*)")
      .eq("projectId", projectId)
      .order("createdAt", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async findByAssigneeIdAndProjects(assigneeId: string, projectIds: string[]) {
    const { data, error } = await db
      .from("Task")
      .select("*, project:Project(id, name)")
      .eq("assigneeId", assigneeId)
      .in("projectId", projectIds)
      .order("dueDate", { ascending: true })
      .order("createdAt", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async findByProjectsAndDueDateRange(projectIds: string[], start: string, end: string) {
    const { data, error } = await db
      .from("Task")
      .select("id, title, status, priority, dueDate, projectId, project:Project(name), assignee:User!Task_assigneeId_fkey(name, username, image)")
      .in("projectId", projectIds)
      .gte("dueDate", start)
      .lt("dueDate", end)
      .order("dueDate", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async create(data: {
    id: string;
    projectId: string;
    title: string;
    description?: string | null;
    status?: string;
    priority?: string;
    assigneeId?: string | null;
    creatorId: string;
    dueDate?: string | null;
    externalId?: string | null;
    externalNumber?: number | null;
    externalUrl?: string | null;
    externalProvider?: string | null;
    gitIntegrationId?: string | null;
  }) {
    const { data: created, error } = await db
      .from("Task")
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return created;
  },

  async createMany(tasks: any[]) {
    const { error } = await db
      .from("Task")
      .insert(tasks);

    if (error) throw error;
    return true;
  },

  async update(id: string, data: any) {
    const { data: updated, error } = await db
      .from("Task")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return updated;
  },

  async delete(id: string) {
    const { error } = await db
      .from("Task")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  },

  async findFirstByExternalDetails(projectId: string, provider: string, externalNumber: number) {
    const { data, error } = await db
      .from("Task")
      .select("*")
      .eq("projectId", projectId)
      .eq("externalProvider", provider)
      .eq("externalNumber", externalNumber)
      .maybeSingle();

    if (error) throw error;
    return data;
  },
};
