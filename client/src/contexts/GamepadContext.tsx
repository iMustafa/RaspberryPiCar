import React, { createContext, useState, useRef, useCallback, useEffect } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useGamepad } from '../hooks/useGamepad';

interface GamepadContextType {
  isGamepadConnected: boolean;
  isGamepadSending: boolean;
  connectedGamepads: number;
  gamepadState: {
    throttle: number;
    steering: number;
    buttons: number;
  };
  startGamepadControl: () => void;
  stopGamepadControl: () => void;
}

const GamepadContext = createContext<GamepadContextType | null>(null);

export const GamepadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, isConnected, socket } = useWebRTC();
  const [isGamepadChannelReady, setIsGamepadChannelReady] = useState(false);
  const [, setGamepadChannel] = useState<RTCDataChannel | null>(null);
  
  const gamepadChannelRef = useRef<RTCDataChannel | null>(null);
  const gamepadPeerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Gamepad hook configuration
  const {
    gamepadState,
    isConnected: isGamepadConnected,
    connectedGamepads,
    startSending,
    stopSending,
    isSending: isGamepadSending
  } = useGamepad({
    sendFrequency: 60,
    onByteArray: (data: ArrayBuffer) => {
      console.log('Sending gamepad data over WebRTC data channel', data);
      if (gamepadChannelRef.current && gamepadChannelRef.current.readyState === 'open') {
        gamepadChannelRef.current.send(data);
      }
    }
  });

  // Setup gamepad WebRTC data channel
  const setupGamepadDataChannel = useCallback(() => {
    if (!socket || role !== 'Controller') return;

    console.log('Setting up gamepad data channel...');
    
    // Create peer connection for gamepad data channel
    const configuration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };
    
    gamepadPeerConnectionRef.current = new RTCPeerConnection(configuration);
    
    // Create data channel for gamepad data
    const dataChannel = gamepadPeerConnectionRef.current.createDataChannel('gamepad', {
      ordered: true,
      maxRetransmits: 3
    });
    
    dataChannel.onopen = () => {
      console.log('Gamepad data channel opened');
      setIsGamepadChannelReady(true);
      setGamepadChannel(dataChannel);
      gamepadChannelRef.current = dataChannel;
    };
    
    dataChannel.onclose = () => {
      console.log('Gamepad data channel closed');
      setIsGamepadChannelReady(false);
      setGamepadChannel(null);
      gamepadChannelRef.current = null;
    };
    
    dataChannel.onerror = (error) => {
      console.error('Gamepad data channel error:', error);
    };
    
    // Handle ICE candidates
    gamepadPeerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('gamepad-ice-candidate', {
          targetUserId: 'Car', // We'll need to find the actual Car user ID
          candidate: {
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid
          }
        });
      }
    };
    
    // Handle incoming data channel
    gamepadPeerConnectionRef.current.ondatachannel = (event) => {
      const channel = event.channel;
      channel.onopen = () => {
        console.log('Received gamepad data channel opened');
        setIsGamepadChannelReady(true);
        setGamepadChannel(channel);
        gamepadChannelRef.current = channel;
      };
    };
    
    return gamepadPeerConnectionRef.current;
  }, [socket, role]);

  // Join GamepadChannel room when connected as Controller
  useEffect(() => {
    if (isConnected && role === 'Controller' && socket) {
      console.log('Controller joining GamepadChannel...');
      socket.emit('join-room', {
        roomId: 'GamepadChannel',
        userInfo: {
          name: 'Controller',
          role: 'Controller'
        }
      });
    }
  }, [isConnected, role, socket]);

  // Setup gamepad data channel when Controller joins GamepadChannel
  useEffect(() => {
    if (role === 'Controller' && isConnected) {
      setupGamepadDataChannel();
    }
    
    return () => {
      if (gamepadPeerConnectionRef.current) {
        gamepadPeerConnectionRef.current.close();
        gamepadPeerConnectionRef.current = null;
      }
      setIsGamepadChannelReady(false);
      setGamepadChannel(null);
      gamepadChannelRef.current = null;
    };
  }, [role, isConnected, setupGamepadDataChannel]);

  // Handle gamepad WebRTC signaling events
  useEffect(() => {
    if (!socket || role !== 'Controller') return;

    const handleGamepadOffer = async (data: any) => {
      console.log('Received gamepad offer:', data);
      if (!gamepadPeerConnectionRef.current) return;
      
      try {
        await gamepadPeerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await gamepadPeerConnectionRef.current.createAnswer();
        await gamepadPeerConnectionRef.current.setLocalDescription(answer);
        
        socket.emit('gamepad-answer', {
          targetUserId: data.fromUserId,
          answer: {
            type: answer.type,
            sdp: answer.sdp
          }
        });
      } catch (error) {
        console.error('Error handling gamepad offer:', error);
      }
    };

    const handleGamepadAnswer = async (data: any) => {
      console.log('Received gamepad answer:', data);
      if (!gamepadPeerConnectionRef.current) return;
      
      try {
        await gamepadPeerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      } catch (error) {
        console.error('Error handling gamepad answer:', error);
      }
    };

    const handleGamepadIceCandidate = async (data: any) => {
      console.log('Received gamepad ICE candidate:', data);
      if (!gamepadPeerConnectionRef.current) return;
      
      try {
        await gamepadPeerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (error) {
        console.error('Error handling gamepad ICE candidate:', error);
      }
    };

    socket.on('gamepad-offer', handleGamepadOffer);
    socket.on('gamepad-answer', handleGamepadAnswer);
    socket.on('gamepad-ice-candidate', handleGamepadIceCandidate);

    return () => {
      socket.off('gamepad-offer', handleGamepadOffer);
      socket.off('gamepad-answer', handleGamepadAnswer);
      socket.off('gamepad-ice-candidate', handleGamepadIceCandidate);
    };
  }, [socket, role]);

  // Gamepad control functions
  const startGamepadControl = useCallback(() => {
    if (role === 'Controller' && isGamepadChannelReady && isGamepadConnected) {
      console.log('Starting gamepad control...');
      startSending();
    } else {
      console.log('Cannot start gamepad control:', {
        role,
        isGamepadChannelReady,
        isGamepadConnected
      });
    }
  }, [role, isGamepadChannelReady, isGamepadConnected, startSending]);

  const stopGamepadControl = useCallback(() => {
    console.log('Stopping gamepad control...');
    stopSending();
  }, [stopSending]);

  const contextValue: GamepadContextType = {
    isGamepadConnected,
    isGamepadSending,
    connectedGamepads,
    gamepadState: {
      throttle: gamepadState.throttle,
      steering: gamepadState.steering,
      buttons: gamepadState.buttons
    },
    startGamepadControl,
    stopGamepadControl
  };

  return (
    <GamepadContext.Provider value={contextValue}>
      {children}
    </GamepadContext.Provider>
  );
};

export default GamepadContext;