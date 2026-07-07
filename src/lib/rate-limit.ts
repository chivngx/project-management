// Simple in-process rate limiter (no Redis needed).
// For production with multiple instances, swap this for @upstash/ratelimit
// backed by Redis. Keyed by IP + (email | route) with a sliding window.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Periodic cleanup so the map doesn't grow unbounded.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) {
      if (v.resetAt < now) buckets.delete(k);
    }
  }, 5 * 60 * 1000).unref?.();
}

/**
 * Returns true if the request is allowed, false if rate-limited.
 * @param key     identifier (e.g. `login:${ip}:${email}`)
 * @param limit   max requests in the window
 * @param windowMs window size in ms
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (existing.count >= limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }
  existing.count += 1;
  return {
    ok: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
  };
}

/** Extract the client IP from a Next.js Request (best-effort, never throws). */
export function getClientIp(req: unknown): string {
  try {
    const headers = (req as Request)?.headers;
    if (!headers) return "unknown";
    const fwd = headers.get?.("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
    const real = headers.get?.("x-real-ip");
    if (real) return real;
  } catch {
    // ignore
  }
  return "unknown";
}
