import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from './AuthContext';
import { useI18n } from '../../lib/i18n';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { AlertCircle, CheckCircle2, Globe, Shield, User, UserPlus } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import type { UserRole } from '../../types/database';

const registerSchema = z
  .object({
    name: z.string().min(2, 'পুরো নাম লিখুন (কমপক্ষে ২ অক্ষর) / Full name is required'),
    email: z.string().email('সঠিক ইমেইল অ্যাড্রেস লিখুন / Valid email is required'),
    phone: z.string().optional(),
    role: z.enum(['owner', 'staff']),
    password: z.string().min(6, 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে / Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'পাসওয়ার্ড নিশ্চিত করুন / Confirm password is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'পাসওয়ার্ড দুটি মেলেনি / Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export const RegisterForm: React.FC = () => {
  const { registerUser, user, isLoading } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);

  // If already logged in, redirect to home
  useEffect(() => {
    if (user && !isLoading) {
      navigate('/', { replace: true });
    }
  }, [user, isLoading, navigate]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      role: 'owner',
      password: '',
      confirmPassword: '',
    },
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: RegisterFormData) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const result = await registerUser({
      name: data.name,
      email: data.email,
      phone: data.phone,
      password: data.password,
      role: data.role as UserRole,
    });

    if (result.success) {
      if (result.requiresEmailConfirmation) {
        setNeedsVerification(true);
        setSuccessMsg(t('auth.reg_success_verify'));
      } else {
        setSuccessMsg(t('auth.reg_success'));
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1500);
      }
    } else {
      setErrorMsg(result.error || 'নিবন্ধন সম্পন্ন করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
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

      <div className="w-full max-w-lg my-8">
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
            <CardTitle>{t('auth.register_title')}</CardTitle>
            <CardDescription>{t('auth.register_subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {errorMsg && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-rose-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm text-emerald-900">
                      {needsVerification ? 'নিবন্ধন সফল হয়েছে!' : 'স্বাগতম!'}
                    </p>
                    <p className="mt-1 text-slate-700 leading-relaxed">{successMsg}</p>
                    {needsVerification && (
                      <Link
                        to="/login"
                        className="inline-block mt-3 px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-xs"
                      >
                        {t('auth.go_to_login')}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!needsVerification && (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Full Name */}
                <Input
                  label={t('auth.full_name')}
                  type="text"
                  placeholder={t('auth.full_name_placeholder')}
                  autoComplete="name"
                  {...register('name')}
                  error={errors.name?.message}
                />

                {/* Email & Phone in 2 cols on tablet+ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Input
                    label={t('auth.email')}
                    type="email"
                    placeholder={t('auth.email_placeholder')}
                    autoComplete="email"
                    {...register('email')}
                    error={errors.email?.message}
                  />

                  <Input
                    label={t('auth.phone')}
                    type="tel"
                    placeholder={t('auth.phone_placeholder')}
                    autoComplete="tel"
                    {...register('phone')}
                    error={errors.phone?.message}
                  />
                </div>

                {/* Role Selection */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    {t('auth.role')}
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setValue('role', 'owner')}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                        selectedRole === 'owner'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Shield className={`w-4 h-4 ${selectedRole === 'owner' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span>{t('auth.role_owner')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setValue('role', 'staff')}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                        selectedRole === 'staff'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <User className={`w-4 h-4 ${selectedRole === 'staff' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span>{t('auth.role_staff')}</span>
                    </button>
                  </div>
                </div>

                {/* Password & Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Input
                    label={t('auth.password')}
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    {...register('password')}
                    error={errors.password?.message}
                  />

                  <Input
                    label={t('auth.confirm_password')}
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    {...register('confirmPassword')}
                    error={errors.confirmPassword?.message}
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full mt-3"
                  isLoading={isSubmitting}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  {t('auth.register_btn')}
                </Button>
              </form>
            )}

            {/* Link to Login */}
            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-600">
                {t('auth.have_account')}{' '}
                <Link
                  to="/login"
                  className="font-bold text-emerald-700 hover:text-emerald-800 hover:underline transition-colors ml-1"
                >
                  {t('auth.go_to_login')}
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
