import React, { useRef, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useControls } from '../hooks/useControls';
import VideoElement from './VideoElement';
import VideoControls from './VideoControls';
import GamepadControl from './GamepadControl';

const VideoStreamView: React.FC = () => {
  const { localStream, remoteStream, disconnect, role, isReconnecting } = useWebRTC();
  const { showControls, setShowControls } = useControls();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseMove = () => {
    setShowControls(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  const handleMouseLeave = () => {
    setShowControls(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div 
      className="relative w-full h-screen bg-black overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Remote video (fullscreen) */}
      {remoteStream && (
        <VideoElement
          stream={remoteStream}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      
      {/* Local video (bottom-right corner) */}
      {localStream && (
        <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden shadow-lg border-2 border-white border-opacity-30">
          <VideoElement
            stream={localStream}
            className="w-full h-full object-cover"
            muted
          />
        </div>
      )}
      
      {/* Back button */}
      <button
        onClick={disconnect}
        className={`absolute top-6 left-6 p-3 rounded-full bg-black bg-opacity-50 hover:bg-opacity-70 transition-all duration-200 ${showControls ? 'opacity-100' : 'opacity-0'}`}
      >
        <ArrowLeft className="w-5 h-5 text-white" />
      </button>
      
      {/* Role indicator */}
      <div className={`absolute top-6 right-6 px-4 py-2 bg-black bg-opacity-50 rounded-lg transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <span className="text-white text-sm font-medium">{role}</span>
      </div>
      
      {/* Video controls */}
      <VideoControls />
      
      {/* Gamepad control (only for Controller) */}
      <GamepadControl />
      
      {/* Loading state */}
      {!remoteStream && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg">Waiting for connection...</p>
          </div>
        </div>
      )}
      
      {/* Reconnection indicator */}
      {isReconnecting && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-80 rounded-lg p-4 text-white text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
          <p className="text-sm">Reconnecting...</p>
        </div>
      )}
    </div>
  );
};

export default VideoStreamView;