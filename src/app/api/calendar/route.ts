import { NextResponse } from "next/server";
import { ProjectRepository } from "@/repositories/project.repository";
import { TaskRepository } from "@/repositories/task.repository";
import { getApiContext } from "@/lib/api-context";

/** Tasks with a due date in the active workspace, for the calendar view.
 *  Optional query: ?month=YYYY-MM (defaults to current month). */
export async function GET(req: Request) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json([]);

  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month"); // YYYY-MM

  let start: Date;
  let end: Date;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [year, month] = monthParam.split("-").map(Number);
    start = new Date(year, month - 1, 1);
    end = new Date(year, month, 1);
  } else {
    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  const projects = await ProjectRepository.findByWorkspaceId(workspace.id);
  const projectIds = projects.map((p) => p.id);

  if (projectIds.length === 0) return NextResponse.json([]);

  const tasks = await TaskRepository.findByProjectsAndDueDateRange(
    projectIds,
    start.toISOString(),
    end.toISOString()
  );

  return NextResponse.json(
    tasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      projectName: (t.project as any)?.name ?? null,
      projectId: t.projectId,
      assigneeName: (t.assignee as any)?.name ?? null,
    }))
  );
}
