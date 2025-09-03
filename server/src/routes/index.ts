import { Router } from 'express';
import { RoomManager } from '../services/RoomManager';
import { UserManager } from '../services/UserManager';
import path from 'path';

export function createRoutes(roomManager: RoomManager, userManager: UserManager): Router {
  const router = Router();
  const indexHtmlPath = path.resolve(process.cwd(), 'public/index.html');
  const testHtmlPath = path.resolve(process.cwd(), 'public/test.html');

  router.get('/', (req, res) => {
    res.sendFile(indexHtmlPath);
  });

  router.get('/test', (req, res) => {
    res.sendFile(testHtmlPath);
  });

  router.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      rooms: roomManager.getAllRooms().length,
      users: userManager.getUserCount(),
      timestamp: new Date().toISOString()
    });
  });

  router.get('/rooms/:roomId', (req, res) => {
    const { roomId } = req.params;
    const room = roomManager.getRoom(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
      roomId,
      userCount: room.users.length,
      users: room.users.map(user => ({
        id: user.id,
        joinedAt: user.joinedAt
      }))
    });
  });

  router.get('/rooms', (req, res) => {
    res.json({ rooms: roomManager.getAllRooms() });
  });

  // SPA fallback: send index.html for any other routes
  router.get('*', (req, res) => {
    res.sendFile(indexHtmlPath);
  });

  return router;
}