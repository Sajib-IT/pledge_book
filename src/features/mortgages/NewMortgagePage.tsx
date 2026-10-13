import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCustomers, useCreateCustomer } from '../customers/useCustomers';
import { useCreateMortgage } from './useMortgages';
import { CustomerFormDialog } from '../customers/CustomerFormDialog';
import { useI18n } from '../../lib/i18n';
import {
  calculateTermDuration,
  calculateTermInterest,
  convertMonthlyToYearlyRate,
  convertYearlyToMonthlyRate,
  formatBDT,
  getTodayDhakaDateString,
  parseBanglaOrEnglishNumber,
  toBanglaDigits,
} from '../../lib/calculations';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { DatePicker } from '../../components/ui/date-picker';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import {
  ArrowLeft,
  UserPlus,
  User,
  Coins,
  Camera,
  Image as ImageIcon,
  Gem,
  Plus,
  Trash2,
  Search,
  ZoomIn,
  Clock,
  Calculator,
  Sparkles,
  CheckCircle2,
  History,
} from 'lucide-react';
import { ImageZoomModal } from '../../components/ui/image-zoom-modal';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { captureFromCamera, pickFromGallery, readFileAsDataUrl } from '../../lib/media';
import {
  compressDocumentPhoto,
  getBase64SizeInBytes,
  formatBytes,
} from '../../lib/imageCompressor';
import { StampScannerModal } from '../../components/common/StampScannerModal';
import type { StampExtractedData } from '../../lib/stampScanner';
import type { CollateralType } from '../../types/database';

const mortgageSchema = z
  .object({
    customer_mode: z.enum(['new', 'existing']),
    customer_id: z.string().optional(),
    customer_name: z.string().optional(),
    customer_phone: z.string().optional(),
    customer_address: z.string().optional(),
    customer_nid: z.string().optional(),
    principal: z.preprocess(
      (val) => parseBanglaOrEnglishNumber(val as string | number),
      z.number({ required_error: 'আসল টাকা লিখুন', invalid_type_error: 'আসল টাকা সঠিকভাবে লিখুন' })
        .min(100, 'আসল টাকা কমপক্ষে ১০০ হতে হবে')
    ),
    interest_rate: z.preprocess(
      (val) => parseBanglaOrEnglishNumber(val as string | number),
      z.number({ required_error: 'সুদের হার লিখুন', invalid_type_error: 'সুদের হার সঠিকভাবে লিখুন' })
        .min(0, 'সুদের হার ০ বা তার বেশি হতে হবে')
    ),
    start_date: z.string().min(1, 'শুরুর তারিখ দিন'),
    due_date: z.string().min(1, 'মেয়াদ উত্তীর্ণের তারিখ দিন'),
    collateral_type: z.enum(['gold', 'land', 'vehicle', 'electronics', 'other']),
    collateral_description: z.string().min(3, 'জামানতের বিবরণ দিন'),
  })
  .superRefine((data, ctx) => {
    if (data.customer_mode === 'existing') {
      if (!data.customer_id || data.customer_id.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'গ্রাহক নির্বাচন করুন',
          path: ['customer_id'],
        });
      }
    } else {
      if (!data.customer_name || data.customer_name.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'গ্রাহকের নাম লিখুন (কমপক্ষে ২ অক্ষর)',
          path: ['customer_name'],
        });
      }
      if (!data.customer_phone || data.customer_phone.trim().length < 6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'মোবাইল নম্বর লিখুন',
          path: ['customer_phone'],
        });
      }
    }
  });

type MortgageFormData = z.infer<typeof mortgageSchema>;

const TERM_PRESETS = [
  { id: '1m', months: 1, labelBn: '১ মাস', labelEn: '1 Month' },
  { id: '2m', months: 2, labelBn: '২ মাস', labelEn: '2 Months' },
  { id: '3m', months: 3, labelBn: '৩ মাস', labelEn: '3 Months' },
  { id: '6m', months: 6, labelBn: '৬ মাস', labelEn: '6 Months' },
  { id: '1y', months: 12, labelBn: '১ বছর', labelEn: '1 Year' },
  { id: 'custom', months: 0, labelBn: 'কাস্টম তারিখ', labelEn: 'Custom Date' },
];

export const NewMortgagePage: React.FC = () => {
  const { language, t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const preselectedCustomerId = searchParams.get('customer_id');

  const { data: customers = [] } = useCustomers();
  const createCustomerMutation = useCreateCustomer();
  const createMortgageMutation = useCreateMortgage();

  const [customerMode, setCustomerMode] = useState<'new' | 'existing'>(() =>
    preselectedCustomerId ? 'existing' : 'new'
  );
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isStampScannerOpen, setIsStampScannerOpen] = useState(false);
  const [scanSuccessBanner, setScanSuccessBanner] = useState<string | null>(null);
  const [collateralPhotos, setCollateralPhotos] = useState<string[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [zoomedPhotoIndex, setZoomedPhotoIndex] = useState<number | null>(null);

  const todayStr = getTodayDhakaDateString();
  const nextYearDate = new Date();
  nextYearDate.setFullYear(nextYearDate.getFullYear() + 1);
  const nextYearStr = nextYearDate.toISOString().split('T')[0];

  const defaultRate = Number(localStorage.getItem('default_interest_rate') || '25.00');

  const [principalInput, setPrincipalInput] = useState<string>('');
  const [rateBasis, setRateBasis] = useState<'yearly' | 'monthly'>('yearly');
  const [selectedTermPreset, setSelectedTermPreset] = useState<string>('1y');
  const [interestRateInput, setInterestRateInput] = useState<string>(() => defaultRate.toString());
  const [monthlyRateInput, setMonthlyRateInput] = useState<string>(() => (defaultRate / 12).toFixed(2));
  const [isHistoricalLoan, setIsHistoricalLoan] = useState<boolean>(false);
  const [interestPaidThroughDate, setInterestPaidThroughDate] = useState<string>(() => todayStr);
  const [offlineSettlementNote, setOfflineSettlementNote] = useState<string>('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MortgageFormData>({
    resolver: zodResolver(mortgageSchema) as any,
    defaultValues: {
      customer_mode: preselectedCustomerId ? 'existing' : 'new',
      customer_id: preselectedCustomerId || '',
      customer_name: '',
      customer_phone: '',
      customer_address: '',
      customer_nid: '',
      principal: 0,
      interest_rate: defaultRate,
      start_date: todayStr,
      due_date: nextYearStr,
      collateral_type: 'gold',
      collateral_description: '',
    },
  });

  const handleApplyScannedStamp = (extracted: StampExtractedData, photoDataUrl: string) => {
    setCustomerMode('new');
    setValue('customer_mode', 'new', { shouldValidate: true });

    if (extracted.customer_name) {
      setValue('customer_name', extracted.customer_name, { shouldValidate: true });
    }
    if (extracted.phone) {
      setValue('customer_phone', extracted.phone, { shouldValidate: true });
    }
    if (extracted.full_address) {
      setValue('customer_address', extracted.full_address, { shouldValidate: true });
    }
    if (extracted.nid_no) {
      setValue('customer_nid', extracted.nid_no, { shouldValidate: true });
    }
    if (extracted.principal_amount && extracted.principal_amount > 0) {
      setValue('principal', extracted.principal_amount, { shouldValidate: true });
      setPrincipalInput(extracted.principal_amount.toString());
    }
    if (extracted.interest_rate_percent !== null && extracted.interest_rate_percent !== undefined) {
      setValue('interest_rate', extracted.interest_rate_percent, { shouldValidate: true });
      setInterestRateInput(extracted.interest_rate_percent.toString());
      setMonthlyRateInput((extracted.interest_rate_percent / 12).toFixed(2));
      setRateBasis('yearly');
    }
    if (extracted.mortgage_date) {
      setValue('start_date', extracted.mortgage_date, { shouldValidate: true });
      if (extracted.mortgage_date < todayStr.slice(0, 4) + '-01-01') {
        setIsHistoricalLoan(true);
        setSelectedTermPreset('custom');
        setValue('due_date', nextYearStr, { shouldValidate: true });
      }
    }
    if (extracted.collateral_type) {
      setValue('collateral_type', extracted.collateral_type, { shouldValidate: true });
    }
    if (extracted.collateral_description) {
      setValue('collateral_description', extracted.collateral_description, { shouldValidate: true });
    }

    // Prepend the scanned stamp deed into collateral photos list
    if (photoDataUrl) {
      setCollateralPhotos((prev) => [photoDataUrl, ...prev]);
    }

    setScanSuccessBanner(
      language === 'bn'
        ? `✓ স্ট্যাম্প থেকে ${extracted.customer_name}-এর তথ্য ও বন্ধকী হিসাব স্বয়ংক্রিয়ভাবে পূরণ করা হয়েছে!`
        : `✓ Auto-filled from stamp deed for ${extracted.customer_name}!`
    );
  };

  useEffect(() => {
    if (preselectedCustomerId) {
      setCustomerMode('existing');
      setValue('customer_mode', 'existing');
      setValue('customer_id', preselectedCustomerId);
    }
  }, [preselectedCustomerId, setValue]);

  // Handle data passed via navigation state (e.g. from Dashboard quick scan)
  useEffect(() => {
    const navState = location.state as any;
    if (navState?.scannedStamp && navState?.scannedPhoto) {
      handleApplyScannedStamp(navState.scannedStamp, navState.scannedPhoto);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Watch values for real-time calculation preview
  const rawPrincipal = watch('principal');
  const rawRate = watch('interest_rate');
  const watchedPrincipal = Number(rawPrincipal) || 0;
  const watchedRate = Number(rawRate) || 0;
  const watchedStartDate = watch('start_date');
  const watchedDueDate = watch('due_date') || nextYearStr;

  // Sync due_date when start_date changes or term preset changes
  useEffect(() => {
    if (isHistoricalLoan) return; // Do not auto-override due date in historical loan mode!
    if (watchedStartDate && selectedTermPreset !== 'custom') {
      const preset = TERM_PRESETS.find((p) => p.id === selectedTermPreset);
      if (preset && preset.months > 0) {
        const d = new Date(watchedStartDate);
        d.setMonth(d.getMonth() + preset.months);
        setValue('due_date', d.toISOString().split('T')[0]);
      }
    }
  }, [watchedStartDate, selectedTermPreset, setValue, isHistoricalLoan]);

  const handleSelectTerm = (presetId: string, months: number) => {
    setSelectedTermPreset(presetId);
    if (months > 0) {
      const baseDate = new Date(isHistoricalLoan ? interestPaidThroughDate : (watchedStartDate || todayStr));
      baseDate.setMonth(baseDate.getMonth() + months);
      setValue('due_date', baseDate.toISOString().split('T')[0], { shouldValidate: true });
    }
  };

  // Distinct calculation based on chosen customer mortgage terms (for historical loans, computes active cycle from offline paid date)
  const cycleCalculationStartDate = isHistoricalLoan ? interestPaidThroughDate : watchedStartDate;
  const termCalculation = calculateTermInterest(watchedPrincipal, watchedRate, cycleCalculationStartDate, watchedDueDate);
  const termDuration = calculateTermDuration(cycleCalculationStartDate, watchedDueDate);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleCapturePhoto = async () => {
    const dataUrl = await captureFromCamera(80);
    if (dataUrl) {
      setCollateralPhotos((prev) => [...prev, dataUrl]);
    } else {
      cameraInputRef.current?.click();
    }
  };

  const handlePickFromGallery = async () => {
    const dataUrl = await pickFromGallery(80);
    if (dataUrl) {
      setCollateralPhotos((prev) => [...prev, dataUrl]);
    } else {
      galleryInputRef.current?.click();
    }
  };

  const handleCameraFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const dataUrl = await readFileAsDataUrl(file);
      setCollateralPhotos((prev) => [...prev, dataUrl]);
      e.target.value = '';
    }
  };

  const handleGalleryFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newPhotos: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const dataUrl = await readFileAsDataUrl(files[i]);
        newPhotos.push(dataUrl);
      }
      setCollateralPhotos((prev) => [...prev, ...newPhotos]);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setCollateralPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: MortgageFormData) => {
    try {
      let finalCustomerId = data.customer_id;
      let finalCustomer = customers.find((c) => c.id === data.customer_id);

      // If in new customer mode, create customer inline first
      if (data.customer_mode === 'new') {
        const createdCustomer = await createCustomerMutation.mutateAsync({
          name: data.customer_name!.trim(),
          phone: data.customer_phone!.trim(),
          address: data.customer_address?.trim() || undefined,
          nid_no: data.customer_nid?.trim() || undefined,
        });
        finalCustomerId = createdCustomer.id;
        finalCustomer = createdCustomer;
      }

      // Ensure all collateral photos are compressed to lightweight sizes (<100KB)
      const compressedPhotos = await Promise.all(
        collateralPhotos.map(async (photo) => {
          if (photo.startsWith('data:')) {
            return await compressDocumentPhoto(photo);
          }
          return photo;
        })
      );

      const created = await createMortgageMutation.mutateAsync({
        customer_id: finalCustomerId!,
        principal: Math.round(data.principal),
        interest_rate: data.interest_rate,
        start_date: data.start_date,
        due_date: data.due_date,
        collateral_type: data.collateral_type as CollateralType,
        collateral_description: data.collateral_description,
        collateral_photo_paths: compressedPhotos,
        customer: finalCustomer,
        historical_settlement: isHistoricalLoan
          ? {
              interest_paid_through: interestPaidThroughDate,
              note:
                offlineSettlementNote.trim() ||
                (language === 'bn'
                  ? `বিগত ${data.start_date.substring(0, 4)} হতে ${interestPaidThroughDate.substring(0, 4)} পর্যন্ত বার্ষিক সুদ অফলাইন রসিদে পরিশোধিত।`
                  : `Historical interest paid offline up to ${interestPaidThroughDate}.`),
            }
          : undefined,
      });

      navigate(`/mortgages/${created.id}`);
    } catch (err: unknown) {
      console.error('Failed to create mortgage:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      alert((language === 'bn' ? 'বন্ধক তৈরি করতে সমস্যা হয়েছে: ' : 'Failed to create mortgage: ') + msg);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24 md:pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/mortgages" className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {t('mortgages.new_mortgage')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {language === 'bn' ? 'নতুন বন্ধকী ঋণ ও জামানত গ্রহণের হিসাব' : 'Create new mortgage loan and record collateral'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Scan Success Banner */}
        {scanSuccessBanner && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-emerald-900 text-xs font-bold shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{scanSuccessBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setScanSuccessBanner(null)}
              className="text-emerald-700 hover:text-emerald-950 text-xs px-2 py-1 rounded-lg hover:bg-emerald-100/60 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* AI Stamp Scanner Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white rounded-2xl p-4 sm:p-5 shadow-lg shadow-emerald-900/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white/15 border border-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black tracking-tight">
                  {language === 'bn' ? 'এআই স্ট্যাম্প স্ক্যানার (স্বয়ংক্রিয় ফর্ম পূরণ)' : 'AI Stamp Deed Auto-Fill'}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/25 border border-emerald-300/40 text-emerald-100 uppercase tracking-wider">
                  AI
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5 max-w-md">
                {language === 'bn'
                  ? 'স্ট্যাম্প বা বন্ধকনামার ছবি তুললে নাম, টাকা, তারিখ ও জামানত স্বয়ংক্রিয়ভাবে পূরণ হয়ে যাবে'
                  : 'Snap a picture of the mortgage stamp deed to auto-detect customer, cash, date & collateral'}
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => setIsStampScannerOpen(true)}
            className="bg-white hover:bg-emerald-50 text-emerald-950 font-black text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95 shrink-0 gap-2 border-0 cursor-pointer"
          >
            <Camera className="w-4 h-4 text-emerald-700" />
            <span>{language === 'bn' ? 'স্ট্যাম্প স্ক্যান করুন' : 'Scan Stamp Deed'}</span>
          </Button>
        </div>

        {/* 1. Customer Information (Inline New Customer or Existing Select) */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-600" />
                <span>{language === 'bn' ? '১. গ্রাহকের তথ্য' : '1. Customer Information'}</span>
              </CardTitle>

              {/* Mode Toggle Switch */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerMode('new');
                    setValue('customer_mode', 'new', { shouldValidate: true });
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    customerMode === 'new'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{language === 'bn' ? 'নতুন গ্রাহক (সরাসরি)' : 'New Customer (Direct)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCustomerMode('existing');
                    setValue('customer_mode', 'existing', { shouldValidate: true });
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    customerMode === 'existing'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{language === 'bn' ? 'পুরাতন গ্রাহক থেকে বাছুন' : 'Select Existing'}</span>
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {customerMode === 'new' ? (
              <div className="space-y-3 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200/70">
                <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold mb-1">
                  <span>
                    {language === 'bn'
                      ? '💡 সরাসরি নতুন গ্রাহকের তথ্য লিখুন (আলাদা সেভ করতে হবে না, নিচে একসাথেই সেভ হবে):'
                      : '💡 Enter customer details directly below (will be saved automatically with mortgage):'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Input
                    label={language === 'bn' ? 'গ্রাহকের পুরো নাম *' : 'Customer Full Name *'}
                    placeholder={language === 'bn' ? 'যেমন: হাজী রফিক মিয়া' : 'e.g. Rafiq Mia'}
                    {...register('customer_name')}
                    error={errors.customer_name?.message}
                    className="bg-white"
                  />

                  <Input
                    label={language === 'bn' ? 'মোবাইল নম্বর *' : 'Phone Number *'}
                    placeholder={language === 'bn' ? 'যেমন: ০১৭১১২২৩৩৪৪' : 'e.g. 01711223344'}
                    type="tel"
                    {...register('customer_phone')}
                    error={errors.customer_phone?.message}
                    className="bg-white font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Input
                    label={language === 'bn' ? 'ঠিকানা (ঐচ্ছিক)' : 'Address (Optional)'}
                    placeholder={language === 'bn' ? 'গ্রাম/মহল্লা, থানা, জেলা' : 'Village/Street, City'}
                    {...register('customer_address')}
                    className="bg-white"
                  />

                  <Input
                    label={language === 'bn' ? 'জাতীয় পরিচয়পত্র (NID - ঐচ্ছিক)' : 'NID No (Optional)'}
                    placeholder={language === 'bn' ? 'যেমন: ১৯৮৫২৬৯১২৩৪৫৬৭৮৯০' : 'e.g. 19852691234567890'}
                    {...register('customer_nid')}
                    className="bg-white font-mono"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder={
                      language === 'bn'
                        ? 'গ্রাহক খুঁজুন (নাম বা ফোন)...'
                        : 'Search customer (name or phone)...'
                    }
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50/80 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 transition-colors"
                  />
                </div>
                <select
                  {...register('customer_id')}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">{t('mortgages.customer_select_placeholder')}</option>
                  {customers
                    .filter((c) => {
                      const q = customerSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        c.name.toLowerCase().includes(q) ||
                        (c.phone && c.phone.includes(q))
                      );
                    })
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </option>
                    ))}
                </select>
                {errors.customer_id && (
                  <p className="text-xs font-medium text-rose-600 mt-1">{errors.customer_id.message}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Financial Details & Real-Time Calculation Preview */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-600" />
                <span>{t('mortgages.financial_title')}</span>
              </div>
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                {language === 'bn' ? 'স্বতন্ত্র হিসাব ও মেয়াদ' : 'Custom Client Terms'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Principal & Interest Rate */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t('mortgages.principal')}
                type="text"
                inputMode="numeric"
                placeholder={language === 'bn' ? 'টাকার পরিমাণ লিখুন (যেমন: ৫০০০০)' : 'Enter amount in BDT (e.g. 50000)'}
                value={principalInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  setPrincipalInput(raw);
                  const parsed = parseBanglaOrEnglishNumber(raw);
                  setValue('principal', parsed, { shouldValidate: true });
                }}
                error={errors.principal?.message}
                helperText={t('mortgages.principal_helper')}
              />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    {t('mortgages.interest_rate')}
                  </label>
                  {/* Rate Basis Toggle */}
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setRateBasis('yearly');
                        const parsed = parseBanglaOrEnglishNumber(interestRateInput);
                        setValue('interest_rate', parsed, { shouldValidate: true });
                      }}
                      className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                        rateBasis === 'yearly'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {language === 'bn' ? 'বাৎসরিক %' : 'Yearly %'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRateBasis('monthly');
                        const parsed = parseBanglaOrEnglishNumber(monthlyRateInput);
                        const annualized = convertMonthlyToYearlyRate(parsed);
                        setValue('interest_rate', annualized, { shouldValidate: true });
                      }}
                      className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                        rateBasis === 'monthly'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {language === 'bn' ? 'মাসিক %' : 'Monthly %'}
                    </button>
                  </div>
                </div>

                {rateBasis === 'yearly' ? (
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="25.00"
                    value={interestRateInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setInterestRateInput(raw);
                      const parsed = parseBanglaOrEnglishNumber(raw);
                      setValue('interest_rate', parsed, { shouldValidate: true });
                      setMonthlyRateInput(convertYearlyToMonthlyRate(parsed).toString());
                    }}
                    error={errors.interest_rate?.message}
                    helperText={
                      language === 'bn'
                        ? `মাসিক সমতুল্য: ${toBanglaDigits(convertYearlyToMonthlyRate(watchedRate).toFixed(2))}% প্রতি মাস`
                        : `Monthly equivalent: ${convertYearlyToMonthlyRate(watchedRate).toFixed(2)}% / month`
                    }
                  />
                ) : (
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="2.00"
                    value={monthlyRateInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setMonthlyRateInput(raw);
                      const parsed = parseBanglaOrEnglishNumber(raw);
                      const annualized = convertMonthlyToYearlyRate(parsed);
                      setInterestRateInput(annualized.toString());
                      setValue('interest_rate', annualized, { shouldValidate: true });
                    }}
                    error={errors.interest_rate?.message}
                    helperText={
                      language === 'bn'
                        ? `বাৎসরিক সমতুল্য: ${toBanglaDigits(watchedRate.toFixed(2))}% প্রতি বছর`
                        : `Annualized rate: ${watchedRate.toFixed(2)}% / year`
                    }
                  />
                )}
              </div>
            </div>

            {/* Agreed Term Selection Presets */}
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>{language === 'bn' ? 'গ্রাহকের সাথে চুক্তিকৃত মেয়াদ' : 'Agreed Customer Term'}</span>
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {TERM_PRESETS.map((preset) => {
                  const isSelected = selectedTermPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectTerm(preset.id, preset.months)}
                      className={`h-9 px-2 text-xs font-bold rounded-xl border transition-all text-center flex items-center justify-center ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                      }`}
                    >
                      {language === 'bn' ? preset.labelBn : preset.labelEn}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Historical Loan & Offline Receipts Migration Toggle */}
            <div className="p-3.5 sm:p-4 rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50/70 to-orange-50/40 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0 mt-0.5 sm:mt-0">
                    <History className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                      {language === 'bn'
                        ? 'পুরাতন বন্ধক ও পূর্ববর্তী অফলাইন রসিদ সমন্বয়'
                        : 'Historical Loan & Offline Receipts Migration'}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {language === 'bn'
                        ? 'যেমন: ২০১৭ সালের বন্ধক, যার পূর্ববর্তী সুদ অফলাইনে রসিদে পরিশোধিত হয়েছে'
                        : 'e.g. Loans taken in 2017 with prior interest paid offline on paper receipts'}
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={isHistoricalLoan}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsHistoricalLoan(checked);
                      if (checked) {
                        setSelectedTermPreset('custom');
                        // Auto-set due date 1 year from interest paid through
                        const d = new Date(interestPaidThroughDate);
                        d.setFullYear(d.getFullYear() + 1);
                        setValue('due_date', d.toISOString().split('T')[0], { shouldValidate: true });
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {isHistoricalLoan && (
                <div className="pt-2 border-t border-amber-200/60 space-y-3 animate-in fade-in">
                  <div className="p-2.5 rounded-xl bg-white/90 border border-amber-200/80 text-xs text-amber-900 leading-relaxed font-medium">
                    {language === 'bn'
                      ? '💡 সমাধান: দলিলের মূল শুরুর তারিখ (যেমন: ২০১৭ সাল) রেকর্ডে অবিকল থাকবে, কিন্তু বিগত বছরগুলোর জন্য অহেতুক বকেয়া বা অতিরিক্ত সুদ দেখাবে না। গ্রাহক অফলাইনে যে তারিখ পর্যন্ত সুদ দিয়েছেন, তার পরবর্তী চলতি মেয়াদের হিসাব হবে।'
                      : '💡 Solution: Retains the original legal deed start date (e.g. 2017) without showing false past overdue or 8-9 years accumulated interest.'}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <DatePicker
                      label={
                        language === 'bn'
                          ? 'অফলাইনে কোন তারিখ পর্যন্ত সুদ পরিশোধিত?'
                          : 'Interest Paid Through (Offline)'
                      }
                      value={interestPaidThroughDate}
                      onChange={(val) => {
                        setInterestPaidThroughDate(val);
                        // Auto-set due date to 1 year after this paid through date
                        const d = new Date(val);
                        d.setFullYear(d.getFullYear() + 1);
                        setValue('due_date', d.toISOString().split('T')[0], { shouldValidate: true });
                      }}
                      helperText={
                        language === 'bn'
                          ? 'এই তারিখ পর্যন্ত পূর্ববর্তী সকল সুদ গ্রাহক অফলাইনে পরিশোধ করেছেন'
                          : 'Customer cleared all prior interest offline up to this date'
                      }
                    />

                    <Input
                      label={
                        language === 'bn'
                          ? 'অফলাইন রসিদের বিবরণ / নোট'
                          : 'Offline Settlement Note'
                      }
                      placeholder={
                        language === 'bn'
                          ? 'যেমন: বিগত ২০১৭ হতে ২০২৬ পর্যন্ত অফলাইন রসিদে বার্ষিক সুদ পরিশোধিত'
                          : 'e.g. Annual interest 2017-2026 settled via paper receipts'
                      }
                      value={offlineSettlementNote}
                      onChange={(e) => setOfflineSettlementNote(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Dates Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DatePicker
                label={
                  isHistoricalLoan
                    ? (language === 'bn' ? 'মূল দলিলের শুরুর তারিখ (যেমন: ২০১৭)' : 'Original Deed Start Date')
                    : t('mortgages.start_date')
                }
                value={watchedStartDate}
                onChange={(val) => setValue('start_date', val, { shouldValidate: true })}
                error={errors.start_date?.message}
                helperText={
                  isHistoricalLoan
                    ? (language === 'bn' ? 'আইনগত স্ট্যাম্প/দলিলের তারিখ অপরিবর্তিত থাকবে' : 'Legal deed date preserved')
                    : undefined
                }
              />

              <DatePicker
                label={
                  isHistoricalLoan
                    ? (language === 'bn' ? 'চলতি মেয়াদের শেষ তারিখ (Due Date)' : 'Active Cycle Due Date')
                    : t('mortgages.due_date')
                }
                value={watchedDueDate}
                onChange={(val) => {
                  setSelectedTermPreset('custom');
                  setValue('due_date', val, { shouldValidate: true });
                }}
                error={errors.due_date?.message}
                helperText={
                  language === 'bn'
                    ? `চলতি মেয়াদকাল: ${termDuration.termLabelBn}`
                    : `Active Term Duration: ${termDuration.termLabelEn}`
                }
              />
            </div>

            {/* Live Distinct Calculation Preview Banner */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-tr from-emerald-50 via-teal-50/40 to-slate-50 border border-emerald-200/90 shadow-2xs space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-black text-emerald-900 tracking-tight flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-emerald-700" />
                  <span>
                    {language === 'bn'
                      ? 'স্বতন্ত্র গ্রাহক হিসাব ও মেয়াদ বিবরণী'
                      : 'Distinct Customer Calculation & Term Breakdown'}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  {isHistoricalLoan && (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                      {language === 'bn' ? '📜 অফলাইন সমন্বয়কৃত চলতি হিসাব' : 'Historical Migrated'}
                    </span>
                  )}
                  <span className="text-[11px] font-bold text-emerald-700 bg-white px-2.5 py-0.5 rounded-lg border border-emerald-200">
                    {language === 'bn' ? termDuration.termLabelBn : termDuration.termLabelEn}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="bg-white/95 p-3 rounded-xl border border-emerald-100 shadow-2xs">
                  <span className="text-[11px] text-slate-500 font-medium block">
                    {t('mortgages.principal')}
                  </span>
                  <span className="text-sm sm:text-base font-black text-slate-900 font-mono">
                    {formatBDT(watchedPrincipal, language)}
                  </span>
                </div>

                <div className="bg-white/95 p-3 rounded-xl border border-emerald-100 shadow-2xs">
                  <span className="text-[11px] text-slate-500 font-medium block">
                    {language === 'bn' ? 'সুদের হার' : 'Interest Rate'}
                  </span>
                  <span className="text-sm sm:text-base font-bold text-emerald-700 font-mono">
                    {language === 'bn'
                      ? `${toBanglaDigits(termCalculation.monthlyInterestRate)}% মাসিক`
                      : `${termCalculation.monthlyInterestRate}% / mo`}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    ({language === 'bn' ? `${toBanglaDigits(watchedRate)}% বাৎসরিক` : `${watchedRate}% / yr`})
                  </span>
                </div>

                <div className="bg-white/95 p-3 rounded-xl border border-emerald-100 shadow-2xs">
                  <span className="text-[11px] text-slate-500 font-medium block">
                    {language === 'bn' ? 'মাসিক সুদ' : 'Monthly Interest'}
                  </span>
                  <span className="text-sm sm:text-base font-bold text-slate-800 font-mono">
                    {formatBDT(termCalculation.monthlyInterest, language)}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {language === 'bn' ? 'প্রতি মাসে প্রদেয়' : 'Per month'}
                  </span>
                </div>

                <div className="bg-white/95 p-3 rounded-xl border border-emerald-200 shadow-2xs bg-emerald-50/30">
                  <span className="text-[11px] text-emerald-800 font-semibold block">
                    {language === 'bn' ? 'মেয়াদের মোট সুদ' : 'Agreed Term Interest'}
                  </span>
                  <span className="text-sm sm:text-base font-black text-emerald-700 font-mono">
                    {formatBDT(termCalculation.termInterest, language)}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-medium block">
                    {language === 'bn' ? `মোট ${termDuration.termLabelBn}` : `For ${termDuration.termLabelEn}`}
                  </span>
                </div>

                <div className="bg-white/95 p-3 rounded-xl border border-blue-200 shadow-2xs bg-blue-50/30 col-span-2 sm:col-span-2">
                  <span className="text-[11px] text-blue-900 font-semibold block">
                    {language === 'bn' ? 'মেয়াদান্তে মোট প্রদেয় (আসল + সুদ)' : 'Total Maturity Settlement (Principal + Interest)'}
                  </span>
                  <span className="text-base sm:text-lg font-black text-blue-900 font-mono">
                    {formatBDT(termCalculation.totalMaturity, language)}
                  </span>
                  <span className="text-[10px] text-blue-700 font-medium block">
                    {language === 'bn' ? 'চুক্তির মেয়াদ শেষে সম্পূর্ণ নিষ্পত্তি' : 'Full settlement at contract maturity'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Collateral Details & Camera Photos */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Gem className="w-4 h-4 text-emerald-600" />
              <span>{t('mortgages.collateral_title')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                {t('mortgages.collateral_type')}
              </label>
              <select
                {...register('collateral_type')}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="gold">{t('mortgages.collateral_types.gold')}</option>
                <option value="land">{t('mortgages.collateral_types.land')}</option>
                <option value="vehicle">{t('mortgages.collateral_types.vehicle')}</option>
                <option value="electronics">{t('mortgages.collateral_types.electronics')}</option>
                <option value="other">{t('mortgages.collateral_types.other')}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                {t('mortgages.collateral_desc')}
              </label>
              <textarea
                rows={3}
                placeholder={
                  language === 'bn'
                    ? 'যেমন: ২২ ক্যারেটের গলার চেইন ও ২ জোড়া বালা, ওজন প্রায় ২৪.৫ গ্রাম। হলমার্কযুক্ত ও ক্যাশমেমো সহ জমা রাখা হলো।'
                    : 'e.g. 22K gold necklace and 2 pairs of bangles, weight ~24.5g. Deposited with hallmark & memo.'
                }
                className="w-full p-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                {...register('collateral_description')}
              />
              {errors.collateral_description && (
                <p className="text-xs font-medium text-rose-600">
                  {errors.collateral_description.message}
                </p>
              )}
            </div>

            {/* Photos from Camera / Gallery */}
            <div className="space-y-2 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  {t('mortgages.collateral_photos')} ({collateralPhotos.length})
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCapturePhoto}
                    className="gap-1.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 h-8"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{language === 'bn' ? 'ক্যামেরা' : 'Camera'}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handlePickFromGallery}
                    className="gap-1.5 text-xs text-blue-700 border-blue-300 hover:bg-blue-50 h-8"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>{language === 'bn' ? 'গ্যালারি / ফাইল' : 'Gallery / Files'}</span>
                  </Button>

                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleCameraFileInput}
                  />
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleGalleryFileInput}
                  />
                </div>
              </div>

              {collateralPhotos.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 pt-2">
                  {collateralPhotos.map((photo, idx) => (
                    <div
                      key={idx}
                      onClick={() => setZoomedPhotoIndex(idx)}
                      className="relative group rounded-xl overflow-hidden aspect-square border border-slate-200 bg-slate-100 shadow-2xs cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all"
                      title={language === 'bn' ? 'জুম করে দেখতে ক্লিক করুন' : 'Click to zoom photo'}
                    >
                      <img src={photo} alt={`Collateral ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                      <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/30 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                        <span className="p-1.5 rounded-full bg-white/90 text-slate-800 shadow-sm">
                          <ZoomIn className="w-3.5 h-3.5 text-emerald-700" />
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePhoto(idx);
                        }}
                        className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-lg opacity-90 hover:opacity-100 transition-opacity shadow-sm z-10"
                        title="Remove photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute bottom-0 inset-x-0 bg-slate-900/70 text-[9px] text-white text-center font-mono py-0.5">
                        {formatBytes(getBase64SizeInBytes(photo))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  {language === 'bn'
                    ? 'সোনার গহনা, দলিল বা পণ্যের ছবি তুলুন যা রসিদ ও নথিতে সংরক্ষিত থাকবে।'
                    : 'Capture photos of gold jewelry, land deeds or pledge items for official records.'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link to="/mortgages">
            <Button type="button" variant="outline" size="lg">
              {t('common.cancel')}
            </Button>
          </Link>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting || createMortgageMutation.isPending}
            className="shadow-lg shadow-emerald-600/25 px-8"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span>{t('mortgages.issue_mortgage_btn')}</span>
          </Button>
        </div>
      </form>

      {/* Customer Quick Add Modal */}
      <CustomerFormDialog
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSuccess={(created) => {
          setValue('customer_id', created.id, { shouldValidate: true });
        }}
      />

      {/* Photo Zoom Modal */}
      {zoomedPhotoIndex !== null && collateralPhotos.length > 0 && (
        <ImageZoomModal
          isOpen={zoomedPhotoIndex !== null}
          onClose={() => setZoomedPhotoIndex(null)}
          images={collateralPhotos}
          initialIndex={zoomedPhotoIndex}
          title={language === 'bn' ? 'জামানতের ছবি প্রিভিউ' : 'Collateral Photo Preview'}
        />
      )}

      {/* AI Stamp Scanner Modal */}
      <StampScannerModal
        isOpen={isStampScannerOpen}
        onClose={() => setIsStampScannerOpen(false)}
        onApply={handleApplyScannedStamp}
      />
    </div>
  );
};
