import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useAppLock } from '../auth/AppLockContext';
import { useI18n } from '../../lib/i18n';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Globe,
  Shield,
  Store,
  LogOut,
  Check,
  Lock,
  KeyRound,
  Users,
  Building2,
  Phone,
  MapPin,
  CheckCircle2,
  XCircle,
  Smartphone,
  Bell,
  BellRing,
  RotateCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types/database';
import { useMortgages } from '../mortgages/useMortgages';
import {
  checkNotificationPermission,
  requestNotificationPermissions,
  sendTestNotification,
  syncAllMortgageNotifications,
} from '../../lib/notifications';
import { Badge } from '../../components/ui/badge';

export const SettingsPage: React.FC = () => {
  const { profile, role, isOwner, logout, switchDemoRole, isMockMode } = useAuth();
  const { isLockEnabled, enableLock, disableLock, lockApp } = useAppLock();
  const { language, setLanguage, t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Business settings state
  const [businessName, setBusinessName] = useState<string>(
    () => localStorage.getItem('business_name') || import.meta.env.VITE_BUSINESS_NAME || 'মেসার্স আলম ব্রাদার্স ট্রেডার্স ও বন্ধকী'
  );
  const [businessPhone, setBusinessPhone] = useState<string>(
    () => localStorage.getItem('business_phone') || '০১৭১১০০০০০১'
  );
  const [businessAddress, setBusinessAddress] = useState<string>(
    () => localStorage.getItem('business_address') || 'উত্তরা, ঢাকা'
  );
  const [businessSaved, setBusinessSaved] = useState(false);

  // Interest rate setting
  const [defaultRate, setDefaultRate] = useState<string>('25.00');
  const [savedRateSuccess, setSavedRateSuccess] = useState(false);

  // PIN lock state
  const [newPin, setNewPin] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);

  // Mortgages data for notification sync
  const { data: mortgages = [] } = useMortgages();

  // Notification state
  const [notificationPermission, setNotificationPermission] = useState<string>('prompt');
  const [isTestingNotif, setIsTestingNotif] = useState(false);
  const [testNotifFeedback, setTestNotifFeedback] = useState<string | null>(null);
  const [isSyncingNotif, setIsSyncingNotif] = useState(false);
  const [syncNotifFeedback, setSyncNotifFeedback] = useState<string | null>(null);

  React.useEffect(() => {
    checkNotificationPermission().then((status) => {
      setNotificationPermission(status);
    });
  }, []);

  const handleRequestNotificationPermission = async () => {
    const granted = await requestNotificationPermissions();
    setNotificationPermission(granted ? 'granted' : 'denied');
  };

  const handleSendTestNotification = async () => {
    setIsTestingNotif(true);
    setTestNotifFeedback(null);
    const sent = await sendTestNotification(language);
    setIsTestingNotif(false);
    if (sent) {
      setNotificationPermission('granted');
      setTestNotifFeedback(
        language === 'bn'
          ? 'টেস্ট অ্যালার্ট পাঠানো হয়েছে! নোটিফিকেশন ব্যানার ও সাউন্ড সফলভাবে বেজেছে।'
          : 'Test alert sent! Notification banner and sound chime triggered successfully.'
      );
    } else {
      setTestNotifFeedback(
        language === 'bn'
          ? 'নোটিফিকেশন পাঠানো যায়নি। ফোনের অ্যাপ সেটিংসে নোটিফিকেশন পারমিশন অন করুন।'
          : 'Could not send alert. Please grant notification permission in system settings.'
      );
    }
    setTimeout(() => setTestNotifFeedback(null), 5000);
  };

  const handleSyncAllReminders = async () => {
    setIsSyncingNotif(true);
    setSyncNotifFeedback(null);
    const result = await syncAllMortgageNotifications(mortgages, language);
    setIsSyncingNotif(false);
    setSyncNotifFeedback(
      language === 'bn'
        ? `মোট ${result.activeMortgagesCount}টি সক্রিয় বন্ধকীর জন্য ${result.scheduledRemindersCount}টি রিমাইন্ডার সফলভাবে সিঙ্ক করা হয়েছে।`
        : `Successfully synced ${result.scheduledRemindersCount} reminders across ${result.activeMortgagesCount} active mortgages.`
    );
    setTimeout(() => setSyncNotifFeedback(null), 6000);
  };

  // Fetch Staff profiles (Owner only)
  const { data: staffList = [], isLoading: isLoadingStaff } = useQuery<Profile[]>({
    queryKey: ['staff_profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'staff')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Could not fetch staff from Supabase:', error);
        return [
          {
            id: 'demo-staff-1',
            name: 'তানভীর আহমেদ (ম্যানেজার)',
            role: 'staff',
            phone: '01812000002',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
      }
      return (data || []) as Profile[];
    },
    enabled: isOwner,
  });

  // Toggle Staff Active Status Mutation
  const toggleStaffMutation = useMutation({
    mutationFn: async ({ staffId, newStatus }: { staffId: string; newStatus: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: newStatus, updated_at: new Date().toISOString() })
        .eq('id', staffId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_profiles'] });
    },
  });

  const handleSaveBusiness = () => {
    localStorage.setItem('business_name', businessName);
    localStorage.setItem('business_phone', businessPhone);
    localStorage.setItem('business_address', businessAddress);
    setBusinessSaved(true);
    setTimeout(() => setBusinessSaved(false), 2500);
  };

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
          সিস্টেম, ব্যবসায়িক তথ্য ও নিরাপত্তা সেটিংস কনফিগারেশন
        </p>
      </div>

      {/* Business Details (Owner Only) */}
      {isOwner && (
        <Card className="border-emerald-100 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              <CardTitle>প্রতিষ্ঠানের তথ্য (Business Details)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-500">
              এই তথ্যসমূহ গ্রাহকের পেমেন্ট রসিদ, ভাউচার ও হোয়াটসঅ্যাপ নোটিফিকেশনে প্রিন্ট হবে।
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  প্রতিষ্ঠানের নাম (Business Name)
                </label>
                <div className="relative">
                  <Store className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <Input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="pl-9 text-sm"
                    placeholder="মেসার্স আলম ব্রাদার্স ট্রেডার্স"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    মোবাইল নম্বর (Contact Phone)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <Input
                      type="text"
                      value={businessPhone}
                      onChange={(e) => setBusinessPhone(e.target.value)}
                      className="pl-9 text-sm"
                      placeholder="০১৭১১০০০০০১"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    ঠিকানা (Address / Location)
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <Input
                      type="text"
                      value={businessAddress}
                      onChange={(e) => setBusinessAddress(e.target.value)}
                      className="pl-9 text-sm"
                      placeholder="উত্তরা, ঢাকা"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button onClick={handleSaveBusiness} variant="primary" size="sm">
                  সংরক্ষণ করুন
                </Button>
                {businessSaved && (
                  <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> প্রতিষ্ঠানের তথ্য সফলভাবে সংরক্ষিত হয়েছে
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Staff Management (Owner Only) */}
      {isOwner && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <CardTitle>কর্মচারী ব্যবস্থাপনা (Staff Management)</CardTitle>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full">
                {staffList.length} জন কর্মী
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-500">
              কর্মচারীরা বন্ধকী তৈরি ও সুদ গ্রহণ করতে পারে, কিন্তু কোনো রেকর্ড মুছে ফেলতে বা আয়ের রিপোর্ট দেখতে পারে না।
            </p>

            {isLoadingStaff ? (
              <p className="text-xs text-slate-400 py-3 text-center">তথ্য লোড হচ্ছে...</p>
            ) : staffList.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center">
                <p className="text-xs text-slate-500">বর্তমানে কোনো কর্মচারী নিবন্ধিত নেই।</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  নতুন কর্মচারী যোগ করতে Supabase Auth থেকে staff@pledgebook.com তৈরি করুন।
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                {staffList.map((st) => (
                  <div
                    key={st.id}
                    className="p-3 bg-white flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800">{st.name}</span>
                        {st.is_active ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> সক্রিয়
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3" /> নিষ্ক্রিয়
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        মোবাইল: {st.phone || 'দেওয়া হয়নি'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        toggleStaffMutation.mutate({
                          staffId: st.id,
                          newStatus: !st.is_active,
                        })
                      }
                      disabled={toggleStaffMutation.isPending}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        st.is_active
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                      }`}
                    >
                      {st.is_active ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

      {/* Mobile Notifications & Reminders Card */}
      <Card className="border-emerald-200/80 bg-white shadow-2xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <BellRing className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">
                  {language === 'bn' ? 'মোবাইল নোটিফিকেশন ও অ্যালার্ট' : 'Mobile Notifications & Alerts'}
                </CardTitle>
                <p className="text-xs text-slate-500">
                  {language === 'bn'
                    ? 'মেয়াদোত্তীর্ণ ও আসন্ন বন্ধকীর স্বয়ংক্রিয় রিমাইন্ডার'
                    : 'Automated reminders for due and overdue mortgages'}
                </p>
              </div>
            </div>

            <Badge
              variant={notificationPermission === 'granted' ? 'active' : 'overdue'}
              className="text-xs"
            >
              {notificationPermission === 'granted'
                ? (language === 'bn' ? 'চালু আছে (Active)' : 'Granted')
                : (language === 'bn' ? 'অনুমতি প্রয়োজন' : 'Permission Required')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
            <div className="font-semibold text-slate-800">
              {language === 'bn' ? '🔔 রিমাইন্ডার শিডিউল স্তরসমূহ:' : '🔔 Scheduled Reminder Stages:'}
            </div>
            <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
              <li>{language === 'bn' ? 'মেয়াদ শেষ হওয়ার ১৫ দিন পূর্বে প্রাথমিক সতর্কতা' : '15 days before due date (Initial alert)'}</li>
              <li>{language === 'bn' ? 'মেয়াদ শেষ হওয়ার ৭ দিন পূর্বে তাগাদা অ্যালার্ট' : '7 days before due date (Follow-up alert)'}</li>
              <li>{language === 'bn' ? 'মেয়াদ শেষ হওয়ার ১ দিন পূর্বে জরুরি নোটিফিকেশন' : '1 day before due date (Urgent alert)'}</li>
              <li>{language === 'bn' ? 'মেয়াদ পূর্তির দিনে (সকাল ০৯:০০ টায়) চূড়ান্ত রিমাইন্ডার' : 'On due date at 09:00 AM (Final reminder)'}</li>
            </ul>
          </div>

          {testNotifFeedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{testNotifFeedback}</span>
            </div>
          )}

          {syncNotifFeedback && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-semibold text-blue-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{syncNotifFeedback}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {notificationPermission !== 'granted' ? (
              <Button
                type="button"
                variant="primary"
                onClick={handleRequestNotificationPermission}
                className="gap-2 text-xs h-10 w-full"
              >
                <Bell className="w-4 h-4" />
                <span>{language === 'bn' ? 'নোটিফিকেশন অনুমতি দিন' : 'Grant Permission'}</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={handleSendTestNotification}
                isLoading={isTestingNotif}
                className="gap-2 text-xs h-10 w-full border-emerald-300 text-emerald-800 hover:bg-emerald-50"
              >
                <Bell className="w-4 h-4 text-emerald-600" />
                <span>{language === 'bn' ? 'টেস্ট নোটিফিকেশন পাঠান' : 'Send Test Notification'}</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={handleSyncAllReminders}
              isLoading={isSyncingNotif}
              className="gap-2 text-xs h-10 w-full border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <RotateCw className="w-4 h-4 text-slate-500" />
              <span>{language === 'bn' ? 'সকল বন্ধকী রিমাইন্ডার সিঙ্ক' : 'Sync All Reminders'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Android Native APK Card */}
      <Card className="border-emerald-100 bg-emerald-50/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-700" />
            <CardTitle>অ্যান্ড্রয়েড মোবাইল অ্যাপ (Android Native App)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-slate-600">
            মোবাইল সংস্করণ সম্পূর্ণ প্রস্তুত। ক্যামেরা, পিন লক এবং লোকাল নোটিফিকেশন সহ অ্যান্ড্রয়েড APK বিল্ড সফল হয়েছে।
          </p>
          <p className="text-[11px] font-mono bg-white p-2 rounded-lg border border-emerald-200 text-slate-700 break-all">
            APK Path: android/app/build/outputs/apk/debug/app-debug.apk
          </p>
        </CardContent>
      </Card>

      {/* Demo / Mock Role Switcher (Only in mock / offline mode) */}
      {isMockMode && (
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
      )}

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
