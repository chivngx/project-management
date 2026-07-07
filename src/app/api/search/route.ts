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

  const [projects, tasks, members] = await Promise.all([
    db.project.findMany({
      where: {
        workspaceId: workspace.id,
        OR: [
          { name: { contains: q } },
          { description: { contains: q } },
        ],
      },
      select: { id: true, name: true, status: true },
      take: 5,
    }),
    db.task.findMany({
      where: {
        project: { workspaceId: workspace.id },
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        projectId: true,
        project: { select: { name: true } },
      },
      take: 8,
    }),
    db.workspaceMember.findMany({
      where: {
        workspaceId: workspace.id,
        user: {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
          ],
        },
      },
      select: {
        user: { select: { id: true, name: true, email: true, image: true } },
        role: true,
      },
      take: 5,
    }),
  ]);

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
      projectName: t.project.name,
      href: `/projects/${t.projectId}`,
    })),
    members: members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      image: m.user.image,
      role: m.role,
    })),
  });
}
