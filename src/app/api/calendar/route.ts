import { NextResponse } from "next/server";
import { db } from "@/lib/db";
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

  const tasks = await db.task.findMany({
    where: {
      project: { workspaceId: workspace.id },
      dueDate: { gte: start, lt: end },
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      projectId: true,
      project: { select: { name: true } },
      assignee: { select: { name: true, image: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  return NextResponse.json(
    tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      projectName: t.project.name,
      projectId: t.projectId,
      assigneeName: t.assignee?.name ?? null,
    }))
  );
}
