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

  // Use groupBy + count instead of loading all tasks into memory.
  const [projectCount, projectStatusGroups, taskStatusGroups, memberCount, overdueCount] =
    await Promise.all([
      db.project.count({ where: { workspaceId: workspace.id } }),
      db.project.groupBy({
        by: ["status"],
        where: { workspaceId: workspace.id },
        _count: { _all: true },
      }),
      db.task.groupBy({
        by: ["status"],
        where: { project: { workspaceId: workspace.id } },
        _count: { _all: true },
      }),
      db.workspaceMember.count({ where: { workspaceId: workspace.id } }),
      db.task.count({
        where: {
          project: { workspaceId: workspace.id },
          dueDate: { lt: new Date() },
          status: { not: "DONE" },
        },
      }),
    ]);

  const statusCount = (status: string) =>
    taskStatusGroups.find((g) => g.status === status)?._count._all ?? 0;

  const todoTasks = statusCount("TODO");
  const inProgressTasks = statusCount("IN_PROGRESS");
  const reviewTasks = statusCount("REVIEW");
  const doneTasks = statusCount("DONE");
  const totalTasks = todoTasks + inProgressTasks + reviewTasks + doneTasks;

  const activeProjects =
    projectStatusGroups.find((g) => g.status === "ACTIVE")?._count._all ?? 0;
  const completedProjects =
    projectStatusGroups.find((g) => g.status === "COMPLETED")?._count._all ?? 0;

  // Recent projects: fetch top 4 by createdAt, then compute done counts in
  // a single groupBy (avoids the N+1 of one query per project).
  const recentProjectsRaw = await db.project.findMany({
    where: { workspaceId: workspace.id },
    select: {
      id: true,
      name: true,
      status: true,
      priority: true,
      dueDate: true,
      startDate: true,
      members: { select: { userId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 4,
  });

  const recentIds = recentProjectsRaw.map((p) => p.id);
  const [taskCountsByProject, doneCountsByProject] = await Promise.all([
    db.task.groupBy({
      by: ["projectId"],
      where: { projectId: { in: recentIds } },
      _count: { _all: true },
    }),
    db.task.groupBy({
      by: ["projectId"],
      where: { projectId: { in: recentIds }, status: "DONE" },
      _count: { _all: true },
    }),
  ]);

  const recentProjects = recentProjectsRaw.map((p) => {
    const total =
      taskCountsByProject.find((g) => g.projectId === p.id)?._count._all ?? 0;
    const done =
      doneCountsByProject.find((g) => g.projectId === p.id)?._count._all ?? 0;
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      priority: p.priority,
      dueDate: p.dueDate,
      memberCount: p.members.length,
      taskCount: total,
      doneCount: done,
      progress: total ? Math.round((done / total) * 100) : 0,
    };
  });

  // My tasks: assigned to current user, not done, sorted by due date, top 6.
  const myTasksRaw = await db.task.findMany({
    where: {
      assigneeId: user.id,
      status: { not: "DONE" },
      project: { workspaceId: workspace.id },
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      projectId: true,
      project: { select: { name: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 6,
  });

  const myTasks = myTasksRaw.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    projectName: t.project.name,
    projectId: t.projectId,
  }));

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
      members: memberCount,
    },
    recentProjects,
    myTasks,
    tasksByStatus,
  });
}
