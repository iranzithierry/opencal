import { Server as SocketIOServer } from "socket.io";
import { ClientInfo, SocketWithInfo, UserInfo } from "../types";

export function getConnectedUsers(clients: Map<string, ClientInfo>): UserInfo[] {
  return Array.from(clients.values())
    .filter((client) => client.type === "user")
    .map(({ id, ip, status }) => ({ id, ip, status }));
}

export function getDeveloperSockets(io: SocketIOServer): SocketWithInfo[] {
  const developerSockets: SocketWithInfo[] = [];
  io.sockets.sockets.forEach((socket) => {
    const clientSocket = socket as SocketWithInfo;
    if (clientSocket.clientInfo?.type === "developer") {
      developerSockets.push(clientSocket);
    }
  });
  return developerSockets;
}

export function broadcastUserListToDevelopers(
  io: SocketIOServer,
  clients: Map<string, ClientInfo>
): void {
  const userList = getConnectedUsers(clients);
  getDeveloperSockets(io).forEach((devSocket) => {
    devSocket.emit("update-dashboard-users", userList);
  });
}
