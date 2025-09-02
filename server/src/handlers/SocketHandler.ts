import { Socket } from 'socket.io';
import { RoomManager } from '../services/RoomManager';
import { UserManager } from '../services/UserManager';
import { JoinRoomData, SignalingData, MessageData, User } from '../types';

export class SocketHandler {
  constructor(
    private roomManager: RoomManager,
    private userManager: UserManager
  ) {}

  handleConnection(socket: Socket): void {
    console.log(`User connected: ${socket.id}`);
    
    const user: User = {
      id: socket.id,
      socket,
      roomId: null,
      joinedAt: new Date()
    };
    
    this.userManager.addUser(user);
    this.setupSocketEvents(socket);
  }

  private setupSocketEvents(socket: Socket): void {
    socket.on('join-room', (data: JoinRoomData) => {
      this.handleJoinRoom(socket, data);
    });

    socket.on('leave-room', () => {
      this.handleLeaveRoom(socket);
    });

    socket.on('offer', (data: SignalingData) => {
      this.handleSignaling(socket, data, 'offer');
    });

    socket.on('answer', (data: SignalingData) => {
      this.handleSignaling(socket, data, 'answer');
    });

    socket.on('ice-candidate', (data: SignalingData) => {
      this.handleSignaling(socket, data, 'ice-candidate');
    });

    socket.on('message', (data: MessageData) => {
      this.handleMessage(socket, data);
    });

    socket.on('disconnect', () => {
      this.handleDisconnect(socket);
    });
  }

  private handleJoinRoom(socket: Socket, data: JoinRoomData): void {
    const { roomId, userInfo } = data;
    
    if (!roomId) {
      socket.emit('error', { message: 'Room ID is required' });
      return;
    }

    this.handleLeaveRoom(socket);
    
    const user = this.userManager.getUser(socket.id);
    if (!user) return;

    user.roomId = roomId;
    user.userInfo = userInfo;
    
    const room = this.roomManager.addUserToRoom(roomId, user);
    socket.join(roomId);

    socket.emit('joined-room', {
      roomId,
      userId: socket.id,
      users: room.users.map(u => ({
        id: u.id,
        userInfo: u.userInfo,
        joinedAt: u.joinedAt
      }))
    });

    socket.to(roomId).emit('user-joined', {
      userId: socket.id,
      userInfo,
      joinedAt: user.joinedAt
    });

    console.log(`User ${socket.id} joined room ${roomId}`);
  }

  private handleLeaveRoom(socket: Socket): void {
    const user = this.userManager.getUser(socket.id);
    if (!user?.roomId) return;

    const roomId = user.roomId;
    const room = this.roomManager.removeUserFromRoom(roomId, socket.id);
    
    socket.to(roomId).emit('user-left', { userId: socket.id });
    socket.leave(roomId);
    user.roomId = null;

    if (!room) {
      console.log(`Room ${roomId} deleted (empty)`);
    }

    console.log(`User ${socket.id} left room ${roomId}`);
  }

  private handleSignaling(socket: Socket, data: SignalingData, eventType: string): void {
    const { targetUserId } = data;
    
    if (!targetUserId) {
      socket.emit('error', { message: 'Target user ID is required' });
      return;
    }

    const targetUser = this.userManager.getUser(targetUserId);
    if (!targetUser) {
      socket.emit('error', { message: 'Target user not found' });
      return;
    }

    const payload = { fromUserId: socket.id, ...data };
    delete (payload as any).targetUserId;
    
    targetUser.socket.emit(eventType, payload);
    console.log(`${eventType} forwarded from ${socket.id} to ${targetUserId}`);
  }

  private handleMessage(socket: Socket, data: MessageData): void {
    const user = this.userManager.getUser(socket.id);
    if (!user?.roomId) {
      socket.emit('error', { message: 'You must be in a room to send messages' });
      return;
    }

    socket.to(user.roomId).emit('message', {
      fromUserId: socket.id,
      message: data.message,
      timestamp: new Date().toISOString()
    });
  }

  private handleDisconnect(socket: Socket): void {
    console.log(`User disconnected: ${socket.id}`);
    this.handleLeaveRoom(socket);
    this.userManager.removeUser(socket.id);
  }
}