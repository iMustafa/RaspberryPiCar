import React, { createContext, useState, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { 
  WebRTCContextType, 
  JoinRoomData, 
  JoinedRoomData,
  UserJoinedData,
  UserLeftData,
  OfferData, 
  AnswerData, 
  IceCandidateData, 
  RemoteControlData,
  ErrorData
} from '../types';

const WebRTCContext = createContext<WebRTCContextType | null>(null);

export const WebRTCProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [role, setRole] = useState<'Controller' | 'Car' | null>(null);
  const [, setCurrentRoom] = useState<string | null>(null);
  const [users, setUsers] = useState<Record<string, any>>({});
  const [currentCall, setCurrentCall] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [targetUserRole, setTargetUserRole] = useState<'Controller' | 'Car' | null>(null);
  
  const socket = useRef<typeof Socket | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to find target user by role
  const findTargetUserByRole = useCallback((targetRole: 'Controller' | 'Car'): string | null => {
    for (const [userId, user] of Object.entries(users)) {
      if (user.userInfo?.role === targetRole) {
        return userId;
      }
    }
    return null;
  }, [users]);

  const setupPeerConnection = useCallback((targetUserId?: string) => {
    const configuration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };
    
    pc.current = new RTCPeerConnection(configuration);
    
    pc.current.onicecandidate = (event) => {
      if (event.candidate && socket.current) {
        const userId = targetUserId || currentCall;
        if (userId) {
          socket.current.emit('ice-candidate', {
            targetUserId: userId,
            candidate: {
              candidate: event.candidate.candidate,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              sdpMid: event.candidate.sdpMid
            }
          });
          console.log('Sent ICE candidate to:', userId);
        }
      }
    };
    
    pc.current.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    // Monitor ICE connection state for reconnection
    pc.current.oniceconnectionstatechange = () => {
      const state = pc.current?.iceConnectionState;
      console.log('ICE connection state changed to:', state);
      
      switch (state) {
        case 'connected':
        case 'completed':
          console.log('ICE connection established');
          setIsReconnecting(false);
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
          break;
          
        case 'disconnected':
          console.log('ICE connection disconnected, attempting reconnection...');
          handleReconnection(targetUserId);
          break;
          
        case 'failed':
          console.log('ICE connection failed, attempting reconnection...');
          handleReconnection(targetUserId);
          break;
          
        case 'closed':
          console.log('ICE connection closed');
          break;
          
        default:
          console.log('ICE connection state:', state);
      }
    };

    // Monitor connection state
    pc.current.onconnectionstatechange = () => {
      const state = pc.current?.connectionState;
      console.log('Connection state changed to:', state);
      
      if (state === 'failed') {
        console.log('Connection failed, attempting reconnection...');
        handleReconnection(targetUserId);
      }
    };
    
    return pc.current;
  }, [currentCall]);

  // Reconnection handler
  const handleReconnection = useCallback((targetUserId?: string) => {
    if (isReconnecting) {
      console.log('Reconnection already in progress, skipping...');
      return;
    }

    let userId = targetUserId || currentCall;
    
    // If we don't have a specific user ID, try to find by role
    if (!userId && targetUserRole) {
      const oppositeRole = targetUserRole === 'Controller' ? 'Car' : 'Controller';
      userId = findTargetUserByRole(oppositeRole);
      console.log('Found target user by role:', userId, 'for role:', oppositeRole);
    }
    
    if (!userId || !localStream) {
      console.log('userId', userId, 'localStream exists:', !!localStream);
      console.log('Cannot reconnect: missing target user or local stream');
      return;
    }

    console.log('Starting reconnection process for user:', userId);
    setIsReconnecting(true);

    // Clear any existing timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // Attempt reconnection with exponential backoff
    const attemptReconnect = (attempt: number = 1) => {
      const maxAttempts = 5;
      const baseDelay = 1000; // 1 second
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 30000); // Max 30 seconds

      console.log(`Reconnection attempt ${attempt}/${maxAttempts} in ${delay}ms`);

      reconnectTimeoutRef.current = setTimeout(async () => {
        try {
          // Close existing connection
          if (pc.current) {
            pc.current.close();
            pc.current = null;
          }

          // Wait a bit before reconnecting
          await new Promise(resolve => setTimeout(resolve, 500));

          // Re-establish connection based on role
          if (role === 'Controller') {
            // @ts-ignore
            await initiateCall(userId, localStream);
          } else {
            // For Car, we wait for the Controller to re-initiate
            console.log('Waiting for Controller to re-initiate call...');
          }

          // Check if reconnection was successful
          setTimeout(() => {
            if (pc.current?.iceConnectionState === 'connected' || 
                pc.current?.iceConnectionState === 'completed') {
              console.log('Reconnection successful!');
              setIsReconnecting(false);
            } else if (attempt < maxAttempts) {
              console.log('Reconnection failed, retrying...');
              attemptReconnect(attempt + 1);
            } else {
              console.log('Max reconnection attempts reached, giving up');
              setIsReconnecting(false);
              setCurrentCall(null);
              setRemoteStream(null);
            }
          }, 2000);

        } catch (error) {
          console.error('Reconnection attempt failed:', error);
          if (attempt < maxAttempts) {
            attemptReconnect(attempt + 1);
          } else {
            console.log('Max reconnection attempts reached, giving up');
            setIsReconnecting(false);
            setCurrentCall(null);
            setRemoteStream(null);
          }
        }
      }, delay);
    };

    attemptReconnect();
  }, [isReconnecting, currentCall, localStream, role, targetUserRole, findTargetUserByRole]);

  const connect = useCallback(async (selectedRole: 'Controller' | 'Car') => {
    try {
      setRole(selectedRole);
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setLocalStream(stream);
      
      // Setup Socket.IO connection
      socket.current = io('http://localhost:3000');
      
      socket.current.on('connect', () => {
        console.log('Connected to server with ID:', socket.current?.id);
        setIsConnected(true);
        
        // Join the VideoChannel room
        const joinData: JoinRoomData = {
          roomId: 'VideoChannel',
          userInfo: {
            name: selectedRole,
            role: selectedRole
          }
        };
        socket.current?.emit('join-room', joinData);
      });

      socket.current.on('disconnect', () => {
        console.log('Disconnected from server');
        setIsConnected(false);
        setCurrentRoom(null);
        setUsers({});
        setCurrentCall(null);
      });

      socket.current.on('joined-room', (data: JoinedRoomData) => {
        console.log('Joined room:', data.roomId);
        setCurrentRoom(data.roomId);
        const usersMap: Record<string, any> = {};
        data.users.forEach(user => {
          if (user.id !== socket.current?.id) {
            usersMap[user.id] = user;
          }
        });
        setUsers(usersMap);
      });

      socket.current.on('user-joined', (data: UserJoinedData) => {
        console.log('User joined:', data.userId, 'Role:', data.userInfo?.role);
        setUsers(prev => ({
          ...prev,
          [data.userId]: data
        }));
        
        // If we're a Controller and a Car joined, initiate the call
        if (selectedRole === 'Controller' && data.userInfo?.role === 'Car') {
          console.log('Controller initiating call to Car:', data.userId);
          initiateCall(data.userId, stream);
        }
      });

      socket.current.on('user-left', (data: UserLeftData) => {
        console.log('User left:', data.userId);
        setUsers(prev => {
          const newUsers = { ...prev };
          delete newUsers[data.userId];
          return newUsers;
        });
        
        if (currentCall === data.userId) {
          hangup();
        }
      });

      socket.current.on('offer', async (data: OfferData) => {
        console.log('Received offer from:', data.fromUserId);
        setCurrentCall(data.fromUserId);
        await handleOffer(data, stream);
      });

      socket.current.on('answer', async (data: AnswerData) => {
        console.log('Received answer from:', data.targetUserId);
        await handleAnswer(data);
      });

      socket.current.on('ice-candidate', async (data: IceCandidateData) => {
        console.log('Received ICE candidate from:', data.targetUserId);
        await handleIceCandidate(data);
      });

      socket.current.on('error', (data: ErrorData) => {
        console.error('Socket error:', data.message);
      });
      
    } catch (error) {
      console.error('Error connecting:', error);
    }
  }, [setupPeerConnection, currentCall]);

  // Helper functions for WebRTC handling
  const initiateCall = useCallback(async (targetUserId: string, stream: MediaStream) => {
    try {
      setCurrentCall(targetUserId);
      
      // Find and track the target user's role
      const targetUser = users[targetUserId];
      if (targetUser?.userInfo?.role) {
        setTargetUserRole(targetUser.userInfo.role);
      }
      
      // Close existing connection if any
      if (pc.current) {
        pc.current.close();
        pc.current = null;
      }
      
      setupPeerConnection(targetUserId);
      
      if (!pc.current) {
        throw new Error('Failed to create peer connection');
      }
      
      const peerConnection = pc.current as RTCPeerConnection;
      
      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      // Create offer
      const offer = await peerConnection.createOffer();
      if (offer) {
        await peerConnection.setLocalDescription(offer);
        socket.current?.emit('offer', {
          targetUserId,
          offer: {
            type: offer.type,
            sdp: offer.sdp
          }
        });
        console.log('Sent offer to:', targetUserId);
      }
    } catch (error) {
      console.error('Error initiating call:', error);
      setCurrentCall(null);
      setTargetUserRole(null);
    }
  }, [setupPeerConnection, users]);

  const handleOffer = useCallback(async (data: OfferData, stream: MediaStream) => {
    try {
      setCurrentCall(data.fromUserId);
      
      // Find and track the target user's role
      const targetUser = users[data.fromUserId];
      if (targetUser?.userInfo?.role) {
        setTargetUserRole(targetUser.userInfo.role);
      }
      
      // Close existing connection if any
      if (pc.current) {
        pc.current.close();
        pc.current = null;
      }
      
      setupPeerConnection(data.fromUserId);
      
      if (!pc.current) {
        throw new Error('Failed to create peer connection');
      }
      
      const peerConnection = pc.current as RTCPeerConnection;
      
      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      await peerConnection.setRemoteDescription(new RTCSessionDescription({
        type: data.offer.type as RTCSdpType,
        sdp: data.offer.sdp
      }));
      const answer = await peerConnection.createAnswer();
      if (answer) {
        await peerConnection.setLocalDescription(answer);
        socket.current?.emit('answer', {
          targetUserId: data.fromUserId,
          answer: {
            type: answer.type,
            sdp: answer.sdp
          }
        });
        console.log('Sent answer to:', data.fromUserId);
      }
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }, [setupPeerConnection, users]);

  const handleAnswer = useCallback(async (data: AnswerData) => {
    try {
      await pc.current?.setRemoteDescription(new RTCSessionDescription({
        type: data.answer.type as RTCSdpType,
        sdp: data.answer.sdp
      }));
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }, []);

  const handleIceCandidate = useCallback(async (data: IceCandidateData) => {
    try {
      await pc.current?.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }, []);

  const hangup = useCallback(() => {
    if (pc.current) {
      pc.current.close();
      pc.current = null;
    }
    setCurrentCall(null);
    setRemoteStream(null);
    setIsReconnecting(false);
    setTargetUserRole(null);
    
    // Clear any pending reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (role === 'Controller' && socket.current) {
      const remoteControlData: RemoteControlData = {
        action: 'toggle-video',
        room: 'VideoChannel'
      };
      socket.current.emit('remote-control', remoteControlData);
    } else if (role === 'Car' && localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, [role, localStream]);

  const toggleAudio = useCallback(() => {
    if (role === 'Controller' && socket.current) {
      const remoteControlData: RemoteControlData = {
        action: 'toggle-audio',
        room: 'VideoChannel'
      };
      socket.current.emit('remote-control', remoteControlData);
    } else if (role === 'Car' && localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, [role, localStream]);

  const disconnect = useCallback(() => {
    localStream?.getTracks().forEach(track => track.stop());
    hangup();
    socket.current?.disconnect();
    
    setLocalStream(null);
    setRemoteStream(null);
    setIsConnected(false);
    setRole(null);
    setIsVideoEnabled(true);
    setIsAudioEnabled(true);
    setCurrentRoom(null);
    setUsers({});
    setCurrentCall(null);
    setIsReconnecting(false);
    setTargetUserRole(null);
    
    // Clear any pending reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, [localStream, hangup]);

  return (
    <WebRTCContext.Provider value={{
      localStream,
      remoteStream,
      isConnected,
      isVideoEnabled,
      isAudioEnabled,
      role,
      isReconnecting,
      connect,
      toggleVideo,
      toggleAudio,
      disconnect,
      socket: socket.current
    }}>
      {children}
    </WebRTCContext.Provider>
  );
};

export default WebRTCContext;