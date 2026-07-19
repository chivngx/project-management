import { NextResponse } from "next/server";
import { ProjectRepository } from "@/repositories/project.repository";
import { TaskRepository } from "@/repositories/task.repository";
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
    project: { id: (t.project as any)?.id, name: (t.project as any)?.name },
  };
}

/** All tasks assigned to the current user in the active workspace, across all
 *  projects, grouped by status for the "My Tasks" view. */
export async function GET() {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace)
    return NextResponse.json({ TODO: [], IN_PROGRESS: [], REVIEW: [], DONE: [] });

  const projects = await ProjectRepository.findByWorkspaceId(workspace.id);
  const projectIds = projects.map((p) => p.id);

  if (projectIds.length === 0) {
    return NextResponse.json({ TODO: [], IN_PROGRESS: [], REVIEW: [], DONE: [] });
  }

  const tasks = await TaskRepository.findByAssigneeIdAndProjects(user.id, projectIds);

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
