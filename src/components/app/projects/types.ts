// Shared types for the Projects feature pages.

export interface Member {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role?: string;
  joinedAt?: string;
}

export interface ProjectListItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  members: Member[];
  taskCount: number;
  doneCount: number;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assigneeId: string | null;
  assignee: Member | null;
  creatorId: string;
  creator: Member | null;
  createdAt: string;
  updatedAt: string;
  projectId?: string;
}

export interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  workspaceId: string;
  members: Member[];
  tasks: Task[];
}

/* ---- Raw API shapes (the GET /api/projects/[id] route returns these). ----
 * The detail route returns raw Prisma rows: members are ProjectMember rows
 * with a nested `user` object, not the flat shape the list route returns.
 * Tasks leak extra User fields (passwordHash etc.) but the relevant fields
 * are correct. We normalize to the friendly shapes above for the UI.
 */

interface RawUser {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
}

interface RawProjectMember {
  id: string;
  projectId?: string;
  userId?: string;
  role?: string;
  joinedAt?: string;
  user: RawUser;
}

interface RawTask {
  id: string;
  projectId?: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  creatorId: string;
  dueDate?: string | null;
  createdAt: string;
  updatedAt?: string;
  assignee?: RawUser | null;
  creator?: RawUser | null;
}

interface RawProject {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  priority: string;
  startDate?: string | null;
  dueDate?: string | null;
  createdAt: string;
  updatedAt?: string;
  workspaceId?: string;
  members?: RawProjectMember[];
  tasks?: RawTask[];
}

function normalizeUser(u: RawUser | null | undefined): Member | null {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name ?? "Không tên",
    email: u.email ?? "",
    image: u.image ?? null,
  };
}

export function normalizeProject(raw: RawProject): ProjectDetail {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? null,
    status: raw.status,
    priority: raw.priority,
    startDate: raw.startDate ?? null,
    dueDate: raw.dueDate ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt ?? raw.createdAt,
    workspaceId: raw.workspaceId ?? "",
    members: (raw.members ?? []).map((m) => {
      const u = normalizeUser(m.user);
      return u
        ? { ...u, role: m.role, joinedAt: m.joinedAt }
        : {
            id: m.userId ?? m.id,
            name: "Không tên",
            email: "",
            image: null,
            role: m.role,
            joinedAt: m.joinedAt,
          };
    }),
    tasks: (raw.tasks ?? []).map((t) => ({
      id: t.id,
      projectId: t.projectId,
      title: t.title,
      description: t.description ?? null,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate ?? null,
      assigneeId: t.assigneeId,
      assignee: normalizeUser(t.assignee),
      creatorId: t.creatorId,
      creator: normalizeUser(t.creator),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt ?? t.createdAt,
    })),
  };
}

