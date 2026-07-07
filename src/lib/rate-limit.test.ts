import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    // Reset by using a fresh key per test isn't possible since the module
    // holds state; instead we use unique keys per test.
  });

  it("allows the first request within the limit", () => {
    const key = `test-first-${Math.random()}`;
    const r = rateLimit(key, 5, 60_000);
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(4);
  });

  it("blocks after the limit is exceeded", () => {
    const key = `test-block-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      rateLimit(key, 3, 60_000);
    }
    const over = rateLimit(key, 3, 60_000);
    expect(over.ok).toBe(false);
    expect(over.remaining).toBe(0);
  });

  it("resets after the window passes", async () => {
    const key = `test-reset-${Math.random()}`;
    // Use a tiny window (50ms) so we can wait it out quickly.
    rateLimit(key, 1, 50);
    const blocked = rateLimit(key, 1, 50);
    expect(blocked.ok).toBe(false);
    await new Promise((r) => setTimeout(r, 60));
    const after = rateLimit(key, 1, 50);
    expect(after.ok).toBe(true);
  });
});

describe("getClientIp", () => {
  it("reads x-forwarded-for header", () => {
    const req = {
      headers: new Headers({ "x-forwarded-for": "203.0.113.1, 10.0.0.1" }),
    };
    expect(getClientIp(req)).toBe("203.0.113.1");
  });

  it("reads x-real-ip when x-forwarded-for is absent", () => {
    const req = { headers: new Headers({ "x-real-ip": "198.51.100.7" }) };
    expect(getClientIp(req)).toBe("198.51.100.7");
  });

  it("returns 'unknown' when no headers present", () => {
    const req = { headers: new Headers() };
    expect(getClientIp(req)).toBe("unknown");
  });

  it("returns 'unknown' when req has no headers (never throws)", () => {
    expect(getClientIp({})).toBe("unknown");
    expect(getClientIp(null)).toBe("unknown");
    expect(getClientIp(undefined)).toBe("unknown");
  });
});
