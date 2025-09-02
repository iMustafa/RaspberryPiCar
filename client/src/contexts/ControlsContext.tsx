import React, { createContext, useState } from 'react';
import { ControlsContextType } from '../types';

const ControlsContext = createContext<ControlsContextType | null>(null);

export const ControlsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showControls, setShowControls] = useState(false);

  return (
    <ControlsContext.Provider value={{ showControls, setShowControls }}>
      {children}
    </ControlsContext.Provider>
  );
};

export default ControlsContext;