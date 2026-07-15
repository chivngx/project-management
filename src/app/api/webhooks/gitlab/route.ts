import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  // Find project and its workspace details
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { workspace: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Validate signature if secret is configured
  if (project.repoWebhookSecret) {
    const token = req.headers.get("x-gitlab-token");
    if (token !== project.repoWebhookSecret) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
  }

  const bodyText = await req.text();
  let payload: any;
  try {
    payload = JSON.parse(bodyText);
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const gitlabEvent = req.headers.get("x-gitlab-event");
  const creatorId = project.workspace.ownerId;

  try {
    if (gitlabEvent === "Issue Hook") {
      const attrs = payload.object_attributes;
      if (!attrs) {
        return NextResponse.json({ ok: true, message: "No object_attributes in payload" });
      }

      const action = attrs.action;
      const issueIid = attrs.iid;
      const issueId = String(attrs.id);

      if (action === "open") {
        // Create new task in ProjectFlow if it doesn't exist
        const existing = await db.task.findFirst({
          where: { projectId, externalProvider: "gitlab", externalNumber: issueIid },
        });

        if (!existing) {
          const newTask = await db.task.create({
            data: {
              projectId,
              title: attrs.title,
              description: attrs.description || "",
              status: "TODO",
              priority: "MEDIUM",
              creatorId,
              externalId: issueId,
              externalNumber: issueIid,
              externalUrl: attrs.url,
              externalProvider: "gitlab",
            },
          });

          await db.activity.create({
            data: {
              workspaceId: project.workspaceId,
              action: "created_task",
              entityType: "TASK",
              entityId: newTask.id,
              message: `Webhook: Tác vụ "${attrs.title}" được tạo tự động từ GitLab Issue #${issueIid}`,
            },
          });
        }
      } else if (action === "close") {
        // Update task status to DONE
        const task = await db.task.findFirst({
          where: { projectId, externalProvider: "gitlab", externalNumber: issueIid },
        });

        if (task && task.status !== "DONE") {
          await db.task.update({
            where: { id: task.id },
            data: { status: "DONE" },
          });

          await db.activity.create({
            data: {
              workspaceId: project.workspaceId,
              action: "completed_task",
              entityType: "TASK",
              entityId: task.id,
              message: `Webhook: Tác vụ "${task.title}" được hoàn thành (GitLab Issue #${issueIid} đã đóng)`,
            },
          });
        }
      } else if (action === "reopen") {
        // Update task status to IN_PROGRESS or TODO
        const task = await db.task.findFirst({
          where: { projectId, externalProvider: "gitlab", externalNumber: issueIid },
        });

        if (task && task.status === "DONE") {
          await db.task.update({
            where: { id: task.id },
            data: { status: "IN_PROGRESS" },
          });

          await db.activity.create({
            data: {
              workspaceId: project.workspaceId,
              action: "created_task",
              entityType: "TASK",
              entityId: task.id,
              message: `Webhook: Tác vụ "${task.title}" được mở lại (GitLab Issue #${issueIid} mở lại)`,
            },
          });
        }
      } else if (action === "update") {
        // Update task details
        const task = await db.task.findFirst({
          where: { projectId, externalProvider: "gitlab", externalNumber: issueIid },
        });

        if (task) {
          await db.task.update({
            where: { id: task.id },
            data: {
              title: attrs.title,
              description: attrs.description || "",
            },
          });
        }
      }
    } else if (gitlabEvent === "Merge Request Hook") {
      const attrs = payload.object_attributes;
      if (!attrs) {
        return NextResponse.json({ ok: true, message: "No object_attributes in payload" });
      }

      const action = attrs.action; // "open", "merge", "close", "update"
      
      // Identify referenced issue or task numbers
      const searchText = `${attrs.title} ${attrs.source_branch || ""} ${attrs.description || ""}`;
      const issueMatches = searchText.match(/(?:#|issue-)(\d+)/gi);
      const matchedNumbers = issueMatches
        ? Array.from(new Set(issueMatches.map((m) => parseInt(m.replace(/[^\d]/g, ""), 10))))
        : [];

      if (matchedNumbers.length > 0) {
        if (action === "open") {
          // Transition matched tasks to REVIEW status
          for (const num of matchedNumbers) {
            const task = await db.task.findFirst({
              where: { projectId, externalProvider: "gitlab", externalNumber: num },
            });

            if (task && task.status !== "REVIEW" && task.status !== "DONE") {
              await db.task.update({
                where: { id: task.id },
                data: { status: "REVIEW" },
              });

              await db.activity.create({
                data: {
                  workspaceId: project.workspaceId,
                  action: "updated_project",
                  entityType: "TASK",
                  entityId: task.id,
                  message: `Webhook: Tác vụ "${task.title}" được chuyển sang Đánh giá (MR #${attrs.iid} được mở)`,
                },
              });
            }
          }
        } else if (action === "merge") {
          // Transition matched tasks to DONE
          for (const num of matchedNumbers) {
            const task = await db.task.findFirst({
              where: { projectId, externalProvider: "gitlab", externalNumber: num },
            });

            if (task && task.status !== "DONE") {
              await db.task.update({
                where: { id: task.id },
                data: { status: "DONE" },
              });

              await db.activity.create({
                data: {
                  workspaceId: project.workspaceId,
                  action: "completed_task",
                  entityType: "TASK",
                  entityId: task.id,
                  message: `Webhook: Tác vụ "${task.title}" đã hoàn thành (MR #${attrs.iid} đã được merge)`,
                },
              });
            }
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: err.message || "Failed to process webhook" }, { status: 500 });
  }
}
