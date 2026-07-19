import { db } from "@/lib/db";
import { ProjectRepository } from "@/repositories/project.repository";

export const SearchService = {
  async globalSearch(workspaceId: string, query: string) {
    const q = query.trim();
    if (q.length < 2) {
      return { projects: [], tasks: [], members: [] };
    }

    // 1. Fetch matching projects
    const { data: projectsRaw, error: projErr } = await db
      .from("Project")
      .select("id, name, status")
      .eq("workspaceId", workspaceId)
      .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
      .limit(5);

    if (projErr) throw projErr;
    const projects = projectsRaw || [];

    // 2. Fetch matching tasks
    const myProjects = await ProjectRepository.findByWorkspaceId(workspaceId);
    const projectIds = myProjects.map((p) => p.id);

    let tasks: any[] = [];
    if (projectIds.length > 0) {
      const { data: tasksRaw, error: tasksErr } = await db
        .from("Task")
        .select("id, title, status, projectId, project:Project(name)")
        .in("projectId", projectIds)
        .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
        .limit(8);

      if (tasksErr) throw tasksErr;
      tasks = tasksRaw || [];
    }

    // 3. Fetch matching members
    const { data: matchedUsers, error: usersErr } = await db
      .from("User")
      .select("id")
      .or(`name.ilike.%${q}%,email.ilike.%${q}%`);

    if (usersErr) throw usersErr;
    const matchedUserIds = (matchedUsers || []).map((u) => u.id);

    let members: any[] = [];
    if (matchedUserIds.length > 0) {
      const { data: membersRaw, error: membersErr } = await db
        .from("WorkspaceMember")
        .select("role, user:User(id, name, username, email, image)")
        .eq("workspaceId", workspaceId)
        .in("userId", matchedUserIds)
        .limit(5);

      if (membersErr) throw membersErr;
      members = membersRaw || [];
    }

    return {
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        href: `/projects/${p.id}`,
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        projectName: (t.project as any)?.name ?? null,
        href: `/projects/${t.projectId}`,
      })),
      members: members.map((m) => ({
        id: m.user?.id,
        name: m.user?.name,
        username: m.user?.username,
        email: m.user?.email,
        image: m.user?.image,
        role: m.role,
      })),
    };
  },
};
