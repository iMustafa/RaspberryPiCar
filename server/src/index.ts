import { WebRTCSignalingServer } from './WebRTCSignalingServer';

const server = new WebRTCSignalingServer();

server.start().catch(console.error);

process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

export { WebRTCSignalingServer };
export * from './types';