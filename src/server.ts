import http from "http";
import path from "path";
import express from "express";
import { getConnectedUsers } from "./helpers";
import { broadcastUserListToDevelopers } from "./helpers";
import { Server as SocketIOServer, Socket } from "socket.io";
import { ClientInfo, ClientType, SocketWithInfo } from "./types";

const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
  },
});

const PORT = process.env.PORT || 3000;

const clients = new Map<string, ClientInfo>();

io.on("connection", (socket: Socket) => {
  const clientSocket = socket as SocketWithInfo;

  const clientType = (socket.handshake.query.clientType as ClientType) || "user";
  const ipAddress =
    (socket.handshake.headers["x-forwarded-for"] as string) ||
    socket.handshake.address ||
    "unknown";

  console.log(`${clientType} connected: ${socket.id} from IP: ${ipAddress}`);

  const clientInfo: ClientInfo = {
    id: socket.id,
    type: clientType,
    ip: ipAddress,
    status: "available",
    peerId: null,
  };
  clients.set(socket.id, clientInfo);
  clientSocket.clientInfo = clientInfo;

  socket.emit("yourID", socket.id);

  if (clientType === "developer") {
    socket.emit("update-dashboard-users", getConnectedUsers(clients));
  } else {
    broadcastUserListToDevelopers(io, clients);
  }

  socket.on("disconnect", () => {
    const disconnectedClient = clients.get(socket.id);
    if (!disconnectedClient) return;

    console.log(`${disconnectedClient.type} disconnected: ${socket.id}`);

    if (disconnectedClient.status === "busy" && disconnectedClient.peerId) {
      const peer = clients.get(disconnectedClient.peerId);
      if (peer) {
        const peerSocket = io.sockets.sockets.get(peer.id);
        if (peerSocket) {
          peerSocket.emit("hangup-call", {
            from: socket.id,
            reason: "disconnected",
          });
        }

        peer.status = "available";
        peer.peerId = null;
        clients.set(peer.id, peer);
        // Also update the peer's socket info if available (important!)
        const peerClientSocket = io.sockets.sockets.get(peer.id) as SocketWithInfo | undefined;
        if (peerClientSocket?.clientInfo) {
          peerClientSocket.clientInfo.status = "available";
          peerClientSocket.clientInfo.peerId = null;
        }
        if (peer.type === "user") {
          broadcastUserListToDevelopers(io, clients);
        }
      }
    }

    const wasUser = disconnectedClient.type === "user";
    clients.delete(socket.id);
    if (wasUser) {
      broadcastUserListToDevelopers(io, clients);
    }
  });

  socket.on("call-user", (data: { to: string; offer: any }) => {
    const caller = clientSocket.clientInfo;
    const targetUser = clients.get(data.to);

    console.log(`Call initiated from Developer ${socket.id} to User ${data.to}`);

    if (!caller || caller.type !== "developer") {
      socket.emit("error-message", { message: "Only developers can initiate calls." });
      return;
    }
    if (!targetUser || targetUser.type !== "user") {
      socket.emit("error-message", { message: `User ${data.to} not found or is not a user.` });
      return;
    }
    if (caller.status === "busy") {
      socket.emit("error-message", { message: "You are already in a call." });
      return;
    }
    if (targetUser.status === "busy") {
      socket.emit("user-busy", { to: data.to });
      return;
    }

    io.to(data.to).emit("call-made", {
      offer: data.offer,
      from: socket.id, // Developer's ID
    });
    console.log(`Offer sent from ${socket.id} to ${data.to}`);
  });

  // User answers the call from the developer
  socket.on("make-answer", (data: { to: string; answer: any }) => {
    const answeringUser = clientSocket.clientInfo;
    const callingDeveloper = clients.get(data.to);

    console.log(`Answer sent from User ${socket.id} to Developer ${data.to}`);

    if (!answeringUser || answeringUser.type !== "user") return;
    if (!callingDeveloper || callingDeveloper.type !== "developer") return;

    answeringUser.status = "busy";
    answeringUser.peerId = callingDeveloper.id;
    clients.set(socket.id, answeringUser);

    callingDeveloper.status = "busy";
    callingDeveloper.peerId = answeringUser.id;
    clients.set(callingDeveloper.id, callingDeveloper);

    clientSocket.clientInfo = answeringUser;
    const devSocket = io.sockets.sockets.get(callingDeveloper.id) as SocketWithInfo | undefined;
    if (devSocket?.clientInfo) {
      devSocket.clientInfo.status = "busy";
      devSocket.clientInfo.peerId = answeringUser.id;
    }

    io.to(data.to).emit("answer-made", {
      answer: data.answer,
      from: socket.id, // User's ID
    });

    broadcastUserListToDevelopers(io, clients);
    console.log(`User ${socket.id} and Developer ${data.to} are now busy.`);
  });

  socket.on("ice-candidate", (data: { to: string; candidate: any }) => {
    const sender = clientSocket.clientInfo;
    const recipient = clients.get(data.to);

    if (sender && recipient) {
      console.log(`ICE candidate from ${sender.type} ${socket.id} to ${recipient.type} ${data.to}`);
      io.to(data.to).emit("ice-candidate", {
        candidate: data.candidate,
        from: socket.id,
      });
    }
  });

  socket.on("reject-call", (data: { to: string }) => {
    const rejectingUser = clientSocket.clientInfo;
    const callingDeveloper = clients.get(data.to);

    if (!rejectingUser || rejectingUser.type !== "user") return;
    if (!callingDeveloper || callingDeveloper.type !== "developer") return;

    console.log(`Call rejected by User ${socket.id} for Developer ${data.to}`);
    io.to(data.to).emit("call-denied", {
      from: socket.id, // User's ID
    });
  });

  socket.on("hangup-call", (data: { to: string }) => {
    const hangingUpClient = clientSocket.clientInfo;
    const peerClientInfo = clients.get(data.to);

    if (!hangingUpClient || !peerClientInfo) return;

    console.log(
      `Call hangup from ${hangingUpClient.type} ${socket.id} to ${peerClientInfo.type} ${data.to}`
    );

    // Notify the peer
    io.to(data.to).emit("hangup-call", {
      from: socket.id,
    });

    hangingUpClient.status = "available";
    hangingUpClient.peerId = null;
    clients.set(socket.id, hangingUpClient);

    peerClientInfo.status = "available";
    peerClientInfo.peerId = null;
    clients.set(data.to, peerClientInfo);

    clientSocket.clientInfo = hangingUpClient;
    const peerSocket = io.sockets.sockets.get(data.to) as SocketWithInfo | undefined;
    if (peerSocket?.clientInfo) {
      peerSocket.clientInfo.status = "available";
      peerSocket.clientInfo.peerId = null;
    }

    console.log(`Both ${socket.id} and ${data.to} are now available.`);

    if (hangingUpClient.type === "user" || peerClientInfo.type === "user") {
      broadcastUserListToDevelopers(io, clients);
    }
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "./views/index.html"));
});
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "./views/dashboard.html"));
});

app.use(express.static(path.join(__dirname, "../public")));

server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
