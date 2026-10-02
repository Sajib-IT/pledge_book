import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from './AuthContext';
import { useI18n } from '../../lib/i18n';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { AlertCircle, Globe, LogIn } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';

const loginSchema = z.object({
  email: z.string().min(3, 'ইমেইল বা ফোন নম্বর দিন / Enter email or phone'),
  password: z.string().min(6, 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে / Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginForm: React.FC = () => {
  const { login, user, isLoading } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';

  // If already logged in, redirect
  useEffect(() => {
    if (user && !isLoading) {
      navigate(from, { replace: true });
    }
  }, [user, isLoading, navigate, from]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
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

  const toggleLanguage = () => {
    setLanguage(language === 'bn' ? 'en' : 'bn');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-emerald-50/20 to-slate-100 relative">
      {/* Language Toggle in top right */}
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white/80 hover:bg-white text-xs font-semibold text-slate-700 shadow-xs transition-all"
        >
          <Globe className="w-3.5 h-3.5 text-emerald-600" />
          <span>{language === 'bn' ? 'English' : 'বাংলা'}</span>
        </button>
      </div>

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
          <CardHeader className="text-center pb-2">
            <CardTitle>{t('auth.login_title')}</CardTitle>
            <CardDescription>{t('auth.login_subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
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
                placeholder="name@example.com"
                autoComplete="username"
                {...register('email')}
                error={errors.email?.message}
              />

              <Input
                label={t('auth.password')}
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
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
                <LogIn className="w-4 h-4 mr-2" />
                {t('auth.login_btn')}
              </Button>
            </form>

            {/* Link to Registration */}
            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-600">
                {t('auth.no_account')}{' '}
                <Link
                  to="/register"
                  className="font-bold text-emerald-700 hover:text-emerald-800 hover:underline transition-colors ml-1"
                >
                  {t('auth.go_to_register')}
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
