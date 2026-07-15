import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getApiContext } from "@/lib/api-context";
import { decrypt } from "@/lib/encryption";

type Params = { params: Promise<{ id: string }> };

function cleanBranchName(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 40); // limit title length in branch name
}

export async function POST(req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id } = await params;
  const task = await db.task.findFirst({
    where: { id, project: { workspaceId: workspace.id } },
    include: { gitIntegration: true },
  });

  if (!task) {
    return NextResponse.json({ error: "Không tìm thấy tác vụ" }, { status: 404 });
  }

  const integration = task.gitIntegration;
  if (!integration) {
    return NextResponse.json({ error: "Tác vụ này chưa được liên kết với Repository Git nào" }, { status: 400 });
  }

  try {
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
          return NextResponse.json({ ok: true, branchName, alreadyExists: true });
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
          return NextResponse.json({ ok: true, branchName, alreadyExists: true });
        }
        throw new Error(errData.message || "Không thể tạo nhánh trên GitLab");
      }
    }

    // Log Activity
    await db.activity.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        action: "updated_project",
        entityType: "TASK",
        entityId: task.id,
        message: `${user.name || "Someone"} đã tạo nhánh Git '${branchName}' cho tác vụ "${task.title}"`,
      },
    });

    return NextResponse.json({ ok: true, branchName });
  } catch (err: any) {
    console.error("Error creating branch:", err);
    return NextResponse.json({ error: err.message || "Không thể tạo nhánh Git" }, { status: 500 });
  }
}
