import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  // Find project and its workspace details (to get workspace owner as default task creator)
  const { data: project, error: projErr } = await db
    .from("Project")
    .select("*, workspace:Workspace(*)")
    .eq("id", projectId)
    .maybeSingle();

  if (projErr) throw projErr;

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const bodyText = await req.text();

  // Validate signature if secret is configured
  if (project.repoWebhookSecret) {
    const signature = req.headers.get("x-hub-signature-256");
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const hmac = crypto.createHmac("sha256", project.repoWebhookSecret);
    const digest = "sha256=" + hmac.update(bodyText).digest("hex");

    if (signature !== digest) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(bodyText);
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const githubEvent = req.headers.get("x-github-event");
  const creatorId = project.workspace?.ownerId;

  try {
    if (githubEvent === "issues") {
      const action = payload.action;
      const issue = payload.issue;

      if (!issue) {
        return NextResponse.json({ ok: true, message: "No issue object in payload" });
      }

      const issueNumber = issue.number;
      const issueId = String(issue.id);

      if (action === "opened") {
        // Create new task in ProjectFlow
        // First check if it already exists to prevent duplicate
        const { data: existing, error: existErr } = await db
          .from("Task")
          .select("*")
          .eq("projectId", projectId)
          .eq("externalProvider", "github")
          .eq("externalNumber", issueNumber)
          .maybeSingle();

        if (existErr) throw existErr;

        if (!existing) {
          const newTaskId = crypto.randomUUID();
          const { data: newTask, error: newTaskErr } = await db
            .from("Task")
            .insert({
              id: newTaskId,
              projectId,
              title: issue.title,
              description: issue.body || "",
              status: "TODO",
              priority: "MEDIUM",
              creatorId,
              externalId: issueId,
              externalNumber: issueNumber,
              externalUrl: issue.html_url,
              externalProvider: "github",
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
              message: `Webhook: Tác vụ "${issue.title}" được tạo tự động từ GitHub Issue #${issueNumber}`,
            });

          if (actErr) throw actErr;
        }
      } else if (action === "closed") {
        // Update task status to DONE
        const { data: task, error: findErr } = await db
          .from("Task")
          .select("*")
          .eq("projectId", projectId)
          .eq("externalProvider", "github")
          .eq("externalNumber", issueNumber)
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
              message: `Webhook: Tác vụ "${task.title}" được hoàn thành (GitHub Issue #${issueNumber} đã đóng)`,
            });

          if (actErr) throw actErr;
        }
      } else if (action === "reopened") {
        // Update task status to IN_PROGRESS or TODO
        const { data: task, error: findErr } = await db
          .from("Task")
          .select("*")
          .eq("projectId", projectId)
          .eq("externalProvider", "github")
          .eq("externalNumber", issueNumber)
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
              message: `Webhook: Tác vụ "${task.title}" được mở lại (GitHub Issue #${issueNumber} mở lại)`,
            });

          if (actErr) throw actErr;
        }
      } else if (action === "edited") {
        // Update task details
        const { data: task, error: findErr } = await db
          .from("Task")
          .select("*")
          .eq("projectId", projectId)
          .eq("externalProvider", "github")
          .eq("externalNumber", issueNumber)
          .maybeSingle();

        if (findErr) throw findErr;

        if (task) {
          const { error: updateErr } = await db
            .from("Task")
            .update({
              title: issue.title,
              description: issue.body || "",
            })
            .eq("id", task.id);

          if (updateErr) throw updateErr;
        }
      }
    } else if (githubEvent === "pull_request") {
      const action = payload.action;
      const pr = payload.pull_request;

      if (!pr) {
        return NextResponse.json({ ok: true, message: "No PR object in payload" });
      }

      // Identify referenced issue or task numbers
      // Match "#42" or "issue-42" etc in PR title, branch, or body
      const searchText = `${pr.title} ${pr.head?.ref || ""} ${pr.body || ""}`;
      const issueMatches = searchText.match(/(?:#|issue-)(\d+)/gi);
      const matchedNumbers = issueMatches
        ? Array.from(new Set(issueMatches.map((m) => parseInt(m.replace(/[^\d]/g, ""), 10))))
        : [];

      if (matchedNumbers.length > 0) {
        if (action === "opened") {
          // Transition matched tasks to REVIEW status
          for (const num of matchedNumbers) {
            const { data: task, error: findErr } = await db
              .from("Task")
              .select("*")
              .eq("projectId", projectId)
              .eq("externalProvider", "github")
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
                  message: `Webhook: Tác vụ "${task.title}" được chuyển sang Đánh giá (PR #${pr.number} được mở)`,
                });

              if (actErr) throw actErr;
            }
          }
        } else if (action === "closed" && pr.merged) {
          // Transition matched tasks to DONE
          for (const num of matchedNumbers) {
            const { data: task, error: findErr } = await db
              .from("Task")
              .select("*")
              .eq("projectId", projectId)
              .eq("externalProvider", "github")
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
                  message: `Webhook: Tác vụ "${task.title}" đã hoàn thành (PR #${pr.number} đã được merge)`,
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
