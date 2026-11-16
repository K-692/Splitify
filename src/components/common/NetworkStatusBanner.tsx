import React, { useState, useEffect } from 'react';
import { Network } from '@capacitor/network';
import { WifiOff, RefreshCw } from 'lucide-react';

export const NetworkStatusBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    // Check initial network status
    async function checkInitial() {
      try {
        const status = await Network.getStatus();
        if (isMounted) setIsOnline(status.connected);
      } catch {
        if (isMounted) setIsOnline(navigator.onLine);
      }
    }

    checkInitial();

    // Listen to network changes via Capacitor
    const statusHandle = Network.addListener('networkStatusChange', (status) => {
      if (isMounted) setIsOnline(status.connected);
    });

    // Web fallback listeners
    const handleOnline = () => {
      if (isMounted) setIsOnline(true);
    };
    const handleOffline = () => {
      if (isMounted) setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isMounted = false;
      statusHandle.then((h) => h.remove());
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = async () => {
    setIsChecking(true);
    try {
      const status = await Network.getStatus();
      setIsOnline(status.connected);
    } catch {
      setIsOnline(navigator.onLine);
    } finally {
      setTimeout(() => setIsChecking(false), 500);
    }
  };

  if (isOnline) return null;

  return (
    <div className="fixed top-16 left-0 right-0 z-50 bg-rose-600 text-white px-4 py-2.5 shadow-lg flex items-center justify-between text-xs sm:text-sm font-bold animate-in slide-in-from-top duration-200">
      <div className="flex items-center gap-2 max-w-4xl mx-auto flex-1 min-w-0 pr-2">
        <WifiOff className="w-4 h-4 flex-shrink-0 animate-pulse text-rose-200" />
        <span className="truncate">
          Connection lost. Splitify operates in online mode only. Please check your internet connection.
        </span>
      </div>

      <button
        onClick={handleRetry}
        disabled={isChecking}
        className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-colors flex-shrink-0"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
        <span>{isChecking ? 'Checking...' : 'Retry'}</span>
      </button>
    </div>
  );
};
