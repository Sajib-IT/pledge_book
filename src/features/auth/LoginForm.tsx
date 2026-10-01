import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from './AuthContext';
import { useI18n } from '../../lib/i18n';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { ShieldCheck, UserCheck, AlertCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const loginSchema = z.object({
  email: z.string().min(3, 'Email or phone is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginForm: React.FC = () => {
  const { login, isMockMode } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'ashiksajib19@gmail.com',
      password: '123456',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setErrorMsg(null);
    const result = await login(data.email, data.password);
    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setErrorMsg(result.error || t('auth.invalid_credentials'));
    }
  };

  const handleQuickFill = (role: 'owner' | 'staff') => {
    if (role === 'owner') {
      setValue('email', 'ashiksajib19@gmail.com');
      setValue('password', '123456');
    } else {
      setValue('email', 'staff@pledgebook.com');
      setValue('password', 'password123');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-emerald-50/20 to-slate-100">
      <div className="w-full max-w-md">
        {/* App Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex w-16 h-16 rounded-2xl overflow-hidden shadow-xl shadow-emerald-700/25 mb-3 border border-emerald-600/30">
            <img src="/app-icon.jpg" alt="PledgeBook Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {t('app_name')}
          </h1>
          <p className="text-sm text-emerald-800 font-medium mt-0.5">
            {t('tagline')}
          </p>
        </div>

        <Card className="border-slate-200/90 shadow-xl shadow-slate-200/50">
          <CardHeader className="text-center">
            <CardTitle>{t('auth.login_title')}</CardTitle>
            <CardDescription>{t('auth.login_subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label={t('auth.email_or_phone')}
                type="text"
                placeholder="owner@pledgebook.com"
                {...register('email')}
                error={errors.email?.message}
              />

              <Input
                label={t('auth.password')}
                type="password"
                placeholder="••••••••"
                {...register('password')}
                error={errors.password?.message}
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-2"
                isLoading={isSubmitting}
              >
                {t('auth.login_btn')}
              </Button>
            </form>

            {/* Quick Demo Switcher */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center mb-3">
                {isMockMode ? '🧪 ডেমো টেস্ট অ্যাকাউন্ট (ক্লিক করুন)' : 'পরীক্ষামূলক লগইন'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickFill('owner')}
                  className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-800 text-xs font-bold transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t('auth.role_owner')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('staff')}
                  className="flex items-center justify-center gap-1.5 p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5 text-slate-600" />
                  <span>{t('auth.role_staff')}</span>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
