import { useContext } from 'react';
import GamepadContext from '../contexts/GamepadContext';

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

export const useGamepadControl = (): GamepadContextType => {
  const context = useContext(GamepadContext);
  if (!context) {
    throw new Error('useGamepadControl must be used within GamepadProvider');
  }
  return context;
};