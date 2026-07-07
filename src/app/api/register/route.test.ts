import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted runs the factory before vi.mock hoisting, so the mock object is
// available inside the vi.mock factory below.
const mockDb = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  workspace: { create: vi.fn() },
  project: { create: vi.fn() },
  task: { createMany: vi.fn() },
  activity: { create: vi.fn() },
  $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(mockDb)),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

// Mock next-auth getServerSession to always return null (unauthenticated).
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));
vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue(null),
}));

// Mock rate-limit to always allow (avoid cross-test interference).
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ ok: true, remaining: 99, resetAt: Date.now() + 60000 })),
  getClientIp: vi.fn(() => "test-ip"),
}));

// Mock bcryptjs with a simple stub.
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-password") },
}));

import { POST } from "@/app/api/register/route";

function mockReq(body: unknown) {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers(),
  } as unknown as Request;
}

describe("POST /api/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when name is too short", async () => {
    const res = await POST(
      mockReq({ name: "A", email: "a@b.com", password: "Password1" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("2 ký tự");
  });

  it("rejects an invalid email", async () => {
    const res = await POST(
      mockReq({ name: "Alice", email: "not-an-email", password: "Password1" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Email");
  });

  it("rejects a weak password (no uppercase)", async () => {
    const res = await POST(
      mockReq({ name: "Alice", email: "a@b.com", password: "password1" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/chữ in hoa|8 ký tự/);
  });

  it("rejects a weak password (too short)", async () => {
    const res = await POST(
      mockReq({ name: "Alice", email: "a@b.com", password: "Ab1" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 when email already exists", async () => {
    mockDb.user.findUnique.mockResolvedValue({ id: "existing" });
    const res = await POST(
      mockReq({ name: "Alice", email: "a@b.com", password: "Password1" })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("đã được sử dụng");
  });

  it("creates a user + workspace + starter project on valid input", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    mockDb.user.create.mockResolvedValue({ id: "u1", name: "Alice" });
    mockDb.workspace.create.mockResolvedValue({ id: "w1", name: "Alice's Workspace" });
    mockDb.project.create.mockResolvedValue({ id: "p1", name: "Getting Started" });
    mockDb.task.createMany.mockResolvedValue({ count: 3 });
    mockDb.activity.create.mockResolvedValue({});

    const res = await POST(
      mockReq({ name: "Alice", email: "alice@example.com", password: "Password1" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // Transaction should have been called.
    expect(mockDb.$transaction).toHaveBeenCalled();
    expect(mockDb.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "alice@example.com",
          passwordHash: "hashed-password",
        }),
      })
    );
  });
});
