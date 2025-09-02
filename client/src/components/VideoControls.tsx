import React from 'react';
import { Play, Pause, Mic, MicOff, Maximize } from 'lucide-react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useControls } from '../hooks/useControls';

const VideoControls: React.FC = () => {
  const { isVideoEnabled, isAudioEnabled, toggleVideo, toggleAudio, role } = useWebRTC();
  const { showControls } = useControls();

  const handleFullscreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  };

  if (!showControls) return null;

  if (role !== 'Controller') {
    return (
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-black bg-opacity-70 rounded-lg p-3 transition-opacity duration-300">
        <button
          onClick={handleFullscreen}
          className="p-3 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-all duration-200"
        >
          <Maximize className="w-5 h-5 text-white" />
        </button>
      </div>
    )
  }

  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-black bg-opacity-70 rounded-lg p-3 transition-opacity duration-300">
      <button
        onClick={toggleVideo}
        className="p-3 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-all duration-200"
      >
        {isVideoEnabled ? (
          <Pause className="w-5 h-5 text-white" />
        ) : (
          <Play className="w-5 h-5 text-white" />
        )}
      </button>

      <button
        onClick={toggleAudio}
        className="p-3 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-all duration-200"
      >
        {isAudioEnabled ? (
          <Mic className="w-5 h-5 text-white" />
        ) : (
          <MicOff className="w-5 h-5 text-white" />
        )}
      </button>

      <button
        onClick={handleFullscreen}
        className="p-3 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 transition-all duration-200"
      >
        <Maximize className="w-5 h-5 text-white" />
      </button>
    </div>
  );
};

export default VideoControls;