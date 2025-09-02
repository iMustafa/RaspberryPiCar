import { useEffect, useRef, useCallback, useState } from 'react';

interface GamepadState {
  connected: boolean;
  throttle: number;    // -1.0 to +1.0 from axis 1
  steering: number;    // -1.0 to +1.0 from axis 0
  buttons: number;     // Bitmask of pressed buttons
  timestamp: number;   // Last update timestamp
}

interface UseGamepadOptions {
  sendFrequency?: number;           // Hz, default 60
  onByteArray?: (data: ArrayBuffer) => void;  // Callback for binary data
  gamepadIndex?: number;            // Which gamepad to use, default 0
  deadzone?: number;               // Deadzone for axes, default 0.1
}

interface UseGamepadReturn {
  gamepadState: GamepadState;
  isConnected: boolean;
  connectedGamepads: number;
  startSending: () => void;
  stopSending: () => void;
  isSending: boolean;
}

export const useGamepad = (options: UseGamepadOptions = {}): UseGamepadReturn => {
  const {
    sendFrequency = 60,
    onByteArray,
    gamepadIndex = 0,
    deadzone = 0.1
  } = options;

  const [gamepadState, setGamepadState] = useState<GamepadState>({
    connected: false,
    throttle: 0,
    steering: 0,
    buttons: 0,
    timestamp: 0
  });

  const [connectedGamepads, setConnectedGamepads] = useState(0);
  const [isSending, setIsSending] = useState(false);

  const sequenceRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Apply deadzone to axis values
  const applyDeadzone = useCallback((value: number, deadzone: number): number => {
    if (Math.abs(value) < deadzone) return 0;
    
    // Scale the remaining range to maintain full -1 to +1 output
    const sign = Math.sign(value);
    const scaledValue = (Math.abs(value) - deadzone) / (1 - deadzone);
    return sign * scaledValue;
  }, []);

  // Convert float to 16-bit signed integer with scaling
  const floatToInt16 = useCallback((value: number): number => {
    // Clamp to -1.0 to +1.0 range
    const clamped = Math.max(-1, Math.min(1, value));
    // Scale to 16-bit signed integer range and round
    return Math.round(clamped * 32767);
  }, []);

  // Create 16-byte control frame
  const createControlFrame = useCallback((state: GamepadState): ArrayBuffer => {
    const buffer = new ArrayBuffer(16);
    const view = new DataView(buffer);
    
    // Increment sequence number
    sequenceRef.current = (sequenceRef.current + 1) & 0xFFFFFFFF;
    
    const now = Date.now();
    const throttleInt16 = floatToInt16(state.throttle);
    const steeringInt16 = floatToInt16(state.steering);
    
    // Pack data as big-endian
    view.setUint32(0, sequenceRef.current, false);        // seq (4 bytes)
    view.setUint32(4, now, false);                        // ts_ms (4 bytes)
    view.setInt16(8, throttleInt16, false);               // throttle (2 bytes)
    view.setInt16(10, steeringInt16, false);              // steering (2 bytes)
    view.setUint16(12, state.buttons, false);             // buttons (2 bytes)
    view.setUint8(14, 0x02);                              // flags (1 byte) - example value
    view.setUint8(15, 0x00);                              // reserved (1 byte)
    
    return buffer;
  }, [floatToInt16]);

  // Read gamepad state
  const updateGamepadState = useCallback(() => {
    const gamepads = navigator.getGamepads();
    let connectedCount = 0;
    
    // Count connected gamepads
    for (const gamepad of gamepads) {
      if (gamepad) connectedCount++;
    }
    setConnectedGamepads(connectedCount);
    
    const gamepad = gamepads[gamepadIndex];
    
    if (!gamepad) {
      setGamepadState(prev => ({
        ...prev,
        connected: false,
        timestamp: Date.now()
      }));
      return null;
    }

    // Extract axes with deadzone
    const steering = applyDeadzone(gamepad.axes[0] || 0, deadzone);
    const throttle = applyDeadzone(gamepad.axes[1] || 0, deadzone);
    
    // Create button bitmask
    let buttons = 0;
    gamepad.buttons.forEach((button, index) => {
      if (button.pressed && index < 16) { // Limit to 16 buttons for uint16
        buttons |= (1 << index);
      }
    });

    const newState: GamepadState = {
      connected: true,
      throttle,
      steering,
      buttons,
      timestamp: Date.now()
    };

    setGamepadState(newState);
    return newState;
  }, [gamepadIndex, applyDeadzone, deadzone]);

  // Send data at specified frequency
  const sendData = useCallback(() => {
    const state = updateGamepadState();
    if (state && state.connected && onByteArray) {
      const controlFrame = createControlFrame(state);
      onByteArray(controlFrame);
    }
  }, [updateGamepadState, createControlFrame, onByteArray]);

  // Start sending data
  const startSending = useCallback(() => {
    if (intervalRef.current) return; // Already sending
    
    setIsSending(true);
    const intervalMs = 1000 / sendFrequency;
    
    intervalRef.current = setInterval(() => {
      sendData();
    }, intervalMs);
  }, [sendData, sendFrequency]);

  // Stop sending data
  const stopSending = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsSending(false);
  }, []);

  // Continuous gamepad polling (for state updates even when not sending)
  const pollGamepad = useCallback(() => {
    updateGamepadState();
    animationFrameRef.current = requestAnimationFrame(pollGamepad);
  }, [updateGamepadState]);

  // Handle gamepad connect/disconnect events
  useEffect(() => {
    const handleGamepadConnected = (e: GamepadEvent) => {
      console.log('Gamepad connected:', e.gamepad.id);
    };

    const handleGamepadDisconnected = (e: GamepadEvent) => {
      console.log('Gamepad disconnected:', e.gamepad.id);
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    // Start polling
    animationFrameRef.current = requestAnimationFrame(pollGamepad);

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [pollGamepad]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSending();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [stopSending]);

  return {
    gamepadState,
    isConnected: gamepadState.connected,
    connectedGamepads,
    startSending,
    stopSending,
    isSending
  };
};
