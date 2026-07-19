import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { WorkspaceRepository } from "@/repositories/workspace.repository";
import { UserRepository } from "@/repositories/user.repository";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

/** Get the authenticated session, or null. */
export async function getSession() {
  return getServerSession(authOptions);
}

/** Require auth: returns the user, or redirects to /login. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const record = await UserRepository.findById(session.user.id);
  if (!record) redirect("/login");

  return {
    id: record.id,
    name: record.name,
    email: record.email,
    image: record.image,
  };
}

/**
 * Require auth + resolve the user's "active workspace".
 * Selection order:
 *  1. the cookie `workspaceId` if the user is a member of it
 *  2. the first workspace the user is a member of
 *  3. none (null) — caller should handle (e.g. onboarding)
 */
export async function requireUserWithWorkspace() {
  const user = await requireUser();
  const memberships = await WorkspaceRepository.findMembershipsByUserId(user.id);

  if (memberships.length === 0) {
    return { user, workspace: null, workspaces: [] };
  }

  // Default to the first workspace; per-request override can be added later.
  const active = memberships[0];
  return { user, workspace: active.workspace, workspaces: memberships };
}
