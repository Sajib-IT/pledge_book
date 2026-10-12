import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from './AuthContext';
import { useI18n } from '../../lib/i18n';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { AlertCircle, CheckCircle2, Globe, ArrowLeft, Mail, KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';

const forgotPasswordSchema = z.object({
  email: z.string().email('সঠিক ইমেইল অ্যাড্রেস লিখুন / Enter a valid email'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export const ForgotPasswordPage: React.FC = () => {
  const { sendPasswordResetEmail, isMockMode } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const emailValue = watch('email');

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setErrorMsg(null);
    const result = await sendPasswordResetEmail(data.email);
    if (result.success) {
      setIsSuccess(true);
    } else {
      const err = result.error || 'Failed to send reset link';
      if (err.toLowerCase().includes('rate limit')) {
        setErrorMsg(
          language === 'bn'
            ? 'ইমেইল পাঠানোর সীমা অতিক্রম হয়েছে (Email rate limit exceeded)। Supabase ফ্রি টিয়ারে ঘন্টায় সর্বোচ্চ ৩-৪টি ইমেইল পাঠানো যায়। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করে আবার চেষ্টা করুন অথবা Supabase ড্যাশবোর্ডে Custom SMTP যুক্ত করুন।'
            : 'Email rate limit exceeded. The default Supabase mailer allows only 3-4 emails per hour. Please wait a while or connect a custom SMTP provider in Supabase.'
        );
      } else {
        setErrorMsg(err);
      }
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
              <KeyRound className="w-6 h-6" />
            </div>
            <CardTitle>{t('auth.forgot_password_title')}</CardTitle>
            <CardDescription>{t('auth.forgot_password_subtitle')}</CardDescription>
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
                        {language === 'bn' ? 'লিংক পাঠানো হয়েছে!' : 'Link Sent!'}
                      </p>
                      <p className="mt-1 text-slate-700 leading-relaxed">
                        {t('auth.reset_link_sent')}
                      </p>
                      <p className="mt-2 font-mono text-[11px] text-emerald-800 font-bold bg-white/70 px-2 py-1 rounded border border-emerald-200 inline-block">
                        {emailValue}
                      </p>
                    </div>
                  </div>
                </div>

                {isMockMode && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                    <p className="font-bold mb-1">
                      {language === 'bn' ? '💡 ডেমো মোড নির্দেশনা' : '💡 Demo Mode Notice'}
                    </p>
                    <p className="text-amber-800 mb-2">
                      {language === 'bn'
                        ? 'আপনি ডেমো মোডে আছেন। সরাসরি নিচের বাটনে ক্লিক করে নতুন পাসওয়ার্ড নির্ধারণ টেস্ট করতে পারেন।'
                        : 'You are in demo mode. Click below to test setting a new password directly.'}
                    </p>
                    <Link
                      to="/reset-password"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-colors shadow-2xs"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'সরাসরি পাসওয়ার্ড পরিবর্তন করুন' : 'Go to Reset Password'}</span>
                    </Link>
                  </div>
                )}

                <div className="pt-2 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>{t('auth.back_to_login')}</span>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label={t('auth.email')}
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  {...register('email')}
                  error={errors.email?.message}
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full mt-2"
                  isLoading={isSubmitting}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {t('auth.send_reset_link')}
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
