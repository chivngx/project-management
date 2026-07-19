import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";

type TaskWithProject = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  project: { id: string; name: string };
};

function mapTask(t: any): TaskWithProject {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    createdAt: t.createdAt,
    project: { id: t.project?.id, name: t.project?.name },
  };
}

/** All tasks assigned to the current user in the active workspace, across all
 *  projects, grouped by status for the "My Tasks" view. */
export async function GET() {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace)
    return NextResponse.json({ TODO: [], IN_PROGRESS: [], REVIEW: [], DONE: [] });

  const { data: projects, error: projErr } = await db
    .from("Project")
    .select("id")
    .eq("workspaceId", workspace.id);

  if (projErr) throw projErr;
  const projectIds = (projects || []).map((p) => p.id);

  if (projectIds.length === 0) {
    return NextResponse.json({ TODO: [], IN_PROGRESS: [], REVIEW: [], DONE: [] });
  }

  const { data: rawTasks, error: tasksErr } = await db
    .from("Task")
    .select("*, project:Project(id, name)")
    .eq("assigneeId", user.id)
    .in("projectId", projectIds)
    .order("dueDate", { ascending: true })
    .order("createdAt", { ascending: false });

  if (tasksErr) throw tasksErr;
  const tasks = (rawTasks || []) as any[];

  const grouped: Record<string, TaskWithProject[]> = {
    TODO: [],
    IN_PROGRESS: [],
    REVIEW: [],
    DONE: [],
  };
  for (const t of tasks) {
    const bucket = grouped[t.status] ?? grouped.TODO;
    bucket.push(mapTask(t));
  }

  return NextResponse.json({
    TODO: grouped.TODO,
    IN_PROGRESS: grouped.IN_PROGRESS,
    REVIEW: grouped.REVIEW,
    DONE: grouped.DONE,
  });
}
