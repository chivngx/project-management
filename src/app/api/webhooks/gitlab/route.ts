import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  // Find project and its workspace details
  const { data: project, error: projErr } = await db
    .from("Project")
    .select("*, workspace:Workspace(*)")
    .eq("id", projectId)
    .maybeSingle();

  if (projErr) throw projErr;

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
  const creatorId = project.workspace?.ownerId;

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
        const { data: existing, error: existErr } = await db
          .from("Task")
          .select("*")
          .eq("projectId", projectId)
          .eq("externalProvider", "gitlab")
          .eq("externalNumber", issueIid)
          .maybeSingle();

        if (existErr) throw existErr;

        if (!existing) {
          const newTaskId = crypto.randomUUID();
          const { data: newTask, error: newTaskErr } = await db
            .from("Task")
            .insert({
              id: newTaskId,
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
            })
            .select()
            .single();

          if (newTaskErr) throw newTaskErr;

          const newActivityId = crypto.randomUUID();
          const { error: actErr } = await db
            .from("Activity")
            .insert({
              id: newActivityId,
              workspaceId: project.workspaceId,
              action: "created_task",
              entityType: "TASK",
              entityId: newTask.id,
              message: `Webhook: Tác vụ "${attrs.title}" được tạo tự động từ GitLab Issue #${issueIid}`,
            });

          if (actErr) throw actErr;
        }
      } else if (action === "close") {
        // Update task status to DONE
        const { data: task, error: findErr } = await db
          .from("Task")
          .select("*")
          .eq("projectId", projectId)
          .eq("externalProvider", "gitlab")
          .eq("externalNumber", issueIid)
          .maybeSingle();

        if (findErr) throw findErr;

        if (task && task.status !== "DONE") {
          const { error: updateErr } = await db
            .from("Task")
            .update({ status: "DONE" })
            .eq("id", task.id);

          if (updateErr) throw updateErr;

          const newActivityId = crypto.randomUUID();
          const { error: actErr } = await db
            .from("Activity")
            .insert({
              id: newActivityId,
              workspaceId: project.workspaceId,
              action: "completed_task",
              entityType: "TASK",
              entityId: task.id,
              message: `Webhook: Tác vụ "${task.title}" được hoàn thành (GitLab Issue #${issueIid} đã đóng)`,
            });

          if (actErr) throw actErr;
        }
      } else if (action === "reopen") {
        // Update task status to IN_PROGRESS or TODO
        const { data: task, error: findErr } = await db
          .from("Task")
          .select("*")
          .eq("projectId", projectId)
          .eq("externalProvider", "gitlab")
          .eq("externalNumber", issueIid)
          .maybeSingle();

        if (findErr) throw findErr;

        if (task && task.status === "DONE") {
          const { error: updateErr } = await db
            .from("Task")
            .update({ status: "IN_PROGRESS" })
            .eq("id", task.id);

          if (updateErr) throw updateErr;

          const newActivityId = crypto.randomUUID();
          const { error: actErr } = await db
            .from("Activity")
            .insert({
              id: newActivityId,
              workspaceId: project.workspaceId,
              action: "created_task",
              entityType: "TASK",
              entityId: task.id,
              message: `Webhook: Tác vụ "${task.title}" được mở lại (GitLab Issue #${issueIid} mở lại)`,
            });

          if (actErr) throw actErr;
        }
      } else if (action === "update") {
        // Update task details
        const { data: task, error: findErr } = await db
          .from("Task")
          .select("*")
          .eq("projectId", projectId)
          .eq("externalProvider", "gitlab")
          .eq("externalNumber", issueIid)
          .maybeSingle();

        if (findErr) throw findErr;

        if (task) {
          const { error: updateErr } = await db
            .from("Task")
            .update({
              title: attrs.title,
              description: attrs.description || "",
            })
            .eq("id", task.id);

          if (updateErr) throw updateErr;
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
            const { data: task, error: findErr } = await db
              .from("Task")
              .select("*")
              .eq("projectId", projectId)
              .eq("externalProvider", "gitlab")
              .eq("externalNumber", num)
              .maybeSingle();

            if (findErr) throw findErr;

            if (task && task.status !== "REVIEW" && task.status !== "DONE") {
              const { error: updateErr } = await db
                .from("Task")
                .update({ status: "REVIEW" })
                .eq("id", task.id);

              if (updateErr) throw updateErr;

              const newActivityId = crypto.randomUUID();
              const { error: actErr } = await db
                .from("Activity")
                .insert({
                  id: newActivityId,
                  workspaceId: project.workspaceId,
                  action: "updated_project",
                  entityType: "TASK",
                  entityId: task.id,
                  message: `Webhook: Tác vụ "${task.title}" được chuyển sang Đánh giá (MR #${attrs.iid} được mở)`,
                });

              if (actErr) throw actErr;
            }
          }
        } else if (action === "merge") {
          // Transition matched tasks to DONE
          for (const num of matchedNumbers) {
            const { data: task, error: findErr } = await db
              .from("Task")
              .select("*")
              .eq("projectId", projectId)
              .eq("externalProvider", "gitlab")
              .eq("externalNumber", num)
              .maybeSingle();

            if (findErr) throw findErr;

            if (task && task.status !== "DONE") {
              const { error: updateErr } = await db
                .from("Task")
                .update({ status: "DONE" })
                .eq("id", task.id);

              if (updateErr) throw updateErr;

              const newActivityId = crypto.randomUUID();
              const { error: actErr } = await db
                .from("Activity")
                .insert({
                  id: newActivityId,
                  workspaceId: project.workspaceId,
                  action: "completed_task",
                  entityType: "TASK",
                  entityId: task.id,
                  message: `Webhook: Tác vụ "${task.title}" đã hoàn thành (MR #${attrs.iid} đã được merge)`,
                });

              if (actErr) throw actErr;
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
