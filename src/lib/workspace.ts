import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
export type Workspace = {
  id: string;
  name: string;
  image: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceLite = {
  id: string;
  name: string;
  image: string | null;
};

export const getActiveWorkspace = cache(
  async (userId: string): Promise<{
    workspace: Workspace | null;
    workspaces: WorkspaceLite[];
  }> => {
    const cookieStore = await cookies();
    const cookieId = cookieStore.get("workspaceId")?.value;

    const { data: rawMemberships, error } = await db
      .from("WorkspaceMember")
      .select("*, workspace:Workspace(*)")
      .eq("userId", userId)
      .order("joinedAt", { ascending: true });

    if (error) throw error;
    const memberships = (rawMemberships || []) as any[];

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
);

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
