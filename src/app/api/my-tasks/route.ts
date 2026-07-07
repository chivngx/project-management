import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";

/** All tasks assigned to the current user in the active workspace, across all
 *  projects, grouped by status for the "My Tasks" view. */
export async function GET() {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace)
    return NextResponse.json({ TODO: [], IN_PROGRESS: [], REVIEW: [], DONE: [] });

  const tasks = await db.task.findMany({
    where: {
      assigneeId: user.id,
      project: { workspaceId: workspace.id },
    },
    include: {
      project: { select: { id: true, name: true } },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  const grouped = {
    TODO: [] as typeof tasks,
    IN_PROGRESS: [] as typeof tasks,
    REVIEW: [] as typeof tasks,
    DONE: [] as typeof tasks,
  };
  for (const t of tasks) {
    const bucket = (grouped as Record<string, typeof tasks>)[t.status] ?? grouped.TODO;
    bucket.push(t);
  }

  return NextResponse.json({
    TODO: grouped.TODO.map(mapTask),
    IN_PROGRESS: grouped.IN_PROGRESS.map(mapTask),
    REVIEW: grouped.REVIEW.map(mapTask),
    DONE: grouped.DONE.map(mapTask),
  });
}

function mapTask(t: (Awaited<ReturnType<typeof db.task.findMany>>)[number]) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    createdAt: t.createdAt,
    project: { id: t.project.id, name: t.project.name },
  };
}
