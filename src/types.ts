import type { Socket } from "socket.io";

export type ClientType = "user" | "developer";
export type ClientStatus = "available" | "busy";

export interface ClientInfo {
  id: string;
  type: ClientType;
  ip: string;
  status: ClientStatus;
  peerId: string | null;
}

export interface UserInfo {
  id: string;
  ip: string;
  status: ClientStatus;
}

export interface SocketWithInfo extends Socket {
  clientInfo?: ClientInfo;
}
