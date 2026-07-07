import { cookies } from "next/headers";
import { db } from "@/lib/db";

export type WorkspaceLite = {
  id: string;
  name: string;
  image: string | null;
};

/**
 * Resolve the user's active workspace (from the `workspaceId` cookie if they
 * are a member, otherwise their first membership). Also returns all the
 * workspaces they belong to, for the switcher.
 */
export async function getActiveWorkspace(userId: string) {
  const cookieStore = await cookies();
  const cookieId = cookieStore.get("workspaceId")?.value;

  const memberships = await db.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { joinedAt: "asc" },
  });

  if (memberships.length === 0) {
    return { workspace: null, workspaces: [] as WorkspaceLite[] };
  }

  const activeMember =
    memberships.find((m) => m.workspaceId === cookieId) ?? memberships[0];

  return {
    workspace: activeMember.workspace,
    workspaces: memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      image: m.workspace.image,
    })),
  };
}

/** Set the active workspace cookie (used by the switcher API). */
export async function setActiveWorkspaceCookie(workspaceId: string) {
  const cookieStore = await cookies();
  cookieStore.set("workspaceId", workspaceId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
