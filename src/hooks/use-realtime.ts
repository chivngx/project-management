"use client";

import * as React from "react";
import { io, type Socket } from "socket.io-client";

/**
 * Connect to the realtime mini-service and join the active workspace room.
 * Returns the socket (or null while connecting) so callers can attach
 * event listeners. The socket auto-cleans on unmount.
 *
 * The gateway routes `/socket.io/?XTransformPort=3003` to the mini-service
 * on port 3003. The path is `/` per the gateway convention.
 */
export function useRealtime(
  workspaceId: string | undefined | null,
  userId?: string | null
): Socket | null {
  const [socket, setSocket] = React.useState<Socket | null>(null);

  React.useEffect(() => {
    if (!workspaceId && !userId) return;
    const isLocal = typeof window !== "undefined" && 
      (window.location.hostname === "localhost" || 
       window.location.hostname === "127.0.0.1" || 
       window.location.port === "3000");

    const envSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;

    // Use environment variable if provided (for production/staging).
    // Fallback to local 3003 if on localhost.
    const socketUrl = envSocketUrl 
      ? envSocketUrl 
      : isLocal 
        ? `${window.location.protocol}//${window.location.hostname}:3003`
        : "/";
        
    const socketOptions = {
      path: "/",
      transports: ["websocket", "polling"] as any[],
    };

    const s = io(socketUrl, socketOptions);
    s.on("connect", () => {
      if (workspaceId) {
        s.emit("join", `ws:${workspaceId}`);
      }
      if (userId) {
        s.emit("join", `user:${userId}`);
      }
    });
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [workspaceId, userId]);

  return socket;
}
