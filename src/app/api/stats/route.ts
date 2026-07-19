import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";

/** Dashboard stats for the active workspace. */
export async function GET() {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace)
    return NextResponse.json({
      totals: {
        projects: 0,
        activeProjects: 0,
        completedProjects: 0,
        tasks: 0,
        doneTasks: 0,
        inProgressTasks: 0,
        overdueTasks: 0,
        members: 0,
      },
      recentProjects: [],
      myTasks: [],
      tasksByStatus: [],
    });

  // 1. Fetch all projects of the workspace to compute project totals and status groups
  const { data: projects, error: projErr } = await db
    .from("Project")
    .select("id, name, status, priority, dueDate, startDate, createdAt")
    .eq("workspaceId", workspace.id);

  if (projErr) throw projErr;
  const projectCount = projects?.length || 0;
  const projectIds = (projects || []).map((p) => p.id);

  const activeProjects = (projects || []).filter((p) => p.status === "ACTIVE").length;
  const completedProjects = (projects || []).filter((p) => p.status === "COMPLETED").length;

  // 2. Fetch all tasks of the workspace projects to compute task totals, status groups, and overdue count
  let tasks: any[] = [];
  if (projectIds.length > 0) {
    const { data: tasksData, error: tasksErr } = await db
      .from("Task")
      .select("status, dueDate")
      .in("projectId", projectIds);

    if (tasksErr) throw tasksErr;
    tasks = tasksData || [];
  }

  const todoTasks = tasks.filter((t) => t.status === "TODO").length;
  const inProgressTasks = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const reviewTasks = tasks.filter((t) => t.status === "REVIEW").length;
  const doneTasks = tasks.filter((t) => t.status === "DONE").length;
  const totalTasks = tasks.length;

  const nowStr = new Date().toISOString();
  const overdueCount = tasks.filter(
    (t) => t.status !== "DONE" && t.dueDate && t.dueDate < nowStr
  ).length;

  // 3. Fetch workspace members count
  const { count: memberCount, error: memberErr } = await db
    .from("WorkspaceMember")
    .select("*", { count: "exact", head: true })
    .eq("workspaceId", workspace.id);

  if (memberErr) throw memberErr;

  // 4. Recent projects: fetch top 4 by createdAt, then select their members
  const { data: recentProjectsRaw, error: recentErr } = await db
    .from("Project")
    .select("id, name, status, priority, dueDate, startDate, members:ProjectMember(userId)")
    .eq("workspaceId", workspace.id)
    .order("createdAt", { ascending: false })
    .limit(4);

  if (recentErr) throw recentErr;

  const recentIds = (recentProjectsRaw || []).map((p) => p.id);
  let recentTasks: any[] = [];
  if (recentIds.length > 0) {
    const { data: recentTasksRaw, error: recentTasksErr } = await db
      .from("Task")
      .select("projectId, status")
      .in("projectId", recentIds);

    if (recentTasksErr) throw recentTasksErr;
    recentTasks = recentTasksRaw || [];
  }

  const recentProjects = (recentProjectsRaw || []).map((p) => {
    const total = recentTasks.filter((t) => t.projectId === p.id).length;
    const done = recentTasks.filter((t) => t.projectId === p.id && t.status === "DONE").length;
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      priority: p.priority,
      dueDate: p.dueDate,
      memberCount: p.members?.length || 0,
      taskCount: total,
      doneCount: done,
      progress: total ? Math.round((done / total) * 100) : 0,
    };
  });

  // 5. My tasks: assigned to current user, not done, sorted by due date, top 6
  let myTasks: any[] = [];
  if (projectIds.length > 0) {
    const { data: myTasksRaw, error: myTasksErr } = await db
      .from("Task")
      .select("id, title, status, priority, dueDate, projectId, project:Project(name)")
      .eq("assigneeId", user.id)
      .neq("status", "DONE")
      .in("projectId", projectIds)
      .order("dueDate", { ascending: true })
      .limit(6);

    if (myTasksErr) throw myTasksErr;
    myTasks = (myTasksRaw || []).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      projectName: (t.project as any)?.name ?? null,
      projectId: t.projectId,
    }));
  }

  const tasksByStatus = [
    { name: "To Do", value: todoTasks, key: "TODO" },
    { name: "In Progress", value: inProgressTasks, key: "IN_PROGRESS" },
    { name: "Review", value: reviewTasks, key: "REVIEW" },
    { name: "Done", value: doneTasks, key: "DONE" },
  ];

  return NextResponse.json({
    totals: {
      projects: projectCount,
      activeProjects,
      completedProjects,
      tasks: totalTasks,
      doneTasks,
      inProgressTasks,
      overdueTasks: overdueCount,
      members: memberCount || 0,
    },
    recentProjects,
    myTasks,
    tasksByStatus,
  });
}
