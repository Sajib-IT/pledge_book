// src/features/auth/AppLockContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';

interface AppLockContextType {
  isLocked: boolean;
  isLockEnabled: boolean;
  hasPin: boolean;
  enableLock: (pin: string) => Promise<void>;
  disableLock: () => Promise<void>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  lockApp: () => void;
}

const AppLockContext = createContext<AppLockContextType | null>(null);

const PIN_KEY = 'user_app_pin';
const LOCK_ENABLED_KEY = 'app_lock_enabled';

export const AppLockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isLockEnabled, setIsLockEnabled] = useState<boolean>(false);
  const [hasPin, setHasPin] = useState<boolean>(false);

  useEffect(() => {
    // Load lock preferences on mount
    const checkLockStatus = async () => {
      try {
        const { value: enabled } = await Preferences.get({ key: LOCK_ENABLED_KEY });
        const { value: pin } = await Preferences.get({ key: PIN_KEY });

        const isEnabled = enabled === 'true' && Boolean(pin);
        setIsLockEnabled(isEnabled);
        setHasPin(Boolean(pin));

        // If enabled on fresh launch, start in locked state
        if (isEnabled) {
          setIsLocked(true);
        }
      } catch (err) {
        console.warn('Error reading lock preferences:', err);
      }
    };

    checkLockStatus();

    // Listen to background / foreground app state transitions
    let appStateListener: any;
    try {
      appStateListener = CapApp.addListener('appStateChange', async (state) => {
        const { value: enabled } = await Preferences.get({ key: LOCK_ENABLED_KEY });
        const { value: pin } = await Preferences.get({ key: PIN_KEY });

        if (enabled === 'true' && Boolean(pin)) {
          if (!state.isActive) {
            // App went to background
            setIsLocked(true);
          }
        }
      });
    } catch (err) {
      console.warn('CapApp listener not active in web mode:', err);
    }

    // Also support web visibilitychange
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        const { value: enabled } = await Preferences.get({ key: LOCK_ENABLED_KEY });
        const { value: pin } = await Preferences.get({ key: PIN_KEY });
        if (enabled === 'true' && Boolean(pin)) {
          setIsLocked(true);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (appStateListener?.remove) appStateListener.remove();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const enableLock = async (pin: string) => {
    await Preferences.set({ key: PIN_KEY, value: pin });
    await Preferences.set({ key: LOCK_ENABLED_KEY, value: 'true' });
    setIsLockEnabled(true);
    setHasPin(true);
  };

  const disableLock = async () => {
    await Preferences.remove({ key: PIN_KEY });
    await Preferences.set({ key: LOCK_ENABLED_KEY, value: 'false' });
    setIsLockEnabled(false);
    setHasPin(false);
    setIsLocked(false);
  };

  const unlockWithPin = async (enteredPin: string): Promise<boolean> => {
    try {
      const { value: storedPin } = await Preferences.get({ key: PIN_KEY });
      if (storedPin && storedPin === enteredPin) {
        setIsLocked(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const lockApp = () => {
    if (isLockEnabled) {
      setIsLocked(true);
    }
  };

  return (
    <AppLockContext.Provider
      value={{
        isLocked,
        isLockEnabled,
        hasPin,
        enableLock,
        disableLock,
        unlockWithPin,
        lockApp,
      }}
    >
      {children}
    </AppLockContext.Provider>
  );
};

export const useAppLock = (): AppLockContextType => {
  const context = useContext(AppLockContext);
  if (!context) {
    throw new Error('useAppLock must be used within an AppLockProvider');
  }
  return context;
};
