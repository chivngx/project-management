import { db } from "@/lib/db";

export const WorkspaceRepository = {
  async findById(id: string) {
    const { data, error } = await db
      .from("Workspace")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async create(data: { id: string; name: string; ownerId: string }) {
    const { data: created, error } = await db
      .from("Workspace")
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return created;
  },

  async update(id: string, data: any) {
    const { data: updated, error } = await db
      .from("Workspace")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return updated;
  },

  async delete(id: string) {
    const { error } = await db
      .from("Workspace")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  },

  async findMembership(workspaceId: string, userId: string) {
    const { data, error } = await db
      .from("WorkspaceMember")
      .select("*")
      .eq("workspaceId", workspaceId)
      .eq("userId", userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async findMembershipsByUserId(userId: string) {
    const { data, error } = await db
      .from("WorkspaceMember")
      .select("*, workspace:Workspace(*)")
      .eq("userId", userId)
      .neq("role", "PENDING")
      .order("joinedAt", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async findPendingInvitationsByUserId(userId: string) {
    const { data, error } = await db
      .from("WorkspaceMember")
      .select("*, workspace:Workspace(*)")
      .eq("userId", userId)
      .eq("role", "PENDING")
      .order("joinedAt", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async findMembershipsByWorkspaceId(workspaceId: string) {
    const { data, error } = await db
      .from("WorkspaceMember")
      .select("*, user:User(*)")
      .eq("workspaceId", workspaceId)
      .neq("role", "PENDING")
      .order("joinedAt", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createMembership(data: { id: string; workspaceId: string; userId: string; role: string }) {
    const { data: created, error } = await db
      .from("WorkspaceMember")
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return created;
  },

  async updateMembership(workspaceId: string, userId: string, role: string) {
    const { data, error } = await db
      .from("WorkspaceMember")
      .update({ role })
      .eq("workspaceId", workspaceId)
      .eq("userId", userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteMembership(workspaceId: string, userId: string) {
    const { error } = await db
      .from("WorkspaceMember")
      .delete()
      .eq("workspaceId", workspaceId)
      .eq("userId", userId);

    if (error) throw error;
    return true;
  },

  async countMembers(workspaceId: string) {
    const { count, error } = await db
      .from("WorkspaceMember")
      .select("*", { count: "exact", head: true })
      .eq("workspaceId", workspaceId)
      .neq("role", "PENDING");

    if (error) throw error;
    return count || 0;
  },
};
