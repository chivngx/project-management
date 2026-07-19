import { NextResponse } from "next/server";
import { GitService } from "@/services/git.service";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const signature = req.headers.get("x-hub-signature-256") || "";
  const event = req.headers.get("x-github-event") || "";
  const bodyText = await req.text();

  try {
    await GitService.handleGitHubWebhook(projectId, event, signature, bodyText);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message === "INTEGRATION_NOT_FOUND") {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }
    if (e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    console.error("GitHub Webhook processing error:", e);
    return NextResponse.json({ error: e.message || "Failed to process webhook" }, { status: 500 });
  }
}
