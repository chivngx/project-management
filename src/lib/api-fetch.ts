/** Client-side fetch helper that throws on non-2xx with a server message. */
export async function apiFetch<T = unknown>(
  input: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data && String(data.error)) ||
      `Yêu cầu thất bại (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}
