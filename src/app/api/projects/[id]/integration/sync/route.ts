import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";
import { decrypt } from "@/lib/encryption";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id: projectId } = await params;
  const { searchParams } = new URL(req.url);
  const integrationId = searchParams.get("integrationId");

  // Find the selected integration (or default to the first one)
  let integration: any = null;
  if (integrationId) {
    const { data, error } = await db
      .from("GitIntegration")
      .select("*")
      .eq("id", integrationId)
      .eq("projectId", projectId)
      .maybeSingle();

    if (error) throw error;
    integration = data;
  } else {
    const { data, error } = await db
      .from("GitIntegration")
      .select("*")
      .eq("projectId", projectId)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    integration = data;
  }

  if (!integration) {
    return NextResponse.json({ error: "Dự án chưa cấu hình tích hợp Git" }, { status: 400 });
  }

  try {
    const token = decrypt(integration.token);
    const provider = integration.provider;
    const owner = integration.owner;
    const name = integration.name;

    // Get existing linked tasks for this specific integration
    const { data: existingTasks, error: tasksErr } = await db
      .from("Task")
      .select("externalNumber")
      .eq("projectId", projectId)
      .eq("gitIntegrationId", integration.id)
      .not("externalNumber", "is", null);

    if (tasksErr) throw tasksErr;
    const linkedNumbers = new Set((existingTasks || []).map((t: any) => t.externalNumber));

    let externalIssues: any[] = [];

    if (provider === "github") {
      const headers = {
        Accept: "application/vnd.github.v3+json",
        ...(token ? { Authorization: `token ${token}` } : {}),
      };

      const res = await fetch(`https://api.github.com/repos/${owner}/${name}/issues?state=open&per_page=100`, { headers });
      if (!res.ok) throw new Error(`GitHub API returned status ${res.status}`);
      const data = await res.json();
      
      if (Array.isArray(data)) {
        externalIssues = data
          .filter((item: any) => !item.pull_request)
          .map((item: any) => ({
            id: String(item.id),
            number: item.number,
            title: item.title,
            description: item.body || "",
            url: item.html_url,
            state: item.state,
          }));
      }
    } else if (provider === "gitlab") {
      const apiBase = integration.apiUrl || "https://gitlab.com";
      const projectPath = encodeURIComponent(`${owner}/${name}`);
      const headers = {
        ...(token ? { "PRIVATE-TOKEN": token } : {}),
      };

      const res = await fetch(`${apiBase}/api/v4/projects/${projectPath}/issues?state=opened&per_page=100`, { headers });
      if (!res.ok) throw new Error(`GitLab API returned status ${res.status}`);
      const data = await res.json();

      if (Array.isArray(data)) {
        externalIssues = data.map((item: any) => ({
          id: String(item.id),
          number: item.iid,
          title: item.title,
          description: item.description || "",
          url: item.web_url,
          state: item.state,
        }));
      }
    }

    // Filter out already linked issues
    const unlinkedIssues = externalIssues.filter((issue) => !linkedNumbers.has(issue.number));

    return NextResponse.json({ unlinkedIssues, integrationId: integration.id });
  } catch (err: any) {
    console.error("Error in sync GET:", err);
    return NextResponse.json({ error: err.message || "Không thể tải danh sách issue từ Git" }, { status: 500 });
  }
}

const syncSchema = z.object({
  integrationId: z.string().optional(),
  issues: z.array(z.object({
    id: z.string(),
    number: z.number(),
    title: z.string(),
    description: z.string().optional().nullable(),
    url: z.string(),
  })).optional(),
});

export async function POST(req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id: projectId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = syncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu yêu cầu không hợp lệ" }, { status: 400 });
  }

  const { integrationId, issues: issuesToImport } = parsed.data;

  // Find the selected integration (or default to the first one)
  let integration: any = null;
  if (integrationId) {
    const { data, error } = await db
      .from("GitIntegration")
      .select("*")
      .eq("id", integrationId)
      .eq("projectId", projectId)
      .maybeSingle();

    if (error) throw error;
    integration = data;
  } else {
    const { data, error } = await db
      .from("GitIntegration")
      .select("*")
      .eq("projectId", projectId)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    integration = data;
  }

  if (!integration) {
    return NextResponse.json({ error: "Dự án chưa cấu hình tích hợp Git" }, { status: 400 });
  }

  try {
    const provider = integration.provider;
    const token = decrypt(integration.token);
    const owner = integration.owner;
    const name = integration.name;

    let importedCount = 0;
    let updatedCount = 0;

    // Phase 1: Import selected issues
    if (issuesToImport && issuesToImport.length > 0) {
      for (const issue of issuesToImport) {
        // Double check if already imported
        const { data: exists, error: existErr } = await db
          .from("Task")
          .select("id")
          .eq("projectId", projectId)
          .eq("gitIntegrationId", integration.id)
          .eq("externalNumber", issue.number)
          .maybeSingle();

        if (existErr) throw existErr;

        if (!exists) {
          const newTaskId = crypto.randomUUID();
          const { error: insertErr } = await db
            .from("Task")
            .insert({
              id: newTaskId,
              projectId,
              title: issue.title,
              description: issue.description || "",
              status: "TODO",
              priority: "MEDIUM",
              creatorId: user.id,
              externalId: issue.id,
              externalNumber: issue.number,
              externalUrl: issue.url,
              externalProvider: provider,
              gitIntegrationId: integration.id,
            });

          if (insertErr) throw insertErr;
          importedCount++;
        }
      }
    }

    // Phase 2: Status Synchronization for existing linked tasks
    const { data: linkedTasksRaw, error: linkedErr } = await db
      .from("Task")
      .select("*")
      .eq("projectId", projectId)
      .eq("gitIntegrationId", integration.id)
      .not("externalNumber", "is", null);

    if (linkedErr) throw linkedErr;
    const linkedTasks = linkedTasksRaw || [];

    if (linkedTasks.length > 0) {
      if (provider === "github") {
        const headers = {
          Accept: "application/vnd.github.v3+json",
          ...(token ? { Authorization: `token ${token}` } : {}),
        };

        const res = await fetch(`https://api.github.com/repos/${owner}/${name}/issues?state=all&per_page=100`, { headers });
        if (res.ok) {
          const remoteIssues = await res.json();
          if (Array.isArray(remoteIssues)) {
            const remoteMap = new Map(remoteIssues.map((item: any) => [item.number, item.state]));
            
            for (const task of linkedTasks) {
              if (task.externalNumber) {
                const remoteState = remoteMap.get(task.externalNumber);
                if (remoteState) {
                  const targetStatus = remoteState === "closed" ? "DONE" : task.status === "DONE" ? "TODO" : task.status;
                  if (task.status !== targetStatus) {
                    const { error: updateTaskErr } = await db
                      .from("Task")
                      .update({ status: targetStatus })
                      .eq("id", task.id);

                    if (updateTaskErr) throw updateTaskErr;
                    updatedCount++;
                  }
                }
              }
            }
          }
        }
      } else if (provider === "gitlab") {
        const apiBase = integration.apiUrl || "https://gitlab.com";
        const projectPath = encodeURIComponent(`${owner}/${name}`);
        const headers = {
          ...(token ? { "PRIVATE-TOKEN": token } : {}),
        };

        const res = await fetch(`${apiBase}/api/v4/projects/${projectPath}/issues?state=all&per_page=100`, { headers });
        if (res.ok) {
          const remoteIssues = await res.json();
          if (Array.isArray(remoteIssues)) {
            const remoteMap = new Map(remoteIssues.map((item: any) => [item.iid, item.state]));
            
            for (const task of linkedTasks) {
              if (task.externalNumber) {
                const remoteState = remoteMap.get(task.externalNumber);
                if (remoteState) {
                  const targetStatus = remoteState === "closed" ? "DONE" : task.status === "DONE" ? "TODO" : task.status;
                  if (task.status !== targetStatus) {
                    const { error: updateTaskErr } = await db
                      .from("Task")
                      .update({ status: targetStatus })
                      .eq("id", task.id);

                    if (updateTaskErr) throw updateTaskErr;
                    updatedCount++;
                  }
                }
              }
            }
          }
        }
      }
    }

    if (importedCount > 0 || updatedCount > 0) {
      const newActivityId = crypto.randomUUID();
      const { error: actErr } = await db
        .from("Activity")
        .insert({
          id: newActivityId,
          workspaceId: workspace.id,
          userId: user.id,
          action: "updated_project",
          entityType: "PROJECT",
          entityId: projectId,
          message: `${user.name || "Someone"} đồng bộ Git (${owner}/${name}): đã import ${importedCount} tasks, cập nhật ${updatedCount} tasks.`,
        });

      if (actErr) throw actErr;
    }

    return NextResponse.json({
      ok: true,
      importedCount,
      updatedCount,
    });
  } catch (err: any) {
    console.error("Error in sync POST:", err);
    return NextResponse.json({ error: err.message || "Không thể đồng bộ hóa dự án" }, { status: 500 });
  }
}
