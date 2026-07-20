import { NextResponse } from "next/server";

type Params = { params: Promise<{ provider: string }> };

export async function GET(req: Request, { params }: Params) {
  const { provider } = await params;
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const protocol = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("host") || "localhost:3000";
  const redirectUri = `${protocol}://${host}/api/auth/oauth/${provider}/callback`;

  // Parse state to extract projectId
  let projectId = "";
  let apiBase = "https://gitlab.com";

  if (state) {
    if (provider === "gitlab") {
      const parts = state.split(":");
      projectId = parts[0];
      if (parts[1]) {
        apiBase = decodeURIComponent(parts[1]);
      }
    } else {
      projectId = state;
    }
  }

  if (!projectId) {
    return NextResponse.json({ error: "Missing state (projectId)" }, { status: 400 });
  }

  // If OAuth failed
  if (error) {
    return NextResponse.redirect(
      `${protocol}://${host}/projects/${projectId}?tab=integration&error=${encodeURIComponent(
        errorDescription || error
      )}`
    );
  }

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  try {
    let accessToken = "";

    if (provider === "github") {
      const clientId = process.env.GITHUB_INTEGRATION_CLIENT_ID || process.env.GITHUB_CLIENT_ID;
      const clientSecret = process.env.GITHUB_INTEGRATION_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error("Missing GitHub Integration Client ID or Client Secret in environment");
      }

      const res = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!res.ok) {
        throw new Error(`GitHub token exchange returned status ${res.status}`);
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error_description || data.error);
      }

      accessToken = data.access_token;
    } else if (provider === "gitlab") {
      const clientId = process.env.GITLAB_CLIENT_ID;
      const clientSecret = process.env.GITLAB_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error("Missing GitLab Client ID or Client Secret in environment");
      }

      const res = await fetch(`${apiBase}/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });

      if (!res.ok) {
        throw new Error(`GitLab token exchange returned status ${res.status}`);
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error_description || data.error);
      }

      accessToken = data.access_token;
    }

    if (!accessToken) {
      throw new Error("Failed to retrieve access token");
    }

    // Redirect user back to ProjectFlow Integration tab with the temporary token
    // The frontend will read it, call loadRepos, and wipe the URL query parameters.
    const redirectUrl = `${protocol}://${host}/projects/${projectId}?tab=integration&gitToken=${encodeURIComponent(
      accessToken
    )}&gitProvider=${provider}&gitApiUrl=${encodeURIComponent(apiBase)}`;

    return NextResponse.redirect(redirectUrl);
  } catch (err: any) {
    console.error("OAuth Exchange Error:", err);
    return NextResponse.redirect(
      `${protocol}://${host}/projects/${projectId}?tab=integration&error=${encodeURIComponent(
        err.message || "Xác thực OAuth thất bại"
      )}`
    );
  }
}
