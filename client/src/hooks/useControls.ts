import { useContext } from 'react';
import ControlsContext from '../contexts/ControlsContext';
import { ControlsContextType } from '../types';

export const useControls = (): ControlsContextType => {
  const context = useContext(ControlsContext);
  if (!context) {
    throw new Error('useControls must be used within ControlsProvider');
  }
  return context;
};