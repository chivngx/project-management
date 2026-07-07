import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";

/** Dashboard stats for the active workspace. */
export async function GET() {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({});

  const [projects, tasks, members] = await Promise.all([
    db.project.findMany({
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
    }),
    db.task.findMany({
      where: { project: { workspaceId: workspace.id } },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        assigneeId: true,
        assignee: { select: { id: true, name: true, email: true, image: true } },
        projectId: true,
        project: { select: { name: true } },
        createdAt: true,
      },
    }),
    db.workspaceMember.count({ where: { workspaceId: workspace.id } }),
  ]);

  const activeProjects = projects.filter((p) => p.status === "ACTIVE").length;
  const completedProjects = projects.filter(
    (p) => p.status === "COMPLETED"
  ).length;
  const doneTasks = tasks.filter((t) => t.status === "DONE").length;
  const inProgressTasks = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const todoTasks = tasks.filter((t) => t.status === "TODO").length;
  const reviewTasks = tasks.filter((t) => t.status === "REVIEW").length;
  const overdueTasks = tasks.filter(
    (t) => t.dueDate && t.dueDate < new Date() && t.status !== "DONE"
  ).length;

  // My tasks (assigned to current user) not done
  const myTasks = tasks
    .filter((t) => t.assigneeId === user.id && t.status !== "DONE")
    .sort((a, b) => {
      const ad = a.dueDate ? a.dueDate.getTime() : Infinity;
      const bd = b.dueDate ? b.dueDate.getTime() : Infinity;
      return ad - bd;
    })
    .slice(0, 6)
    .map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      projectName: t.project.name,
      projectId: t.projectId,
    }));

  // Recent projects (for the overview grid)
  const recentProjects = await Promise.all(
    projects.slice(0, 4).map(async (p) => {
      const total = await db.task.count({ where: { projectId: p.id } });
      const done = await db.task.count({
        where: { projectId: p.id, status: "DONE" },
      });
      const progress = total ? Math.round((done / total) * 100) : 0;
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        priority: p.priority,
        dueDate: p.dueDate,
        memberCount: p.members.length,
        taskCount: total,
        doneCount: done,
        progress,
      };
    })
  );

  // Tasks by status (for chart)
  const tasksByStatus = [
    { name: "To Do", value: todoTasks, key: "TODO" },
    { name: "In Progress", value: inProgressTasks, key: "IN_PROGRESS" },
    { name: "Review", value: reviewTasks, key: "REVIEW" },
    { name: "Done", value: doneTasks, key: "DONE" },
  ];

  return NextResponse.json({
    totals: {
      projects: projects.length,
      activeProjects,
      completedProjects,
      tasks: tasks.length,
      doneTasks,
      inProgressTasks,
      overdueTasks,
      members,
    },
    recentProjects,
    myTasks,
    tasksByStatus,
  });
}
