import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiContext } from "@/lib/api-context";

type Params = { params: Promise<{ id: string }> };

const reposSchema = z.object({
  repoProvider: z.enum(["github", "gitlab"]),
  repoToken: z.string().min(1, "Personal Access Token không được để trống"),
  repoApiUrl: z.string().url("Đường dẫn API URL không hợp lệ").optional().nullable().or(z.literal("")),
});

export async function POST(req: Request, { params }: Params) {
  const { user, workspace } = await getApiContext();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const parsed = reposSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 }
    );
  }

  const { repoProvider, repoToken, repoApiUrl } = parsed.data;

  try {
    if (repoProvider === "github") {
      const headers = {
        Accept: "application/vnd.github.v3+json",
        Authorization: `token ${repoToken}`,
      };

      const res = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", { headers });
      if (!res.ok) {
        throw new Error(`GitHub API returned status ${res.status}. Vui lòng kiểm tra lại Token.`);
      }

      const repos = await res.json();
      if (!Array.isArray(repos)) {
        return NextResponse.json({ repos: [] });
      }

      const formattedRepos = repos.map((r: any) => ({
        id: String(r.id),
        name: r.name,
        owner: r.owner?.login,
        fullName: r.full_name,
        description: r.description || "",
        url: r.html_url,
      }));

      return NextResponse.json({ repos: formattedRepos });
    } else if (repoProvider === "gitlab") {
      const apiBase = repoApiUrl || "https://gitlab.com";
      const headers = {
        "PRIVATE-TOKEN": repoToken,
      };

      const res = await fetch(`${apiBase}/api/v4/projects?membership=true&simple=true&per_page=100&order_by=last_activity_at`, { headers });
      if (!res.ok) {
        throw new Error(`GitLab API returned status ${res.status}. Vui lòng kiểm tra lại Token.`);
      }

      const projects = await res.json();
      if (!Array.isArray(projects)) {
        return NextResponse.json({ repos: [] });
      }

      const formattedRepos = projects.map((p: any) => ({
        id: String(p.id),
        name: p.path,
        owner: p.namespace?.path,
        fullName: p.path_with_namespace,
        description: p.description || "",
        url: p.web_url,
      }));

      return NextResponse.json({ repos: formattedRepos });
    }
  } catch (err: any) {
    console.error("Error in fetching repos:", err);
    return NextResponse.json({ error: err.message || "Không thể tải danh sách repository" }, { status: 500 });
  }

  return NextResponse.json({ repos: [] });
}
