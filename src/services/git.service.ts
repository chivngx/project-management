import crypto from "crypto";
import { GitIntegrationRepository } from "@/repositories/git-integration.repository";
import { ProjectRepository } from "@/repositories/project.repository";
import { TaskRepository } from "@/repositories/task.repository";
import { ActivityRepository } from "@/repositories/activity.repository";
import { encrypt, decrypt } from "@/lib/encryption";

export const GitService = {
  async getIntegrationMeta(projectId: string, workspaceId: string, selectedIntegrationId: string | null) {
    const integrations = await GitIntegrationRepository.findByProjectId(projectId);

    if (integrations.length === 0) {
      return { configured: false, integrations: [] };
    }

    const activeIntegrationMeta = selectedIntegrationId
      ? integrations.find((i) => i.id === selectedIntegrationId)
      : integrations[0];

    if (!activeIntegrationMeta) {
      return {
        configured: true,
        integrations,
        error: "Không tìm thấy cấu hình tích hợp được chọn",
      };
    }

    const activeIntegration = await GitIntegrationRepository.findById(activeIntegrationMeta.id);

    if (!activeIntegration) {
      return {
        configured: true,
        integrations,
        error: "Không thể tải dữ liệu tích hợp",
      };
    }

    const maskToken = (token: string | null) => {
      if (!token) return "";
      const rawToken = decrypt(token);
      return rawToken.length > 8 ? `${rawToken.substring(0, 4)}...${rawToken.substring(rawToken.length - 4)}` : "****";
    };

    const responseData: any = {
      configured: true,
      integrations: integrations.map((i) => ({
        ...i,
        webhookSecret: i.webhookSecret ? "****" : null,
      })),
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

    // Fetch real-time data from external APIs
    try {
      const token = decrypt(activeIntegration.token);
      const provider = activeIntegration.provider;
      const owner = activeIntegration.owner;
      const name = activeIntegration.name;

      if (provider === "github") {
        const headers = {
          Accept: "application/vnd.github.v3+json",
          ...(token ? { Authorization: `token ${token}` } : {}),
        };

        // 1. Repo Info
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

        // 2. Commits
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

        // 3. Pull Requests
        const prsRes = await fetch(`https://api.github.com/repos/${owner}/${name}/pulls?state=open&per_page=10`, { headers });
        if (prsRes.ok) {
          const prsData = await prsRes.json();
          if (Array.isArray(prsData)) {
            responseData.pullRequests = await Promise.all(
              prsData.map(async (pr: any) => {
                let ciStatus = "unknown";
                try {
                  const statusRes = await fetch(
                    `https://api.github.com/repos/${owner}/${name}/commits/${pr.head.sha}/status`,
                    { headers }
                  );
                  if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    if (statusData.state) ciStatus = statusData.state;
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
                  ciStatus,
                };
              })
            );
          }
        }
      } else if (provider === "gitlab") {
        const apiBase = activeIntegration.apiUrl || "https://gitlab.com";
        const projectPath = encodeURIComponent(`${owner}/${name}`);
        const headers = {
          ...(token ? { "PRIVATE-TOKEN": token } : {}),
        };

        // 1. Repo Info
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

        // 2. Commits
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

        // 3. Merge Requests
        const mrsRes = await fetch(`${apiBase}/api/v4/projects/${projectPath}/merge_requests?state=opened&per_page=10`, { headers });
        if (mrsRes.ok) {
          const mrsData = await mrsRes.json();
          responseData.pullRequests = Array.isArray(mrsData)
            ? mrsData.map((mr: any) => {
                let ciStatus = "unknown";
                if (mr.head_pipeline && mr.head_pipeline.status) {
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

    return responseData;
  },

  async createIntegration(
    projectId: string,
    workspaceId: string,
    data: {
      repoProvider: "github" | "gitlab";
      repoOwner: string;
      repoName: string;
      repoToken: string;
      repoApiUrl?: string | null;
      repoWebhookSecret?: string | null;
    }
  ) {
    const project = await ProjectRepository.findById(projectId);
    if (!project || project.workspaceId !== workspaceId) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    const tokenEncrypted = encrypt(data.repoToken);

    // Save/update GitIntegration record
    const existingIntegration = await GitIntegrationRepository.findByComposite(
      projectId,
      data.repoProvider,
      data.repoOwner,
      data.repoName
    );

    let integrationId = existingIntegration?.id;

    if (existingIntegration) {
      await GitIntegrationRepository.update(existingIntegration.id, {
        token: tokenEncrypted,
        apiUrl: data.repoApiUrl || null,
        webhookSecret: data.repoWebhookSecret || null,
      });
    } else {
      const newIntegrationId = crypto.randomUUID();
      await GitIntegrationRepository.create({
        id: newIntegrationId,
        projectId,
        provider: data.repoProvider,
        owner: data.repoOwner,
        name: data.repoName,
        token: tokenEncrypted,
        apiUrl: data.repoApiUrl || null,
        webhookSecret: data.repoWebhookSecret || null,
      });
      integrationId = newIntegrationId;
    }

    // Legacy compatibility: update project directly too
    await ProjectRepository.update(projectId, {
      repoProvider: data.repoProvider,
      repoOwner: data.repoOwner,
      repoName: data.repoName,
      repoToken: tokenEncrypted,
      repoApiUrl: data.repoApiUrl || null,
      repoWebhookSecret: data.repoWebhookSecret || null,
    });

    return { integrationId, repoProvider: data.repoProvider };
  },

  async deleteIntegration(projectId: string, workspaceId: string, integrationId: string | null) {
    const project = await ProjectRepository.findById(projectId);
    if (!project || project.workspaceId !== workspaceId) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    if (!integrationId) {
      // Legacy fallback: delete all integrations for this project
      await GitIntegrationRepository.deleteByProjectId(projectId);
      await ProjectRepository.update(projectId, {
        repoProvider: null,
        repoOwner: null,
        repoName: null,
        repoToken: null,
        repoApiUrl: null,
        repoWebhookSecret: null,
      });
      return true;
    }

    const exists = await GitIntegrationRepository.findById(integrationId);
    if (!exists || exists.projectId !== projectId) {
      throw new Error("INTEGRATION_NOT_FOUND");
    }

    await GitIntegrationRepository.delete(integrationId);

    // If this was the last integration, clear project legacy fields
    const count = await GitIntegrationRepository.countByProjectId(projectId);
    if (count === 0) {
      await ProjectRepository.update(projectId, {
        repoProvider: null,
        repoOwner: null,
        repoName: null,
        repoToken: null,
        repoApiUrl: null,
        repoWebhookSecret: null,
      });
    }

    return true;
  },

  async getUnlinkedIssues(projectId: string, workspaceId: string, integrationId: string | null) {
    const project = await ProjectRepository.findById(projectId);
    if (!project || project.workspaceId !== workspaceId) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    let integration: any = null;
    if (integrationId) {
      integration = await GitIntegrationRepository.findById(integrationId);
    } else {
      const list = await GitIntegrationRepository.findByProjectId(projectId);
      integration = list[0] || null;
    }

    if (!integration) {
      throw new Error("INTEGRATION_NOT_FOUND");
    }

    const token = decrypt(integration.token);
    const provider = integration.provider;
    const owner = integration.owner;
    const name = integration.name;

    // Get existing linked tasks
    const existing = await TaskRepository.findFirstByExternalDetails(projectId, provider, 0); // placeholder, let's load all tasks for the project instead
    const tasks = await TaskRepository.findByProjectId(projectId);
    const linkedNumbers = new Set(
      tasks.filter((t) => t.gitIntegrationId === integration.id && t.externalNumber).map((t) => t.externalNumber)
    );

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

    const unlinkedIssues = externalIssues.filter((issue) => !linkedNumbers.has(issue.number));
    return { unlinkedIssues, integrationId: integration.id };
  },

  async syncIssues(
    projectId: string,
    workspaceId: string,
    callerUserId: string,
    integrationId: string | null,
    issuesToImport: any[]
  ) {
    const project = await ProjectRepository.findById(projectId);
    if (!project || project.workspaceId !== workspaceId) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    let integration: any = null;
    if (integrationId) {
      integration = await GitIntegrationRepository.findById(integrationId);
    } else {
      const list = await GitIntegrationRepository.findByProjectId(projectId);
      integration = list[0] || null;
    }

    if (!integration) {
      throw new Error("INTEGRATION_NOT_FOUND");
    }

    const provider = integration.provider;
    const token = decrypt(integration.token);
    const owner = integration.owner;
    const name = integration.name;

    let importedCount = 0;
    let updatedCount = 0;

    // Phase 1: Import selected issues
    if (issuesToImport && issuesToImport.length > 0) {
      for (const issue of issuesToImport) {
        const exists = await TaskRepository.findFirstByExternalDetails(projectId, provider, issue.number);
        if (!exists) {
          await TaskRepository.create({
            id: crypto.randomUUID(),
            projectId,
            title: issue.title,
            description: issue.description || "",
            status: "TODO",
            priority: "MEDIUM",
            creatorId: callerUserId,
            externalId: issue.id,
            externalNumber: issue.number,
            externalUrl: issue.url,
            externalProvider: provider,
            gitIntegrationId: integration.id,
          });
          importedCount++;
        }
      }
    }

    // Phase 2: Status Synchronization for existing linked tasks
    const tasks = await TaskRepository.findByProjectId(projectId);
    const linkedTasks = tasks.filter((t) => t.gitIntegrationId === integration.id && t.externalNumber);

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
                  if (targetStatus !== task.status) {
                    await TaskRepository.update(task.id, { status: targetStatus });
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
                  if (targetStatus !== task.status) {
                    await TaskRepository.update(task.id, { status: targetStatus });
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
      await ActivityRepository.create({
        id: crypto.randomUUID(),
        workspaceId,
        userId: callerUserId,
        action: "updated_project",
        entityType: "PROJECT",
        entityId: projectId,
        message: `Đồng bộ Git: Nhập ${importedCount} tasks mới, cập nhật trạng thái của ${updatedCount} tasks.`,
      });
    }

    return { importedCount, updatedCount };
  },

  async handleGitLabWebhook(projectId: string, event: string, secretToken: string, payload: any) {
    if (!payload) return true;
    const list = await GitIntegrationRepository.findByProjectId(projectId);
    const integration = list.find((i) => i.provider === "gitlab");
    if (!integration) throw new Error("INTEGRATION_NOT_FOUND");

    if (integration.webhookSecret && secretToken !== integration.webhookSecret) {
      throw new Error("UNAUTHORIZED");
    }

    const { object_kind: kind } = payload;

    if (kind === "issue") {
      const issue = payload.object_attributes;
      if (!issue) return true;
      const issueNumber = issue.iid;
      const title = issue.title;
      const state = issue.state;
      const externalId = String(issue.id);
      const url = issue.url;

      // Status mapping: opened/reopened -> TODO/IN_PROGRESS, closed -> DONE
      const targetStatus = state === "closed" ? "DONE" : "TODO";

      const task = await TaskRepository.findFirstByExternalDetails(projectId, "gitlab", issueNumber);

      if (task) {
        if (task.status !== targetStatus || task.title !== title) {
          await TaskRepository.update(task.id, { status: targetStatus, title });
          await ActivityRepository.create({
            id: crypto.randomUUID(),
            workspaceId: payload.project?.namespace_id || "", // workspace placeholder
            action: "updated_task",
            entityType: "TASK",
            entityId: task.id,
            message: `GitLab Sync: Tác vụ "${title}" đã được cập nhật trạng thái thành ${targetStatus}`,
          });
        }
      } else {
        // Create new task
        const project = await ProjectRepository.findById(projectId);
        const creator = await ProjectRepository.findMembership(projectId, ""); // fetch project admin or owner
        const creatorId = creator?.id || project?.workspace?.ownerId || "system"; // fallback

        const newTask = await TaskRepository.create({
          id: crypto.randomUUID(),
          projectId,
          title,
          description: issue.description || "",
          status: targetStatus,
          priority: "MEDIUM",
          creatorId,
          externalId,
          externalNumber: issueNumber,
          externalUrl: url,
          externalProvider: "gitlab",
          gitIntegrationId: integration.id,
        });

        await ActivityRepository.create({
          id: crypto.randomUUID(),
          workspaceId: project?.workspaceId || "",
          action: "created_task",
          entityType: "TASK",
          entityId: newTask.id,
          message: `GitLab Sync: Tác vụ mới "${title}" đã được tạo từ issue #${issueNumber}`,
        });
      }
    } else if (kind === "merge_request") {
      const mr = payload.object_attributes;
      if (!mr) return true;
      const mrState = mr.state; // opened, closed, merged, locked
      const description = mr.description || "";
      const closesPattern = /(?:closes|fixes|resolves)\s+#(\d+)/gi;
      const matches = [...description.matchAll(closesPattern)];

      if (matches.length > 0 && (mrState === "merged" || mrState === "closed")) {
        for (const match of matches) {
          const issueNumber = parseInt(match[1]);
          const task = await TaskRepository.findFirstByExternalDetails(projectId, "gitlab", issueNumber);
          if (task && task.status !== "DONE") {
            await TaskRepository.update(task.id, { status: "DONE" });
            const project = await ProjectRepository.findById(projectId);
            await ActivityRepository.create({
              id: crypto.randomUUID(),
              workspaceId: project?.workspaceId || "",
              action: "completed_task",
              entityType: "TASK",
              entityId: task.id,
              message: `GitLab Sync: Tác vụ "${task.title}" tự động hoàn thành do Merge Request đã ${mrState}`,
            });
          }
        }
      }
    }

    return true;
  },

  async handleGitHubWebhook(projectId: string, event: string, signature: string, bodyText: string) {
    const list = await GitIntegrationRepository.findByProjectId(projectId);
    const integration = list.find((i) => i.provider === "github");
    if (!integration) throw new Error("INTEGRATION_NOT_FOUND");

    if (integration.webhookSecret) {
      // Validate signature
      const crypto = require("crypto");
      const hmac = crypto.createHmac("sha256", integration.webhookSecret);
      const digest = "sha256=" + hmac.update(bodyText).digest("hex");
      if (signature !== digest) {
        throw new Error("UNAUTHORIZED");
      }
    }

    const payload = JSON.parse(bodyText);

    if (event === "issues") {
      const action = payload.action;
      const issue = payload.issue;
      if (!issue) return true;
      const issueNumber = issue.number;
      const title = issue.title;
      const state = issue.state;
      const externalId = String(issue.id);
      const url = issue.html_url;

      const targetStatus = state === "closed" ? "DONE" : "TODO";

      const task = await TaskRepository.findFirstByExternalDetails(projectId, "github", issueNumber);

      if (task) {
        if (task.status !== targetStatus || task.title !== title) {
          await TaskRepository.update(task.id, { status: targetStatus, title });
          const project = await ProjectRepository.findById(projectId);
          await ActivityRepository.create({
            id: crypto.randomUUID(),
            workspaceId: project?.workspaceId || "",
            action: "updated_task",
            entityType: "TASK",
            entityId: task.id,
            message: `GitHub Sync: Tác vụ "${title}" đã được cập nhật trạng thái thành ${targetStatus}`,
          });
        }
      } else if (action === "opened") {
        const project = await ProjectRepository.findById(projectId);
        const creatorId = project?.workspace?.ownerId || "system";

        const newTask = await TaskRepository.create({
          id: crypto.randomUUID(),
          projectId,
          title,
          description: issue.body || "",
          status: targetStatus,
          priority: "MEDIUM",
          creatorId,
          externalId,
          externalNumber: issueNumber,
          externalUrl: url,
          externalProvider: "github",
          gitIntegrationId: integration.id,
        });

        await ActivityRepository.create({
          id: crypto.randomUUID(),
          workspaceId: project?.workspaceId || "",
          action: "created_task",
          entityType: "TASK",
          entityId: newTask.id,
          message: `GitHub Sync: Tác vụ mới "${title}" đã được tạo từ issue #${issueNumber}`,
        });
      }
    } else if (event === "pull_request") {
      const action = payload.action;
      const pr = payload.pull_request;
      if (!pr) return true;
      const merged = pr.merged;

      if (action === "closed" && merged) {
        const body = pr.body || "";
        const closesPattern = /(?:closes|fixes|resolves)\s+#(\d+)/gi;
        const matches = [...body.matchAll(closesPattern)];

        if (matches.length > 0) {
          for (const match of matches) {
            const issueNumber = parseInt(match[1]);
            const task = await TaskRepository.findFirstByExternalDetails(projectId, "github", issueNumber);
            if (task && task.status !== "DONE") {
              await TaskRepository.update(task.id, { status: "DONE" });
              const project = await ProjectRepository.findById(projectId);
              await ActivityRepository.create({
                id: crypto.randomUUID(),
                workspaceId: project?.workspaceId || "",
                action: "completed_task",
                entityType: "TASK",
                entityId: task.id,
                message: `GitHub Sync: Tác vụ "${task.title}" tự động hoàn thành do Pull Request được merged`,
              });
            }
          }
        }
      }
    }

    return true;
  },

  async createGitBranch(
    taskId: string,
    workspaceId: string,
    callerUser: { id: string; name?: string | null }
  ) {
    const task = await TaskRepository.findByIdWithDetails(taskId);
    if (!task || task.project?.workspaceId !== workspaceId) {
      throw new Error("TASK_NOT_FOUND");
    }

    let integration = task.gitIntegration;
    if (!integration) {
      const list = await GitIntegrationRepository.findByProjectId(task.projectId);
      if (list.length > 0) {
        integration = list[0];
      }
    }

    if (!integration) {
      throw new Error("NO_GIT_INTEGRATION");
    }

    const cleanBranchName = (title: string): string => {
      return title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 40); // limit title length in branch name
    };

    const token = decrypt(integration.token);
    const provider = integration.provider;
    const owner = integration.owner;
    const name = integration.name;
    
    // Generate clean branch name
    const suffix = task.externalNumber ? String(task.externalNumber) : task.id.substring(0, 6);
    const cleanTitle = cleanBranchName(task.title);
    const branchName = `feature/PF-${suffix}-${cleanTitle}`;

    if (provider === "github") {
      const headers = {
        Accept: "application/vnd.github.v3+json",
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
      };

      // 1. Get default branch name
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${name}`, { headers });
      if (!repoRes.ok) throw new Error("Không thể lấy thông tin repository từ GitHub");
      const repoData = await repoRes.json();
      const defaultBranch = repoData.default_branch || "main";

      // 2. Get default branch ref SHA
      const refRes = await fetch(`https://api.github.com/repos/${owner}/${name}/git/ref/heads/${defaultBranch}`, { headers });
      if (!refRes.ok) throw new Error(`Không thể lấy SHA của nhánh mặc định: ${defaultBranch}`);
      const refData = await refRes.json();
      const sha = refData.object?.sha;

      if (!sha) throw new Error("Không lấy được commit SHA của nhánh mặc định");

      // 3. Create the new ref
      const createRefRes = await fetch(`https://api.github.com/repos/${owner}/${name}/git/refs`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha,
        }),
      });

      if (!createRefRes.ok) {
        const errData = await createRefRes.json();
        // If branch already exists, we shouldn't throw error, just tell client
        if (createRefRes.status === 422 && errData.message?.includes("already exists")) {
          return { ok: true, branchName, alreadyExists: true };
        }
        throw new Error(errData.message || "Không thể tạo nhánh trên GitHub");
      }
    } else if (provider === "gitlab") {
      const apiBase = integration.apiUrl || "https://gitlab.com";
      const projectPath = encodeURIComponent(`${owner}/${name}`);
      const headers = {
        "PRIVATE-TOKEN": token,
        "Content-Type": "application/json",
      };

      // 1. Get project info (for default branch)
      const projectRes = await fetch(`${apiBase}/api/v4/projects/${projectPath}`, { headers });
      if (!projectRes.ok) throw new Error("Không thể lấy thông tin dự án từ GitLab");
      const projectData = await projectRes.json();
      const defaultBranch = projectData.default_branch || "main";

      // 2. Create branch
      const createBranchRes = await fetch(`${apiBase}/api/v4/projects/${projectPath}/repository/branches`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          branch: branchName,
          ref: defaultBranch,
        }),
      });

      if (!createBranchRes.ok) {
        const errData = await createBranchRes.json();
        if (createBranchRes.status === 400 && errData.message?.includes("already exists")) {
          return { ok: true, branchName, alreadyExists: true };
        }
        throw new Error(errData.message || "Không thể tạo nhánh trên GitLab");
      }
    }

    // Log Activity
    await ActivityRepository.create({
      id: crypto.randomUUID(),
      workspaceId,
      userId: callerUser.id,
      action: "updated_project",
      entityType: "TASK",
      entityId: task.id,
      message: `${callerUser.name || "Someone"} đã tạo nhánh Git '${branchName}' cho tác vụ "${task.title}"`,
    });

    return { ok: true, branchName };
  },

  async fetchUserRepositories(
    provider: "github" | "gitlab",
    token: string,
    apiUrl?: string | null
  ) {
    if (provider === "github") {
      const headers = {
        Accept: "application/vnd.github.v3+json",
        Authorization: `token ${token}`,
      };

      const res = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", { headers });
      if (!res.ok) {
        throw new Error(`GitHub API returned status ${res.status}. Vui lòng kiểm tra lại Token.`);
      }

      const repos = await res.json();
      if (!Array.isArray(repos)) return [];

      return repos.map((r: any) => ({
        id: String(r.id),
        name: r.name,
        owner: r.owner?.login,
        fullName: r.full_name,
        description: r.description || "",
        url: r.html_url,
      }));
    } else if (provider === "gitlab") {
      const apiBase = apiUrl || "https://gitlab.com";
      const headers = {
        "PRIVATE-TOKEN": token,
      };

      const res = await fetch(`${apiBase}/api/v4/projects?membership=true&simple=true&per_page=100&order_by=last_activity_at`, { headers });
      if (!res.ok) {
        throw new Error(`GitLab API returned status ${res.status}. Vui lòng kiểm tra lại Token.`);
      }

      const projects = await res.json();
      if (!Array.isArray(projects)) return [];

      return projects.map((p: any) => ({
        id: String(p.id),
        name: p.path,
        owner: p.namespace?.path,
        fullName: p.path_with_namespace,
        description: p.description || "",
        url: p.web_url,
      }));
    }

    return [];
  },
};
