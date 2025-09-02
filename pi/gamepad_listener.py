#!/usr/bin/env python3
"""
Pi Gamepad Listener
Connects to the WebRTC signaling server and joins the GamepadChannel
to receive and log gamepad control messages.
"""

import asyncio
import socketio
import json
import struct
from datetime import datetime
from typing import Dict, Any
import aiortc
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate
from aiortc.contrib.signaling import object_from_string, object_to_string

class GamepadListener:
    def __init__(self, server_url: str = "http://localhost:3000"):
        self.server_url = server_url
        self.sio = socketio.AsyncClient()
        self.setup_handlers()
        self.connected = False
        self.room_id = "GamepadChannel"
        self.username = "Pi"
        self.pc = None
        self.data_channel = None
        self.controller_id = None
        
    def setup_handlers(self):
        """Setup Socket.IO event handlers"""
        
        @self.sio.event
        async def connect():
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Connected to server with ID: {self.sio.sid}")
            self.connected = True
            
            # Join the GamepadChannel room
            join_data = {
                "roomId": self.room_id,
                "userInfo": {
                    "name": self.username,
                    "role": "Car"  # Pi acts as the Car receiving gamepad commands
                }
            }
            await self.sio.emit('join-room', join_data)
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Joining room: {self.room_id}")
        
        @self.sio.event
        async def disconnect():
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Disconnected from server")
            self.connected = False
        
        @self.sio.event
        async def joined_room(data: Dict[str, Any]):
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Joined room: {data.get('roomId')}")
            users = data.get('users', [])
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Users in room: {len(users)}")
            for user in users:
                print(f"  - {user.get('id')}: {user.get('userInfo', {}).get('name', 'Anonymous')}")
        
        @self.sio.event
        async def user_joined(data: Dict[str, Any]):
            user_id = data.get('userId')
            user_info = data.get('userInfo', {})
            name = user_info.get('name', 'Anonymous')
            role = user_info.get('role', 'Unknown')
            print(f"[{datetime.now().strftime('%H:%M:%S')}] User joined: {user_id} ({name}) - Role: {role}")
        
        @self.sio.event
        async def user_left(data: Dict[str, Any]):
            user_id = data.get('userId')
            print(f"[{datetime.now().strftime('%H:%M:%S')}] User left: {user_id}")
        
        @self.sio.event
        async def offer(data: Dict[str, Any]):
            from_user = data.get('fromUserId')
            offer_data = data.get('offer')
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Received WebRTC offer from: {from_user}")
            
            # Since we're in GamepadChannel, this should be a gamepad offer
            if offer_data and from_user:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Processing offer as gamepad offer...")
                await self.handle_gamepad_offer(from_user, offer_data)
        
        @self.sio.event
        async def answer(data: Dict[str, Any]):
            from_user = data.get('fromUserId')
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Received WebRTC answer from: {from_user}")
        
        @self.sio.event
        async def ice_candidate(data: Dict[str, Any]):
            from_user = data.get('fromUserId')
            candidate_data = data.get('candidate')
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Received ICE candidate from: {from_user}")
            
            if self.pc and candidate_data:
                try:
                    candidate = RTCIceCandidate(
                        candidate=candidate_data['candidate'],
                        sdpMid=candidate_data.get('sdpMid'),
                        sdpMLineIndex=candidate_data.get('sdpMLineIndex')
                    )
                    await self.pc.addIceCandidate(candidate)
                except Exception as e:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Error adding ICE candidate: {e}")
        
        @self.sio.event
        async def message(data: Dict[str, Any]):
            from_user = data.get('fromUserId')
            message = data.get('message', '')
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Message from {from_user}: {message}")
        
        @self.sio.event
        async def error(data: Dict[str, Any]):
            error_msg = data.get('message', 'Unknown error')
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Error: {error_msg}")
    
    async def handle_gamepad_offer(self, from_user: str, offer_data: Dict[str, Any]):
        """Handle gamepad WebRTC offer"""
        try:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Handling gamepad offer from: {from_user}")
            
            # Create peer connection
            self.pc = RTCPeerConnection()
            self.controller_id = from_user
            
            # Handle ICE candidates
            @self.pc.on("icecandidate")
            async def on_icecandidate(candidate):
                if candidate:
                    candidate_data = {
                        'targetUserId': from_user,
                        'candidate': {
                            'candidate': candidate.candidate,
                            'sdpMid': candidate.sdpMid,
                            'sdpMLineIndex': candidate.sdpMLineIndex
                        }
                    }
                    await self.sio.emit('gamepad-ice-candidate', candidate_data)
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] Sent gamepad ICE candidate to: {from_user}")
            
            # Handle incoming data channel
            @self.pc.on("datachannel")
            def on_datachannel(channel):
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Gamepad data channel received: {channel.label}")
                self.data_channel = channel
                
                @channel.on("message")
                def on_message(message):
                    if isinstance(message, bytes):
                        self.log_gamepad_data(message)
                    else:
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] Received non-binary message: {message}")
            
            # Set remote description
            offer = RTCSessionDescription(sdp=offer_data['sdp'], type=offer_data['type'])
            await self.pc.setRemoteDescription(offer)
            
            # Create answer
            answer = await self.pc.createAnswer()
            await self.pc.setLocalDescription(answer)
            
            # Send answer back
            answer_data = {
                'targetUserId': from_user,
                'answer': {
                    'type': answer.type,
                    'sdp': answer.sdp
                }
            }
            await self.sio.emit('gamepad-answer', answer_data)
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Sent gamepad answer to: {from_user}")
            
        except Exception as e:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Error handling gamepad offer: {e}")
    
    def parse_gamepad_data(self, data: bytes) -> Dict[str, Any]:
        """
        Parse the 16-byte gamepad control frame
        Format: [seq(4), ts_ms(4), throttle(2), steering(2), buttons(2), flags(1), reserved(1)]
        """
        if len(data) != 16:
            return {"error": f"Invalid data length: {len(data)} bytes"}
        
        try:
            # Unpack as big-endian
            seq, ts_ms, throttle_int, steering_int, buttons, flags, reserved = struct.unpack('>IIhhHBB', data)
            
            # Convert int16 back to float (-1.0 to 1.0)
            throttle = throttle_int / 32767.0
            steering = steering_int / 32767.0
            
            # Parse button states
            button_states = []
            for i in range(16):  # Assuming max 16 buttons
                if buttons & (1 << i):
                    button_states.append(i)
            
            return {
                "sequence": seq,
                "timestamp_ms": ts_ms,
                "throttle": round(throttle, 3),
                "steering": round(steering, 3),
                "buttons": button_states,
                "flags": flags,
                "reserved": reserved
            }
        except struct.error as e:
            return {"error": f"Failed to parse data: {e}"}
    
    def log_gamepad_data(self, data: bytes):
        """Log received gamepad data in a readable format"""
        parsed = self.parse_gamepad_data(data)
        
        if "error" in parsed:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Gamepad Data Error: {parsed['error']}")
            return
        
        timestamp = datetime.fromtimestamp(parsed['timestamp_ms'] / 1000.0).strftime('%H:%M:%S.%f')[:-3]
        
        print(f"[{timestamp}] Gamepad Control Frame:")
        print(f"  Sequence: {parsed['sequence']}")
        print(f"  Throttle: {parsed['throttle']:6.3f} ({'Forward' if parsed['throttle'] > 0 else 'Reverse' if parsed['throttle'] < 0 else 'Neutral'})")
        print(f"  Steering: {parsed['steering']:6.3f} ({'Right' if parsed['steering'] > 0 else 'Left' if parsed['steering'] < 0 else 'Center'})")
        print(f"  Buttons:  {parsed['buttons'] if parsed['buttons'] else 'None'}")
        print(f"  Flags:    {parsed['flags']:02x}")
        print()
    
    async def connect_to_server(self):
        """Connect to the Socket.IO server"""
        try:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Connecting to {self.server_url}...")
            await self.sio.connect(self.server_url)
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Connected successfully!")
            return True
        except Exception as e:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Failed to connect: {e}")
            return False
    
    async def cleanup(self):
        """Cleanup resources"""
        if self.pc:
            await self.pc.close()
            self.pc = None
        if self.sio.connected:
            await self.sio.disconnect()

    async def run(self):
        """Main run loop"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Pi Gamepad Listener Starting...")
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Server: {self.server_url}")
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Room: {self.room_id}")
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Username: {self.username}")
        print("-" * 60)
        
        if await self.connect_to_server():
            try:
                # Keep the connection alive
                await self.sio.wait()
            except KeyboardInterrupt:
                print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Shutting down...")
            finally:
                await self.cleanup()
        else:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Failed to establish connection")

async def main():
    """Main entry point"""
    listener = GamepadListener()
    await listener.run()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Interrupted by user")
    except Exception as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Error: {e}")