import { createServer } from "http";
import { Server } from "socket.io";

const PORT = Number(process.env.PORT) || 3003;

const httpServer = createServer();

const io = new Server(httpServer, {
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// Intercept request listener to handle /emit before socket.io gets it
const originalRequestListeners = [...httpServer.listeners("request")];
httpServer.removeAllListeners("request");

httpServer.on("request", (req, res) => {
  if (req.method === "POST" && req.url?.startsWith("/emit")) {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { room, event, payload } = JSON.parse(body);
        if (room && event) {
          io.to(room).emit(event, payload);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } else {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "room + event required" }));
        }
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "invalid json" }));
      }
    });
    return;
  }

  // Forward to socket.io's original listeners
  for (const listener of originalRequestListeners) {
    listener.call(httpServer, req, res);
  }
});

// Room = workspace id. Clients join their active workspace room to receive
// scoped events (task created/updated/deleted, project updated, etc.).
io.on("connection", (socket) => {
  socket.on("join", (room: string) => {
    if (typeof room === "string" && room.length > 0) {
      socket.join(room);
    }
  });
  socket.on("leave", (room: string) => {
    if (typeof room === "string") socket.leave(room);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[realtime] socket.io listening on http://localhost:${PORT}`);
});
