export interface User {
  role: 'Controller' | 'Car';
}

export interface WebRTCContextType {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isConnected: boolean;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  role: 'Controller' | 'Car' | null;
  isReconnecting?: boolean;
  users: Record<string, any>; // Users in current room
  connect: (role: 'Controller' | 'Car') => void;
  toggleVideo: () => void;
  toggleAudio: () => void;
  disconnect: () => void;
  socket?: any; // Expose socket for gamepad context
}

export interface ControlsContextType {
  showControls: boolean;
  setShowControls: (show: boolean) => void;
}

// Socket.IO event types
export interface JoinRoomData {
  roomId: string;
  userInfo: {
    name?: string;
    role: 'Controller' | 'Car';
  };
}

export interface JoinedRoomData {
  roomId: string;
  users: Array<{
    id: string;
    userInfo?: {
      name?: string;
      role?: 'Controller' | 'Car';
    };
    joinedAt: string;
  }>;
}

export interface UserJoinedData {
  userId: string;
  userInfo?: {
    name?: string;
    role?: 'Controller' | 'Car';
  };
  joinedAt: string;
}

export interface UserLeftData {
  userId: string;
}

export interface OfferData {
  fromUserId: string;
  offer: {
    type: string;
    sdp: string;
  };
}

export interface AnswerData {
  targetUserId: string;
  answer: {
    type: string;
    sdp: string;
  };
}

export interface IceCandidateData {
  targetUserId: string;
  candidate: {
    candidate: string;
    sdpMLineIndex: number | null;
    sdpMid: string | null;
  };
}

export interface RemoteControlData {
  action: 'toggle-video' | 'toggle-audio';
  room: string;
}

export interface MessageData {
  message: string;
}

export interface ErrorData {
  message: string;
}