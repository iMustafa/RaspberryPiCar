import { Room, User } from '../types';

export class RoomManager {
  private rooms = new Map<string, Room>();

  createRoom(roomId: string): Room {
    const room: Room = {
      id: roomId,
      users: [],
      createdAt: new Date()
    };
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getOrCreateRoom(roomId: string): Room {
    return this.getRoom(roomId) || this.createRoom(roomId);
  }

  deleteRoom(roomId: string): boolean {
    return this.rooms.delete(roomId);
  }

  addUserToRoom(roomId: string, user: User): Room {
    const room = this.getOrCreateRoom(roomId);
    room.users.push(user);
    return room;
  }

  removeUserFromRoom(roomId: string, userId: string): Room | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

    room.users = room.users.filter(u => u.id !== userId);
    
    if (room.users.length === 0) {
      this.deleteRoom(roomId);
      return null;
    }
    
    return room;
  }

  removeUserEverywhere(userId: string): void {
    for (const [roomId, room] of this.rooms.entries()) {
      const before = room.users.length;
      room.users = room.users.filter(u => u.id !== userId);
      if (before !== room.users.length) {
        // Optionally emit events elsewhere if needed
      }
      if (room.users.length === 0) {
        this.deleteRoom(roomId);
      }
    }
  }

  getAllRooms(): Array<{ roomId: string; userCount: number; createdAt: Date }> {
    return Array.from(this.rooms.entries()).map(([roomId, room]) => ({
      roomId,
      userCount: room.users.length,
      createdAt: room.createdAt
    }));
  }
}