import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";

type Params = { params: Promise<{ provider: string }> };

export async function GET(req: Request, { params }: Params) {
  const { user } = await getApiContext();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { provider } = await params;
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const customApiUrl = searchParams.get("apiUrl"); // For self-hosted GitLab

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const protocol = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("host") || "localhost:3000";
  const redirectUri = `${protocol}://${host}/api/auth/oauth/${provider}/callback`;

  if (provider === "github") {
    const clientId = process.env.GITHUB_INTEGRATION_CLIENT_ID || process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: "GITHUB_INTEGRATION_CLIENT_ID hoặc GITHUB_CLIENT_ID chưa được cấu hình trong file .env" },
        { status: 400 }
      );
    }

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=repo,workflow&state=${projectId}`;

    return NextResponse.redirect(githubAuthUrl);
  } else if (provider === "gitlab") {
    const clientId = process.env.GITLAB_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: "GITLAB_CLIENT_ID chưa được cấu hình trong file .env" },
        { status: 400 }
      );
    }

    const apiBase = customApiUrl || "https://gitlab.com";
    // State stores both projectId and apiBase url (separated by :)
    const state = `${projectId}:${encodeURIComponent(apiBase)}`;
    
    const gitlabAuthUrl = `${apiBase}/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&state=${state}&scope=api`;

    return NextResponse.redirect(gitlabAuthUrl);
  }

  return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
}
