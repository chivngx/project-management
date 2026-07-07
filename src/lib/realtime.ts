// Server-side helper to broadcast realtime events to the mini-service.
// Called from API routes after a mutation. Best-effort: failures are logged
// but never break the request (realtime is a nice-to-have).

const REALTIME_URL = process.env.REALTIME_URL || "http://localhost:3003";

export async function emitToWorkspace(
  workspaceId: string,
  event: string,
  payload: unknown
): Promise<void> {
  try {
    await fetch(`${REALTIME_URL}/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: `ws:${workspaceId}`, event, payload }),
    });
  } catch (e) {
    // Realtime service may be down; don't fail the request.
    console.warn("[realtime] emit failed:", (e as Error).message);
  }
}
