import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from './AuthContext';
import { useI18n } from '../../lib/i18n';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { AlertCircle, CheckCircle2, Globe, ArrowLeft, Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const resetPasswordSchema = z
  .object({
    password: z.string().min(6, 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে / Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'পাসওয়ার্ড নিশ্চিত করুন / Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'পাসওয়ার্ড দুটি মেলেনি / Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export const ResetPasswordPage: React.FC = () => {
  const { updatePassword } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setErrorMsg(null);
    const result = await updatePassword(data.password);
    if (result.success) {
      setIsSuccess(true);
    } else {
      setErrorMsg(result.error || 'Failed to update password');
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
            <img src="/app-icon.jpg" alt="Pledge Book Logo" className="w-full h-full object-cover" />
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
            <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 mb-2 shadow-2xs">
              <Lock className="w-6 h-6" />
            </div>
            <CardTitle>{t('auth.reset_password_title')}</CardTitle>
            <CardDescription>{t('auth.reset_password_subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {isSuccess ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-sm text-emerald-950">
                        {language === 'bn' ? 'সফলভাবে সম্পন্ন হয়েছে!' : 'Password Updated!'}
                      </p>
                      <p className="mt-1 text-slate-700 leading-relaxed">
                        {t('auth.password_updated_success')}
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={() => navigate('/login', { replace: true })}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {t('auth.go_to_login')}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label={t('auth.new_password')}
                  type="password"
                  placeholder={t('auth.new_password_placeholder')}
                  autoComplete="new-password"
                  showPasswordToggle={true}
                  {...register('password')}
                  error={errors.password?.message}
                />

                <Input
                  label={t('auth.confirm_password')}
                  type="password"
                  placeholder={t('auth.confirm_password_placeholder')}
                  autoComplete="new-password"
                  showPasswordToggle={true}
                  {...register('confirmPassword')}
                  error={errors.confirmPassword?.message}
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full mt-2"
                  isLoading={isSubmitting}
                >
                  <Lock className="w-4 h-4 mr-2" />
                  {t('auth.update_password_btn')}
                </Button>

                <div className="pt-3 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{t('auth.back_to_login')}</span>
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
