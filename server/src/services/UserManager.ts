import { User } from '../types';

export class UserManager {
  private users = new Map<string, User>();

  addUser(user: User): void {
    this.users.set(user.id, user);
  }

  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  removeUser(userId: string): boolean {
    return this.users.delete(userId);
  }

  getUserCount(): number {
    return this.users.size;
  }
}