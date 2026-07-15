import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";
import { encrypt, decrypt } from "@/lib/encryption";

type Params = { params: Promise<{ id: string }> };

const integrationSchema = z.object({
  repoProvider: z.enum(["github", "gitlab"]),
  repoOwner: z.string().min(1, "Owner/Organization không được để trống"),
  repoName: z.string().min(1, "Tên repository không được để trống"),
  repoToken: z.string().min(1, "Personal Access Token không được để trống"),
  repoApiUrl: z.string().url("Đường dẫn API URL không hợp lệ").optional().nullable().or(z.literal("")),
  repoWebhookSecret: z.string().optional().nullable(),
});

export async function GET(req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id: projectId } = await params;
  const { searchParams } = new URL(req.url);
  const selectedIntegrationId = searchParams.get("integrationId");

  // Fetch all integrations for this project
  const integrations = await db.gitIntegration.findMany({
    where: { projectId },
    select: {
      id: true,
      provider: true,
      owner: true,
      name: true,
      apiUrl: true,
      webhookSecret: true,
      createdAt: true,
    },
  });

  if (integrations.length === 0) {
    return NextResponse.json({ configured: false, integrations: [] });
  }

  // Find the active integration to fetch real-time data for
  const activeIntegrationMeta = selectedIntegrationId
    ? integrations.find((i) => i.id === selectedIntegrationId)
    : integrations[0];

  if (!activeIntegrationMeta) {
    return NextResponse.json({
      configured: true,
      integrations,
      error: "Không tìm thấy cấu hình tích hợp được chọn",
    });
  }

  // Retrieve the full record (including the token) to decrypt and query APIs
  const activeIntegration = await db.gitIntegration.findUnique({
    where: { id: activeIntegrationMeta.id },
  });

  if (!activeIntegration) {
    return NextResponse.json({
      configured: true,
      integrations,
      error: "Không thể tải dữ liệu tích hợp",
    });
  }

  const maskToken = (token: string | null) => {
    if (!token) return "";
    const rawToken = decrypt(token); // Decrypt to check actual length
    return rawToken.length > 8 ? `${rawToken.substring(0, 4)}...${rawToken.substring(rawToken.length - 4)}` : "****";
  };

  const responseData: any = {
    configured: true,
    integrations: integrations.map((i) => ({
      ...i,
      webhookSecret: i.webhookSecret ? "****" : null,
    })),
    // Fields for the active integration to maintain compatibility with single-repo UI
    activeIntegrationId: activeIntegration.id,
    repoProvider: activeIntegration.provider,
    repoOwner: activeIntegration.owner,
    repoName: activeIntegration.name,
    repoApiUrl: activeIntegration.apiUrl,
    repoWebhookSecret: activeIntegration.webhookSecret ? "****" : null,
    repoTokenMasked: maskToken(activeIntegration.token),
    repoInfo: null,
    commits: [],
    pullRequests: [],
    error: null,
  };

  // Fetch real-time data from GitHub / GitLab for the active repository
  try {
    const token = decrypt(activeIntegration.token); // AES DECRYPTION
    const provider = activeIntegration.provider;
    const owner = activeIntegration.owner;
    const name = activeIntegration.name;

    if (provider === "github") {
      const headers = {
        Accept: "application/vnd.github.v3+json",
        ...(token ? { Authorization: `token ${token}` } : {}),
      };

      // 1. Repo info
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${name}`, { headers });
      if (!repoRes.ok) throw new Error(`GitHub API returned status ${repoRes.status}`);
      const repoData = await repoRes.json();
      responseData.repoInfo = {
        description: repoData.description,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        language: repoData.language,
        openIssues: repoData.open_issues_count,
        htmlUrl: repoData.html_url,
      };

      // 2. Commits (last 10)
      const commitsRes = await fetch(`https://api.github.com/repos/${owner}/${name}/commits?per_page=10`, { headers });
      if (commitsRes.ok) {
        const commitsData = await commitsRes.json();
        responseData.commits = Array.isArray(commitsData)
          ? commitsData.map((c: any) => ({
              sha: c.sha,
              message: c.commit.message,
              author: c.commit.author.name,
              avatar: c.author?.avatar_url || null,
              date: c.commit.author.date,
              url: c.html_url,
            }))
          : [];
      }

      // 3. Pull Requests (last 10 open with commit check statuses)
      const prsRes = await fetch(`https://api.github.com/repos/${owner}/${name}/pulls?state=open&per_page=10`, { headers });
      if (prsRes.ok) {
        const prsData = await prsRes.json();
        
        if (Array.isArray(prsData)) {
          const prsWithStatus = await Promise.all(
            prsData.map(async (pr: any) => {
              let ciStatus = "unknown";
              try {
                // Fetch GitHub Checks / Statuses for the PR head commit
                const statusRes = await fetch(
                  `https://api.github.com/repos/${owner}/${name}/commits/${pr.head.sha}/status`,
                  { headers }
                );
                if (statusRes.ok) {
                  const statusData = await statusRes.json();
                  // combined state: success, failure, pending, or none
                  if (statusData.state) {
                    ciStatus = statusData.state;
                  }
                }
              } catch (e) {
                console.error("Failed to fetch checks status for PR commit:", e);
              }

              return {
                id: pr.id,
                number: pr.number,
                title: pr.title,
                state: pr.state,
                author: pr.user?.login,
                avatar: pr.user?.avatar_url,
                createdAt: pr.created_at,
                url: pr.html_url,
                ciStatus, // success | failure | pending | unknown
              };
            })
          );
          responseData.pullRequests = prsWithStatus;
        }
      }
    } else if (provider === "gitlab") {
      const apiBase = activeIntegration.apiUrl || "https://gitlab.com";
      const projectPath = encodeURIComponent(`${owner}/${name}`);
      const headers = {
        ...(token ? { "PRIVATE-TOKEN": token } : {}),
      };

      // 1. Repo info
      const repoRes = await fetch(`${apiBase}/api/v4/projects/${projectPath}`, { headers });
      if (!repoRes.ok) throw new Error(`GitLab API returned status ${repoRes.status}`);
      const repoData = await repoRes.json();
      responseData.repoInfo = {
        description: repoData.description,
        stars: repoData.star_count,
        forks: repoData.forks_count,
        language: null,
        openIssues: repoData.open_issues_count,
        htmlUrl: repoData.web_url,
      };

      // 2. Commits (last 10)
      const commitsRes = await fetch(`${apiBase}/api/v4/projects/${projectPath}/repository/commits?per_page=10`, { headers });
      if (commitsRes.ok) {
        const commitsData = await commitsRes.json();
        responseData.commits = Array.isArray(commitsData)
          ? commitsData.map((c: any) => ({
              sha: c.id,
              message: c.title,
              author: c.author_name,
              avatar: null,
              date: c.created_at,
              url: `${repoData.web_url}/-/commit/${c.id}`,
            }))
          : [];
      }

      // 3. Merge Requests (last 10 open with pipeline status)
      const mrsRes = await fetch(
        `${apiBase}/api/v4/projects/${projectPath}/merge_requests?state=opened&per_page=10`,
        { headers }
      );
      if (mrsRes.ok) {
        const mrsData = await mrsRes.json();
        responseData.pullRequests = Array.isArray(mrsData)
          ? mrsData.map((mr: any) => {
              // GitLab includes basic pipeline details inside the Merge Request endpoint
              let ciStatus = "unknown";
              if (mr.head_pipeline && mr.head_pipeline.status) {
                // pipeline status mapping: success, failed, running, pending, skipped, canceled
                const gitlabStatus = mr.head_pipeline.status;
                if (gitlabStatus === "success") ciStatus = "success";
                else if (gitlabStatus === "failed") ciStatus = "failure";
                else if (gitlabStatus === "running" || gitlabStatus === "pending") ciStatus = "pending";
              }

              return {
                id: mr.id,
                number: mr.iid,
                title: mr.title,
                state: mr.state,
                author: mr.author?.username,
                avatar: mr.author?.avatar_url,
                createdAt: mr.created_at,
                url: mr.web_url,
                ciStatus,
              };
            })
          : [];
      }
    }
  } catch (err: any) {
    console.error("Failed to fetch repository details:", err);
    responseData.error = err.message || "Không thể kết nối đến nhà cung cấp dịch vụ Git";
  }

  return NextResponse.json(responseData);
}

export async function POST(req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id: projectId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = integrationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu cấu hình không hợp lệ" },
      { status: 400 }
    );
  }

  const { repoProvider, repoOwner, repoName, repoToken, repoApiUrl, repoWebhookSecret } = parsed.data;

  // Verify the project exists in current workspace
  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
  });
  if (!project) {
    return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
  }

  // Encrypt token before saving (AES-256)
  const tokenEncrypted = encrypt(repoToken);

  // Save new GitIntegration record (supports multi-repo)
  const integration = await db.gitIntegration.upsert({
    where: {
      projectId_provider_owner_name: {
        projectId,
        provider: repoProvider,
        owner: repoOwner,
        name: repoName,
      },
    },
    update: {
      token: tokenEncrypted,
      apiUrl: repoApiUrl || null,
      webhookSecret: repoWebhookSecret || null,
    },
    create: {
      projectId,
      provider: repoProvider,
      owner: repoOwner,
      name: repoName,
      token: tokenEncrypted,
      apiUrl: repoApiUrl || null,
      webhookSecret: repoWebhookSecret || null,
    },
  });

  // Backward compatibility: update project directly too (helps transition)
  await db.project.update({
    where: { id: projectId },
    data: {
      repoProvider,
      repoOwner,
      repoName,
      repoToken: tokenEncrypted,
      repoApiUrl: repoApiUrl || null,
      repoWebhookSecret: repoWebhookSecret || null,
    },
  });

  return NextResponse.json({
    ok: true,
    projectId,
    integrationId: integration.id,
    repoProvider: integration.provider,
  });
}

export async function DELETE(req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id: projectId } = await params;
  const { searchParams } = new URL(req.url);
  const integrationId = searchParams.get("integrationId");

  if (!integrationId) {
    // Legacy fall back: delete all integrations for this project
    await db.gitIntegration.deleteMany({
      where: { projectId },
    });
    
    // Clear project legacy fields
    await db.project.update({
      where: { id: projectId },
      data: {
        repoProvider: null,
        repoOwner: null,
        repoName: null,
        repoToken: null,
        repoApiUrl: null,
        repoWebhookSecret: null,
      },
    });

    return NextResponse.json({ ok: true });
  }

  // Delete the specific integration
  const exists = await db.gitIntegration.findFirst({
    where: { id: integrationId, projectId },
  });

  if (!exists) {
    return NextResponse.json({ error: "Không tìm thấy cấu hình tích hợp cần xóa" }, { status: 404 });
  }

  await db.gitIntegration.delete({
    where: { id: integrationId },
  });

  // If this was the last integration, clear project legacy fields
  const count = await db.gitIntegration.count({
    where: { projectId },
  });
  if (count === 0) {
    await db.project.update({
      where: { id: projectId },
      data: {
        repoProvider: null,
        repoOwner: null,
        repoName: null,
        repoToken: null,
        repoApiUrl: null,
        repoWebhookSecret: null,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
