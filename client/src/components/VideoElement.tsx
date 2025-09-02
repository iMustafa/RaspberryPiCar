import React, { useRef, useEffect } from 'react';

interface VideoElementProps {
  stream: MediaStream | null;
  className?: string;
  muted?: boolean;
}

const VideoElement: React.FC<VideoElementProps> = ({ 
  stream, 
  className = '', 
  muted = false 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={`bg-gray-900 ${className}`}
    />
  );
};

export default VideoElement;