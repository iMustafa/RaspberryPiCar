import { WebRTCSignalingServer } from './WebRTCSignalingServer';

const server = new WebRTCSignalingServer({
  port: parseInt(process.env.PORT || '3000'),
  corsOrigin: '*'
});

server.start().catch(console.error);

process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

export { WebRTCSignalingServer };
export * from './types';