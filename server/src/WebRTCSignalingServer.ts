import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { RoomManager } from './services/RoomManager';
import { UserManager } from './services/UserManager';
import { SocketHandler } from './handlers/SocketHandler';
import { createRoutes } from './routes';
import { ServerConfig, defaultConfig } from './config';

export class WebRTCSignalingServer {
  private app = express();
  private server = createServer(this.app);
  private io: SocketIOServer;
  private roomManager = new RoomManager();
  private userManager = new UserManager();
  private socketHandler: SocketHandler;

  constructor(private config: ServerConfig = defaultConfig) {
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: config.corsOrigin,
        methods: ["GET", "POST"]
      }
    });
    
    this.socketHandler = new SocketHandler(this.roomManager, this.userManager);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static('public'));
  }

  private setupRoutes(): void {
    this.app.use('/', createRoutes(this.roomManager, this.userManager));
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      this.socketHandler.handleConnection(socket);
    });
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.config.port, () => {
        console.log(`WebRTC Signaling Server running on port ${this.config.port}`);
        console.log(`Health check: http://localhost:${this.config.port}/health`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('WebRTC Signaling Server stopped');
        resolve();
      });
    });
  }
}