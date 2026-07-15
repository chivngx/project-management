import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { POST } from "./route";
import { db } from "@/lib/db";

// Mock the database client
vi.mock("@/lib/db", () => {
  return {
    db: {
      project: {
        findUnique: vi.fn(),
      },
      task: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      activity: {
        create: vi.fn(),
      },
    },
  };
});

describe("GitHub Webhook Endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 if projectId is missing", async () => {
    const req = new Request("http://localhost/api/webhooks/github", {
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Missing projectId");
  });

  it("returns 404 if project is not found", async () => {
    vi.mocked(db.project.findUnique).mockResolvedValue(null);

    const req = new Request("http://localhost/api/webhooks/github?projectId=nonexistent", {
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Project not found");
  });

  it("returns 401 if signature validation fails when secret is configured", async () => {
    const mockProject = {
      id: "proj-123",
      workspaceId: "ws-123",
      repoWebhookSecret: "super-secret-key",
      workspace: {
        ownerId: "user-123",
      },
    };
    vi.mocked(db.project.findUnique).mockResolvedValue(mockProject as any);

    const req = new Request("http://localhost/api/webhooks/github?projectId=proj-123", {
      method: "POST",
      headers: {
        "x-hub-signature-256": "sha256=invalid-signature-hash",
      },
      body: JSON.stringify({ action: "opened" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid signature");
  });

  it("successfully validates signature and creates task on issue opened", async () => {
    const mockProject = {
      id: "proj-123",
      workspaceId: "ws-123",
      repoWebhookSecret: "super-secret-key",
      workspace: {
        ownerId: "user-123",
      },
    };
    vi.mocked(db.project.findUnique).mockResolvedValue(mockProject as any);
    vi.mocked(db.task.findFirst).mockResolvedValue(null); // not existing yet
    vi.mocked(db.task.create).mockResolvedValue({ id: "task-999", title: "New Issue" } as any);

    const payload = {
      action: "opened",
      issue: {
        id: 12345,
        number: 42,
        title: "Test Issue Title",
        body: "Test Issue Body",
        html_url: "https://github.com/owner/repo/issues/42",
      },
    };
    const bodyText = JSON.stringify(payload);
    const hmac = crypto.createHmac("sha256", "super-secret-key");
    const signature = "sha256=" + hmac.update(bodyText).digest("hex");

    const req = new Request("http://localhost/api/webhooks/github?projectId=proj-123", {
      method: "POST",
      headers: {
        "x-github-event": "issues",
        "x-hub-signature-256": signature,
      },
      body: bodyText,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(db.task.create).toHaveBeenCalledWith({
      data: {
        projectId: "proj-123",
        title: "Test Issue Title",
        description: "Test Issue Body",
        status: "TODO",
        priority: "MEDIUM",
        creatorId: "user-123",
        externalId: "12345",
        externalNumber: 42,
        externalUrl: "https://github.com/owner/repo/issues/42",
        externalProvider: "github",
      },
    });
  });

  it("updates task to DONE when issue is closed", async () => {
    const mockProject = {
      id: "proj-123",
      workspaceId: "ws-123",
      workspace: {
        ownerId: "user-123",
      },
    };
    vi.mocked(db.project.findUnique).mockResolvedValue(mockProject as any);

    const existingTask = {
      id: "task-abc",
      title: "Existing Task",
      status: "TODO",
    };
    vi.mocked(db.task.findFirst).mockResolvedValue(existingTask as any);

    const payload = {
      action: "closed",
      issue: {
        id: 12345,
        number: 42,
        title: "Test Issue Title",
      },
    };

    const req = new Request("http://localhost/api/webhooks/github?projectId=proj-123", {
      method: "POST",
      headers: {
        "x-github-event": "issues",
      },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(db.task.update).toHaveBeenCalledWith({
      where: { id: "task-abc" },
      data: { status: "DONE" },
    });
  });
});
