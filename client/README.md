# PiCar Client - React Video Streaming App

A React TypeScript application for video streaming between a Controller and Car using WebRTC and WebSocket signaling.

## Project Structure

```
src/
├── components/           # React components
│   ├── VideoElement.tsx     # Reusable video element component
│   ├── VideoControls.tsx    # Video control buttons (play/pause, mic, fullscreen)
│   ├── VideoStreamView.tsx  # Main video streaming interface
│   ├── LandingPage.tsx      # Role selection landing page
│   └── index.ts            # Component exports
├── contexts/            # React contexts
│   ├── WebRTCContext.tsx   # WebRTC connection management
│   └── ControlsContext.tsx # UI controls state management
├── hooks/               # Custom React hooks
│   ├── useWebRTC.ts        # WebRTC context hook
│   └── useControls.ts      # Controls context hook
├── types/               # TypeScript type definitions
│   └── index.ts            # Interface definitions
├── App.tsx              # Main application component
└── index.tsx            # Application entry point
```

## Features

- **Role-based Connection**: Choose between Controller or Car roles
- **WebRTC Video Streaming**: Real-time video communication
- **Remote Controls**: Controller can toggle video/audio on Car
- **Responsive UI**: Modern interface with Tailwind CSS
- **Fullscreen Support**: Fullscreen video viewing
- **Auto-hide Controls**: Controls appear/disappear based on mouse movement

## Technologies Used

- React 19 with TypeScript
- WebRTC for peer-to-peer video streaming
- WebSocket for signaling (connects to ws://localhost:3001)
- Tailwind CSS for styling
- Lucide React for icons

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Open [http://localhost:3000](http://localhost:3000) to view the app

## Usage

1. **Choose Role**: Select either "Controller" or "Car" on the landing page
2. **Controller**: Can view Car's video stream and control Car's camera/microphone
3. **Car**: Streams video/audio to Controller and responds to remote controls
4. **Controls**: 
   - Mouse movement shows/hides controls
   - Controller can toggle video/audio on Car
   - Fullscreen button for immersive viewing
   - Back button to disconnect and return to landing page

## WebSocket Server

This client expects a WebSocket server running on `ws://localhost:3001` for signaling. The server should handle:
- Room management (VideoChannel)
- WebRTC offer/answer exchange
- ICE candidate exchange
- Remote control commands

## Browser Compatibility

Requires modern browsers with WebRTC support:
- Chrome/Chromium
- Firefox
- Safari
- Edge