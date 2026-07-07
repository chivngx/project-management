"use client";

import { signOut } from "next-auth/react";

let isRedirecting = false;

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

  // 401 Unauthorized: the session expired or is missing. Sign out and send
  // the user to /login. Avoid doing this multiple times concurrently.
  if (res.status === 401 && !isRedirecting) {
    isRedirecting = true;
    try {
      await signOut({ redirect: false });
      if (typeof window !== "undefined") {
        window.location.href = "/login?expired=1";
      }
    } finally {
      isRedirecting = false;
    }
    throw new Error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Response wasn't JSON (e.g. HTML error page) — surface a clean error.
      throw new Error(
        `Yêu cầu thất bại (${res.status}). Vui lòng thử lại.`
      );
    }
  }

  if (!res.ok) {
    let message = `Yêu cầu thất bại (${res.status})`;
    if (
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
    ) {
      message = (data as { error: string }).error;
    }
    throw new Error(message);
  }

  return data as T;
}
