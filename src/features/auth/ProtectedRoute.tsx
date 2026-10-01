// src/features/auth/ProtectedRoute.tsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useI18n } from '../../lib/i18n';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../../components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'owner';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { user, role, isLoading } = useAuth();
  const { t } = useI18n();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner fullPage message={t('common.loading')} />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole === 'owner' && role !== 'owner') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">{t('auth.access_denied')}</h2>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          এই সেকশনটি শুধুমাত্র প্রতিষ্ঠানের মালিক (Owner) এর জন্য সংরক্ষিত।
        </p>
        <Button onClick={() => window.history.back()} variant="outline">
          {t('common.back')}
        </Button>
      </div>
    );
  }

  return <>{children}</>;
};
