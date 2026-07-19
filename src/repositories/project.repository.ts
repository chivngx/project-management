import { db } from "@/lib/db";

export const ProjectRepository = {
  async findById(id: string) {
    const { data, error } = await db
      .from("Project")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async findByIdAndWorkspaceId(id: string, workspaceId: string) {
    const { data, error } = await db
      .from("Project")
      .select("*, members:ProjectMember(*, user:User(id, name, username, email, image)), tasks:Task(*, assignee:User!Task_assigneeId_fkey(id, name, username, email, image), creator:User!Task_creatorId_fkey(id, name, username, email, image))")
      .eq("id", id)
      .eq("workspaceId", workspaceId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async findByWorkspaceId(workspaceId: string) {
    const { data, error } = await db
      .from("Project")
      .select("*, members:ProjectMember(*, user:User(id, name, username, email, image)), tasks:Task(status)")
      .eq("workspaceId", workspaceId)
      .order("createdAt", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(data: {
    id: string;
    workspaceId: string;
    name: string;
    description?: string | null;
    status?: string;
    priority?: string;
    startDate?: string | null;
    dueDate?: string | null;
  }) {
    const { data: created, error } = await db
      .from("Project")
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return created;
  },

  async update(id: string, data: any) {
    const { data: updated, error } = await db
      .from("Project")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return updated;
  },

  async delete(id: string) {
    const { error } = await db
      .from("Project")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  },

  async findMembership(projectId: string, userId: string) {
    const { data, error } = await db
      .from("ProjectMember")
      .select("id")
      .eq("projectId", projectId)
      .eq("userId", userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createProjectMembers(members: Array<{ id: string; projectId: string; userId: string; role: string }>) {
    const { error } = await db
      .from("ProjectMember")
      .insert(members);

    if (error) throw error;
    return true;
  },

  async deleteProjectMembersByUserIdInProjects(userId: string, projectIds: string[]) {
    const { error } = await db
      .from("ProjectMember")
      .delete()
      .eq("userId", userId)
      .in("projectId", projectIds);

    if (error) throw error;
    return true;
  },
};
