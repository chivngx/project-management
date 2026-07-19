// Shared types for the Projects feature pages.
// These now match the API response shapes directly (the detail route was
// normalized to the flat shape in Stage 1, so client-side normalization is
// no longer needed).

export interface Member {
  id: string;
  name: string;
  username?: string;
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
  projectId: string;

  // External reference
  externalId?: string | null;
  externalNumber?: number | null;
  externalUrl?: string | null;
  externalProvider?: string | null;
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
  taskCount: number;

  // Integration settings
  repoProvider?: string | null;
  repoOwner?: string | null;
  repoName?: string | null;
  repoToken?: string | null;
  repoApiUrl?: string | null;
  repoWebhookSecret?: string | null;
}
