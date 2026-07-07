// Shared domain constants & labels for the Project Management app.
// Statuses/priorities are stored as Strings in SQLite (no Prisma enums).

export const PROJECT_STATUSES = [
  "ACTIVE",
  "PLANNING",
  "COMPLETED",
  "ON_HOLD",
  "CANCELLED",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const WORKSPACE_ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  PLANNING: "Planning",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
  CANCELLED: "Cancelled",
};

export const PRIORITY_LABEL: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const TASK_STATUS_LABEL: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  REVIEW: "Review",
  DONE: "Done",
};

// Tailwind-friendly badge variants per status/priority (kept neutral/safe —
// no indigo/blue per project guidelines).
export const PROJECT_STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  PLANNING: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  COMPLETED: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  ON_HOLD: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export const PRIORITY_BADGE: Record<string, string> = {
  LOW: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  MEDIUM: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export const TASK_STATUS_BADGE: Record<string, string> = {
  TODO: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  REVIEW: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  DONE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};
