export interface UserInfo {
  [key: string]: any;
}

export interface User {
  id: string;
  socket: any;
  roomId: string | null;
  userInfo?: UserInfo;
  joinedAt: Date;
}

export interface Room {
  id: string;
  users: User[];
  createdAt: Date;
}

export interface JoinRoomData {
  roomId: string;
  userInfo?: UserInfo;
}

export interface SignalingData {
  targetUserId: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidate;
}

export interface MessageData {
  message: string;
}

export type RTCSdpType = 'offer' | 'pranswer' | 'answer' | 'rollback';

export interface RTCSessionDescriptionInit {
  type: RTCSdpType;
  sdp?: string;
}

export interface RTCIceCandidate {
  candidate: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
  usernameFragment?: string | null;
}

export interface SignalingData {
  targetUserId: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidate;
}

export interface MessageData {
  message: string;
}