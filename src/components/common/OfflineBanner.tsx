import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { useI18n } from '../../lib/i18n';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const { t } = useI18n();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="bg-amber-600 text-white text-xs sm:text-sm font-medium px-4 py-2 flex items-center justify-center gap-2 shadow-md sticky top-0 z-50 animate-in slide-in-from-top">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>{t('common.offline_notice')}</span>
    </div>
  );
};
