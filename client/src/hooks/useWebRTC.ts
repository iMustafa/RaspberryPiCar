import { useContext } from 'react';
import WebRTCContext from '../contexts/WebRTCContext';
import { WebRTCContextType } from '../types';

export const useWebRTC = (): WebRTCContextType => {
  const context = useContext(WebRTCContext);
  if (!context) {
    throw new Error('useWebRTC must be used within WebRTCProvider');
  }
  return context;
};