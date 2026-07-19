import { cookies } from "next/headers";
import { cache } from "react";
import { WorkspaceRepository } from "@/repositories/workspace.repository";

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

    const memberships = await WorkspaceRepository.findMembershipsByUserId(userId);

    if (memberships.length === 0) {
      return { workspace: null, workspaces: [] };
    }

    const activeMember =
      memberships.find((m: any) => m.workspaceId === cookieId) ?? memberships[0];

    return {
      workspace: activeMember.workspace,
      workspaces: memberships.map((m: any) => ({
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
