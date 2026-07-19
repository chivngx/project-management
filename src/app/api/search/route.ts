import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";

/** Global search across projects, tasks, and members in the active workspace.
 *  Query param: ?q=...  (min 2 chars, max 60) */
export async function GET(req: Request) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace)
    return NextResponse.json({ projects: [], tasks: [], members: [] });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ projects: [], tasks: [], members: [] });
  }

  // 1. Fetch matching projects
  const { data: projectsRaw, error: projErr } = await db
    .from("Project")
    .select("id, name, status")
    .eq("workspaceId", workspace.id)
    .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
    .limit(5);

  if (projErr) throw projErr;
  const projects = projectsRaw || [];

  // 2. Fetch matching tasks
  const { data: myProjects, error: myProjErr } = await db
    .from("Project")
    .select("id")
    .eq("workspaceId", workspace.id);

  if (myProjErr) throw myProjErr;
  const projectIds = (myProjects || []).map((p) => p.id);

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
      .select("role, user:User(id, name, email, image)")
      .eq("workspaceId", workspace.id)
      .in("userId", matchedUserIds)
      .limit(5);

    if (membersErr) throw membersErr;
    members = membersRaw || [];
  }

  return NextResponse.json({
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
      projectName: t.project?.name ?? null,
      href: `/projects/${t.projectId}`,
    })),
    members: members.map((m) => ({
      id: m.user?.id,
      name: m.user?.name,
      email: m.user?.email,
      image: m.user?.image,
      role: m.role,
    })),
  });
}
