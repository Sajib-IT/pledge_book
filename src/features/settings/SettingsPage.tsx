import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useAppLock } from '../auth/AppLockContext';
import { useI18n } from '../../lib/i18n';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Globe, Shield, Store, LogOut, Check, Lock, KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const SettingsPage: React.FC = () => {
  const { profile, role, isOwner, logout, switchDemoRole } = useAuth();
  const { isLockEnabled, enableLock, disableLock, lockApp } = useAppLock();
  const { language, setLanguage, t } = useI18n();
  const [defaultRate, setDefaultRate] = useState<string>('25.00');
  const [savedRateSuccess, setSavedRateSuccess] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSaveRate = () => {
    localStorage.setItem('default_interest_rate', defaultRate);
    setSavedRateSuccess(true);
    setTimeout(() => setSavedRateSuccess(false), 2000);
  };

  const handleLogout = async () => {
    if (window.confirm(t('settings.logout_confirm'))) {
      await logout();
      navigate('/login');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 md:pb-8">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          {t('settings.title')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          সিস্টেম ও ব্যবসায়িক সেটিংস কনফিগারেশন
        </p>
      </div>

      {/* Language Setting */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-600" />
            <CardTitle>{t('settings.language')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setLanguage('bn')}
              className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-between transition-all ${
                language === 'bn'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <span>{t('settings.language_bn')}</span>
              {language === 'bn' && <Check className="w-4 h-4 text-emerald-600" />}
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-between transition-all ${
                language === 'en'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <span>{t('settings.language_en')}</span>
              {language === 'en' && <Check className="w-4 h-4 text-emerald-600" />}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Default Interest Rate (Owner Only) */}
      {isOwner && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-emerald-600" />
              <CardTitle>{t('settings.default_interest_rate')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  type="number"
                  step="0.5"
                  value={defaultRate}
                  onChange={(e) => setDefaultRate(e.target.value)}
                  placeholder="25.00"
                />
              </div>
              <Button onClick={handleSaveRate} variant="primary">
                {t('common.save')}
              </Button>
            </div>
            {savedRateSuccess && (
              <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> ডিফল্ট হার সংরক্ষিত হয়েছে
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* App PIN / Biometric Lock */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-600" />
            <CardTitle>{t('settings.app_lock')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-slate-500">
            {t('settings.app_lock_desc')}
          </p>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-sm font-bold text-slate-800">
              নিরাপত্তা লক {isLockEnabled ? 'চালু আছে' : 'বন্ধ আছে'}
            </span>
            <button
              type="button"
              onClick={async () => {
                if (isLockEnabled) {
                  await disableLock();
                } else {
                  if (newPin.length === 4) {
                    await enableLock(newPin);
                  } else {
                    alert('প্রথমে ৪ ডিজিটের একটি পিন নম্বর লিখুন');
                  }
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                isLockEnabled
                  ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {isLockEnabled ? 'বন্ধ করুন' : 'চালু করুন'}
            </button>
          </div>

          <div className="space-y-2 pt-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
              <span>৪ ডিজিটের নতুন পিন সেট করুন</span>
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="password"
                maxLength={4}
                placeholder="যেমন: ১২৩৪"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                className="font-mono text-center tracking-widest text-base"
              />
              <Button
                type="button"
                variant="primary"
                onClick={async () => {
                  if (newPin.length === 4) {
                    await enableLock(newPin);
                    setPinSuccess(true);
                    setTimeout(() => setPinSuccess(false), 2000);
                  } else {
                    alert('সঠিক ৪ ডিজিটের পিন নম্বর দিন');
                  }
                }}
              >
                {t('common.save')}
              </Button>
            </div>
            {pinSuccess && (
              <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> পিন সফলভাবে সংরক্ষিত হয়েছে
              </p>
            )}
          </div>

          {isLockEnabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={lockApp}
              className="w-full text-xs text-slate-700 border-slate-300 gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>অ্যাপ লক পরীক্ষা করুন (Lock Now)</span>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Demo / Mock Role Switcher */}
      <Card className="border-indigo-100 bg-indigo-50/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            <CardTitle>ব্যবহারকারী ভূমিকা (Role Switcher)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-slate-600">
            বর্তমান সক্রিয় প্রোফাইল: <strong className="text-slate-900">{profile?.name}</strong> ({role})
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant={role === 'owner' ? 'primary' : 'outline'}
              onClick={() => switchDemoRole('owner')}
            >
              মালিক (Owner Role)
            </Button>
            <Button
              type="button"
              variant={role === 'staff' ? 'primary' : 'outline'}
              onClick={() => switchDemoRole('staff')}
            >
              কর্মচারী (Staff Role)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logout Button */}
      <Button
        type="button"
        variant="destructive"
        className="w-full h-11 text-sm font-bold gap-2"
        onClick={handleLogout}
      >
        <LogOut className="w-4 h-4" />
        <span>{t('auth.logout')}</span>
      </Button>
    </div>
  );
};
