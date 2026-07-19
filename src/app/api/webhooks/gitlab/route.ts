import { NextResponse } from "next/server";
import { GitService } from "@/services/git.service";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const token = req.headers.get("x-gitlab-token") || "";
  const event = req.headers.get("x-gitlab-event") || "";
  
  const bodyText = await req.text();
  let payload: any;
  try {
    payload = JSON.parse(bodyText);
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    await GitService.handleGitLabWebhook(projectId, event, token, payload);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message === "INTEGRATION_NOT_FOUND") {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }
    if (e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    console.error("GitLab Webhook processing error:", e);
    return NextResponse.json({ error: e.message || "Failed to process webhook" }, { status: 500 });
  }
}
