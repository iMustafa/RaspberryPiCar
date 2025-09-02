import React from 'react';
import { useWebRTC } from '../hooks/useWebRTC';

const LandingPage: React.FC = () => {
  const { connect } = useWebRTC();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Video Stream</h1>
        <p className="text-gray-600 mb-8">Choose your role to get started</p>
        
        <div className="space-y-4">
          <button
            onClick={() => connect('Controller')}
            className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors duration-200 transform hover:scale-105"
          >
            Controller
          </button>
          
          <button
            onClick={() => connect('Car')}
            className="w-full py-4 px-6 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors duration-200 transform hover:scale-105"
          >
            Car
          </button>
        </div>
        
        <div className="mt-8 text-sm text-gray-500">
          <p>Room: VideoChannel</p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;