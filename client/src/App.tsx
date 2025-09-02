import React from 'react';
import { WebRTCProvider, ControlsProvider } from './contexts';
import { useWebRTC } from './hooks';
import { VideoStreamView, LandingPage } from './components';

const App: React.FC = () => {
  const { isConnected } = useWebRTC();

  return (
    <ControlsProvider>
      {isConnected ? <VideoStreamView /> : <LandingPage />}
    </ControlsProvider>
  );
};

const AppWithProvider: React.FC = () => {
  return (
    <WebRTCProvider>
      <App />
    </WebRTCProvider>
  );
};

export default AppWithProvider;