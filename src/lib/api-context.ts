import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspace";
import { db } from "@/lib/db";
import type { WorkspaceMember } from "@prisma/client";

export type ApiUser = { id: string; name?: string | null; email?: string | null };

export type ApiContext = {
  user: ApiUser | null;
  workspace: ReturnType<typeof getActiveWorkspace> extends Promise<infer W>
    ? W extends { workspace: infer WS }
      ? WS
      : null
    : null;
  membership: Pick<WorkspaceMember, "role"> | null;
};

/**
 * Resolve the authenticated user + active workspace + their membership role
 * for an API route. Returns { user: null } when not authenticated — caller
 * should respond 401.
 */
export async function getApiContext() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { user: null, workspace: null, membership: null };

  const user = session.user as unknown as ApiUser & { id?: string };
  if (!user.id) return { user: null, workspace: null, membership: null };

  const { workspace } = await getActiveWorkspace(user.id);
  if (!workspace) {
    return { user: user as ApiUser, workspace: null, membership: null };
  }

  // Look up the caller's role in this workspace (also confirms membership).
  const membership = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
    },
    select: { role: true },
  });

  // If the user has no membership row (edge case: cookie points to a ws they
  // were removed from), treat as no workspace access.
  if (!membership) {
    return { user: user as ApiUser, workspace: null, membership: null };
  }

  return { user: user as ApiUser, workspace, membership };
}

/** Roles that can administer a workspace (rename/delete/invite). */
export function canAdmin(
  membership: Pick<WorkspaceMember, "role"> | null
): boolean {
  return membership?.role === "OWNER" || membership?.role === "ADMIN";
}

export function isOwner(
  membership: Pick<WorkspaceMember, "role"> | null
): boolean {
  return membership?.role === "OWNER";
}

/** 403 response helper with a Vietnamese message. */
export function forbidden(message = "Bạn không có quyền thực hiện hành động này") {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}
