import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("password123", 12);

  // --- Users ---
  const alex = await db.user.upsert({
    where: { email: "alex@example.com" },
    update: {},
    create: {
      name: "Alex Smith",
      email: "alex@example.com",
      passwordHash,
      image: null,
    },
  });

  const john = await db.user.upsert({
    where: { email: "john@example.com" },
    update: {},
    create: {
      name: "John Warrel",
      email: "john@example.com",
      passwordHash,
    },
  });

  const oliver = await db.user.upsert({
    where: { email: "oliver@example.com" },
    update: {},
    create: {
      name: "Oliver Watts",
      email: "oliver@example.com",
      passwordHash,
    },
  });

  // --- Workspace ---
  const workspace = await db.workspace.upsert({
    where: { id: "ws-cloud-ops" },
    update: {},
    create: {
      id: "ws-cloud-ops",
      name: "Cloud Ops Hub",
      ownerId: alex.id,
    },
  });

  await db.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: alex.id },
    },
    update: {},
    create: { workspaceId: workspace.id, userId: alex.id, role: "OWNER" },
  });
  await db.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: john.id },
    },
    update: {},
    create: { workspaceId: workspace.id, userId: john.id, role: "ADMIN" },
  });
  await db.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: oliver.id },
    },
    update: {},
    create: { workspaceId: workspace.id, userId: oliver.id, role: "MEMBER" },
  });

  // --- Projects (deterministic IDs for idempotent seeding) ---
  const p1 = await db.project.upsert({
    where: { id: "seed-project-k8s" },
    update: {
      name: "Kubernetes Migration",
      description:
        "Migrate the monolithic app infrastructure to Kubernetes for scalability.",
      status: "ACTIVE",
      priority: "HIGH",
      startDate: new Date("2026-01-20"),
      dueDate: new Date("2026-03-15"),
    },
    create: {
      id: "seed-project-k8s",
      workspaceId: workspace.id,
      name: "Kubernetes Migration",
      description:
        "Migrate the monolithic app infrastructure to Kubernetes for scalability.",
      status: "ACTIVE",
      priority: "HIGH",
      startDate: new Date("2026-01-20"),
      dueDate: new Date("2026-03-15"),
    },
  });

  const p2 = await db.project.upsert({
    where: { id: "seed-project-regression" },
    update: {
      name: "Automated Regression Suite",
      description:
        "Selenium + Playwright hybrid test framework for regression testing.",
      status: "ACTIVE",
      priority: "MEDIUM",
      startDate: new Date("2025-09-01"),
      dueDate: new Date("2025-12-01"),
    },
    create: {
      id: "seed-project-regression",
      workspaceId: workspace.id,
      name: "Automated Regression Suite",
      description:
        "Selenium + Playwright hybrid test framework for regression testing.",
      status: "ACTIVE",
      priority: "MEDIUM",
      startDate: new Date("2025-09-01"),
      dueDate: new Date("2025-12-01"),
    },
  });

  const p3 = await db.project.upsert({
    where: { id: "seed-project-redesign" },
    update: {
      name: "Website Redesign",
      description: "Refresh marketing site with new design system.",
      status: "PLANNING",
      priority: "LOW",
      startDate: new Date("2026-02-01"),
      dueDate: new Date("2026-04-30"),
    },
    create: {
      id: "seed-project-redesign",
      workspaceId: workspace.id,
      name: "Website Redesign",
      description: "Refresh marketing site with new design system.",
      status: "PLANNING",
      priority: "LOW",
      startDate: new Date("2026-02-01"),
      dueDate: new Date("2026-04-30"),
    },
  });

  // Project members (already idempotent via upsert on unique constraint).
  for (const [proj, members] of [
    [p1, [alex, john, oliver]],
    [p2, [alex, john, oliver]],
    [p3, [alex, oliver]],
  ] as const) {
    for (const m of members) {
      await db.projectMember.upsert({
        where: { projectId_userId: { projectId: proj.id, userId: m.id } },
        update: {},
        create: { projectId: proj.id, userId: m.id, role: "MEMBER" },
      });
    }
  }

  // --- Tasks (deterministic IDs) ---
  const tasks = [
    {
      id: "seed-task-1",
      title: "Security Audit",
      projectId: p1.id,
      status: "IN_PROGRESS",
      priority: "HIGH",
      assigneeId: oliver.id,
      creatorId: alex.id,
      dueDate: new Date("2026-02-01"),
    },
    {
      id: "seed-task-2",
      title: "Set Up EKS Cluster",
      projectId: p1.id,
      status: "TODO",
      priority: "HIGH",
      assigneeId: john.id,
      creatorId: alex.id,
      dueDate: new Date("2026-01-30"),
    },
    {
      id: "seed-task-3",
      title: "Implement CI/CD with GitHub Actions",
      projectId: p1.id,
      status: "TODO",
      priority: "MEDIUM",
      assigneeId: alex.id,
      creatorId: john.id,
      dueDate: new Date("2026-02-15"),
    },
    {
      id: "seed-task-4",
      title: "Containerize Services",
      projectId: p1.id,
      status: "DONE",
      priority: "HIGH",
      assigneeId: john.id,
      creatorId: alex.id,
      dueDate: new Date("2026-01-22"),
    },
    {
      id: "seed-task-5",
      title: "Migrate to Playwright 1.48",
      projectId: p2.id,
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      assigneeId: oliver.id,
      creatorId: alex.id,
      dueDate: new Date("2025-11-15"),
    },
    {
      id: "seed-task-6",
      title: "Parallel Test Execution",
      projectId: p2.id,
      status: "TODO",
      priority: "MEDIUM",
      assigneeId: john.id,
      creatorId: alex.id,
      dueDate: new Date("2025-11-20"),
    },
    {
      id: "seed-task-7",
      title: "Visual Snapshot Comparison",
      projectId: p2.id,
      status: "TODO",
      priority: "LOW",
      assigneeId: oliver.id,
      creatorId: alex.id,
      dueDate: new Date("2025-12-01"),
    },
    {
      id: "seed-task-8",
      title: "Design System Audit",
      projectId: p3.id,
      status: "TODO",
      priority: "LOW",
      assigneeId: alex.id,
      creatorId: oliver.id,
      dueDate: new Date("2026-03-01"),
    },
  ];
  for (const t of tasks) {
    const { id, ...data } = t;
    await db.task.upsert({ where: { id }, update: data, create: t });
  }

  // --- Activity (deterministic IDs) ---
  const activities = [
    {
      id: "seed-act-1",
      workspaceId: workspace.id,
      userId: alex.id,
      action: "created_project",
      entityType: "PROJECT",
      entityId: p1.id,
      message: "Alex created project Kubernetes Migration",
    },
    {
      id: "seed-act-2",
      workspaceId: workspace.id,
      userId: alex.id,
      action: "created_project",
      entityType: "PROJECT",
      entityId: p2.id,
      message: "Alex created project Automated Regression Suite",
    },
    {
      id: "seed-act-3",
      workspaceId: workspace.id,
      userId: john.id,
      action: "completed_task",
      entityType: "TASK",
      entityId: "seed-task-4",
      message: "John completed task Containerize Services",
    },
    {
      id: "seed-act-4",
      workspaceId: workspace.id,
      userId: oliver.id,
      action: "updated_project",
      entityType: "PROJECT",
      entityId: p3.id,
      message: "Oliver updated project Website Redesign",
    },
  ];
  for (const a of activities) {
    const { id, ...data } = a;
    await db.activity.upsert({ where: { id }, update: data, create: a });
  }

  console.log("Seed complete (idempotent).");
  console.log("Login with: alex@example.com / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
