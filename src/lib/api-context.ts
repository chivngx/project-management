import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspace";

export type ApiUser = { id: string; name?: string | null; email?: string | null };

/**
 * Resolve the authenticated user + active workspace for an API route.
 * Returns { user: null } when not authenticated — caller should respond 401.
 */
export async function getApiContext() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { user: null, workspace: null };

  const user = session.user as unknown as ApiUser & { id?: string };
  if (!user.id) return { user: null, workspace: null };

  const { workspace } = await getActiveWorkspace(user.id);
  return { user: user as ApiUser, workspace };
}
