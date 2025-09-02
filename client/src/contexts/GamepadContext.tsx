import React, { createContext, useState, useRef, useCallback, useEffect, useMemo } from 'react';
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
  const [gamepadUsers, setGamepadUsers] = useState<Record<string, any>>({});

  const gamepadChannelRef = useRef<RTCDataChannel | null>(null);
  const gamepadPeerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const piUser = useMemo(() => {
    return Object.values(gamepadUsers).find((user: any) => user.userInfo?.role === 'Pi');
  }, [gamepadUsers])

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

  // Handle ICE candidates separately to avoid closure issues
  useEffect(() => {
    if (!gamepadPeerConnectionRef.current || !socket || role !== 'Controller') return;

    const handleIceCandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate && socket) {
        // Find the Car user in the GamepadChannel
        if (piUser) {
          console.log('Sending gamepad ICE candidate to:', piUser.userId);
          socket.emit('gamepad-ice-candidate', {
            targetUserId: piUser.userId,
            candidate: {
              candidate: event.candidate.candidate,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              sdpMid: event.candidate.sdpMid
            }
          });
        }
      }
    };

    gamepadPeerConnectionRef.current.onicecandidate = handleIceCandidate;

    return () => {
      if (gamepadPeerConnectionRef.current) {
        gamepadPeerConnectionRef.current.onicecandidate = null;
      }
    };
  }, [gamepadUsers, socket, role]);

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

  // Track users in GamepadChannel
  useEffect(() => {
    if (!socket || role !== 'Controller') return;

    const handleJoinedRoom = (data: any) => {
      if (data.roomId === 'GamepadChannel') {
        console.log('Joined GamepadChannel, users:', data.users);
        const usersMap: Record<string, any> = {};
        data.users.forEach((user: any) => {
          if (user.id !== socket.id) {
            usersMap[user.id] = user;
          }
        });
        setGamepadUsers(usersMap);
      }
    };

    const handleUserJoined = (data: any) => {
      console.log('User joined GamepadChannel:', data.userId, data);
      setGamepadUsers(prev => ({
        ...prev,
        [data.userId]: data
      }));
    };

    const handleUserLeft = (data: any) => {
      console.log('User left GamepadChannel:', data.userId);
      setGamepadUsers(prev => {
        const newUsers = { ...prev };
        delete newUsers[data.userId];
        return newUsers;
      });
    };

    socket.on('joined-room', handleJoinedRoom);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);

    return () => {
      socket.off('joined-room', handleJoinedRoom);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
    };
  }, [socket, role]);

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

  // Send gamepad offer when Car user joins GamepadChannel
  useEffect(() => {
    if (role === 'Controller' && gamepadPeerConnectionRef.current && socket) {
      if (piUser && !isGamepadChannelReady) {
        console.log('Car user found in GamepadChannel, sending gamepad offer to:', piUser.userId);

        // Create and send offer
        gamepadPeerConnectionRef.current.createOffer()
          .then(async (offer) => {
            await gamepadPeerConnectionRef.current!.setLocalDescription(offer);
            socket.emit('gamepad-offer', {
              targetUserId: piUser.userId,
              offer: {
                type: offer.type,
                sdp: offer.sdp
              }
            });
            console.log('Sent gamepad offer to:', piUser.userId);
          })
          .catch((error) => {
            console.error('Error creating gamepad offer:', error);
          });
      }
    }
  }, [gamepadUsers, role, socket, isGamepadChannelReady, piUser]);

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

  // Auto-start gamepad control when channel is ready
  useEffect(() => {
    if (role === 'Controller' && isGamepadChannelReady && isGamepadConnected && !isGamepadSending) {
      console.log('Auto-starting gamepad control - channel is ready!');
      startSending();
    }
  }, [role, isGamepadChannelReady, isGamepadConnected, isGamepadSending, startSending]);

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