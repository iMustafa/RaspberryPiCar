import React from 'react';
import { useGamepadControl } from '../hooks/useGamepadControl';
import { useWebRTC } from '../hooks/useWebRTC';

const GamepadControl: React.FC = () => {
  const { role } = useWebRTC();
  const {
    isGamepadConnected,
    isGamepadSending,
    connectedGamepads,
    gamepadState,
    startGamepadControl,
    stopGamepadControl
  } = useGamepadControl();

  // Only show for Controller role
  if (role !== 'Controller') {
    return null;
  }

  return (
    <div className="absolute top-20 left-6 bg-black bg-opacity-70 rounded-lg p-4 text-white min-w-[300px]" style={{ zIndex: 1000 }}>
      <h3 className="text-lg font-semibold mb-3">Gamepad Control</h3>
      
      {/* Connection Status */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-3 h-3 rounded-full ${isGamepadConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm">
            Gamepad: {isGamepadConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="text-xs text-gray-300">
          Connected gamepads: {connectedGamepads}
        </div>
      </div>

      {/* Control Status */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <div className={`w-3 h-3 rounded-full ${isGamepadSending ? 'bg-blue-500' : 'bg-gray-500'}`}></div>
          <span className="text-sm">
            Control: {isGamepadSending ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Gamepad State Display */}
      {isGamepadConnected && (
        <div className="mb-3 space-y-2">
          <div className="text-sm">
            <div className="flex justify-between">
              <span>Throttle:</span>
              <span className="font-mono">{gamepadState.throttle.toFixed(2)}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-1 relative">
              <div 
                className={`h-2 rounded-full ${gamepadState.throttle >= 0 ? 'bg-red-500' : 'bg-green-500'}`}
                style={{ 
                  width: `${Math.abs(gamepadState.throttle) * 50}%`,
                  marginLeft: gamepadState.throttle >= 0 ? '50%' : `${50 - Math.abs(gamepadState.throttle) * 50}%`
                }}
              ></div>
            </div>
          </div>
          
          <div className="text-sm">
            <div className="flex justify-between">
              <span>Steering:</span>
              <span className="font-mono">{gamepadState.steering.toFixed(2)}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-1 relative">
              <div 
                className="h-2 rounded-full bg-blue-500"
                style={{ 
                  width: `${Math.abs(gamepadState.steering) * 50}%`,
                  marginLeft: gamepadState.steering >= 0 ? '50%' : `${50 - Math.abs(gamepadState.steering) * 50}%`
                }}
              ></div>
            </div>
          </div>
          
          <div className="text-sm">
            <div className="flex justify-between">
              <span>Buttons:</span>
              <span className="font-mono">0x{gamepadState.buttons.toString(16).padStart(4, '0')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-2">
        <button
          onClick={startGamepadControl}
          disabled={!isGamepadConnected || isGamepadSending}
          className="flex-1 py-2 px-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
        >
          Start Control
        </button>
        <button
          onClick={stopGamepadControl}
          disabled={!isGamepadSending}
          className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
        >
          Stop Control
        </button>
      </div>
    </div>
  );
};

export default GamepadControl;