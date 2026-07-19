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
export function useRealtime(workspaceId: string | undefined | null): Socket | null {
  const [socket, setSocket] = React.useState<Socket | null>(null);

  React.useEffect(() => {
    if (!workspaceId) return;
    const isLocalhost = typeof window !== "undefined" && 
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

    const socketUrl = isLocalhost ? "http://localhost:3003" : "/";
    const socketOptions = isLocalhost
      ? { path: "/", transports: ["websocket", "polling"] }
      : {
          path: "/",
          transports: ["websocket", "polling"],
          query: { XTransformPort: "3003" },
        };

    const s = io(socketUrl, socketOptions);
    s.on("connect", () => {
      s.emit("join", `ws:${workspaceId}`);
    });
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [workspaceId]);

  return socket;
}
