# Pi Gamepad Listener

This Python script connects to the WebRTC signaling server and joins the GamepadChannel to receive and log gamepad control messages.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Make sure the WebRTC signaling server is running on `http://localhost:3000`

3. Run the script:
```bash
python gamepad_listener.py
```

## What it does

- Connects to the Socket.IO server as user "Pi"
- Joins the "GamepadChannel" room
- Logs all Socket.IO events (user joins/leaves, WebRTC signaling)
- Parses and displays gamepad control data in a readable format

## Gamepad Data Format

The script expects 16-byte binary data frames with the following structure:
- Sequence number (4 bytes)
- Timestamp in milliseconds (4 bytes) 
- Throttle value as int16 (2 bytes)
- Steering value as int16 (2 bytes)
- Button states as uint16 (2 bytes)
- Flags (1 byte)
- Reserved (1 byte)

## Output Example

```
[14:30:25] Connected to server with ID: abc123
[14:30:25] Joining room: GamepadChannel
[14:30:25] Joined room: GamepadChannel
[14:30:25] Users in room: 1
  - def456: Controller
[14:30:26] User joined: def456 (Controller) - Role: Controller
[14:30:26] Received WebRTC offer from: def456
[14:30:26.123] Gamepad Control Frame:
  Sequence: 1
  Throttle:  0.250 (Forward)
  Steering: -0.100 (Left)
  Buttons:  [0, 2]
  Flags:    02
```