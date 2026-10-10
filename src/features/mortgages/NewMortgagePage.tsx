import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCustomers } from '../customers/useCustomers';
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
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import {
  ArrowLeft,
  UserPlus,
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
} from 'lucide-react';
import { ImageZoomModal } from '../../components/ui/image-zoom-modal';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { captureFromCamera, pickFromGallery, readFileAsDataUrl } from '../../lib/media';
import {
  compressDocumentPhoto,
  getBase64SizeInBytes,
  formatBytes,
} from '../../lib/imageCompressor';
import type { CollateralType } from '../../types/database';

const mortgageSchema = z.object({
  customer_id: z.string().min(1, 'গ্রাহক নির্বাচন করুন'),
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
  const [searchParams] = useSearchParams();
  const preselectedCustomerId = searchParams.get('customer_id');

  const { data: customers = [] } = useCustomers();
  const createMortgageMutation = useCreateMortgage();

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
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

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MortgageFormData>({
    resolver: zodResolver(mortgageSchema) as any,
    defaultValues: {
      customer_id: preselectedCustomerId || '',
      principal: 0,
      interest_rate: defaultRate,
      start_date: todayStr,
      due_date: nextYearStr,
      collateral_type: 'gold',
      collateral_description: '',
    },
  });

  useEffect(() => {
    if (preselectedCustomerId) {
      setValue('customer_id', preselectedCustomerId);
    }
  }, [preselectedCustomerId, setValue]);

  // Watch values for real-time calculation preview
  const rawPrincipal = watch('principal');
  const rawRate = watch('interest_rate');
  const watchedPrincipal = Number(rawPrincipal) || 0;
  const watchedRate = Number(rawRate) || 0;
  const watchedStartDate = watch('start_date');
  const watchedDueDate = watch('due_date') || nextYearStr;

  // Sync due_date when start_date changes or term preset changes
  useEffect(() => {
    if (watchedStartDate && selectedTermPreset !== 'custom') {
      const preset = TERM_PRESETS.find((p) => p.id === selectedTermPreset);
      if (preset && preset.months > 0) {
        const d = new Date(watchedStartDate);
        d.setMonth(d.getMonth() + preset.months);
        setValue('due_date', d.toISOString().split('T')[0]);
      }
    }
  }, [watchedStartDate, selectedTermPreset, setValue]);

  const handleSelectTerm = (presetId: string, months: number) => {
    setSelectedTermPreset(presetId);
    if (months > 0) {
      const baseDate = new Date(watchedStartDate || todayStr);
      baseDate.setMonth(baseDate.getMonth() + months);
      setValue('due_date', baseDate.toISOString().split('T')[0], { shouldValidate: true });
    }
  };

  // Distinct calculation based on chosen customer mortgage terms
  const termCalculation = calculateTermInterest(watchedPrincipal, watchedRate, watchedStartDate, watchedDueDate);
  const termDuration = calculateTermDuration(watchedStartDate, watchedDueDate);

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
      const selectedCustomer = customers.find((c) => c.id === data.customer_id);

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
        customer_id: data.customer_id,
        principal: Math.round(data.principal),
        interest_rate: data.interest_rate,
        start_date: data.start_date,
        due_date: data.due_date,
        collateral_type: data.collateral_type as CollateralType,
        collateral_description: data.collateral_description,
        collateral_photo_paths: compressedPhotos,
        customer: selectedCustomer,
      });

      navigate(`/mortgages/${created.id}`);
    } catch (err) {
      console.error('Failed to create mortgage:', err);
      alert('বন্ধক তৈরি করতে সমস্যা হয়েছে। অনুগ্রহ করে তথ্য পুনরায় যাচাই করুন।');
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
        {/* 1. Customer Selection */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <span>{t('mortgages.customer_select_title')}</span>
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                onClick={() => setIsCustomerModalOpen(true)}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{t('customers.add_customer')}</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {customers.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 text-center space-y-2.5">
                <p className="text-xs sm:text-sm text-slate-700 font-medium">
                  {language === 'bn'
                    ? 'কোনো গ্রাহক পাওয়া যায়নি। বন্ধক তৈরি করতে প্রথমে গ্রাহক যোগ করুন।'
                    : 'No customers found. Please add a customer first to issue a mortgage.'}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  className="gap-1.5 mx-auto"
                  onClick={() => setIsCustomerModalOpen(true)}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{t('customers.add_customer')}</span>
                </Button>
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
              </div>
            )}
            {errors.customer_id && (
              <p className="text-xs font-medium text-rose-600 mt-1">{errors.customer_id.message}</p>
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

            {/* Dates Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t('mortgages.start_date')}
                type="date"
                {...register('start_date')}
                error={errors.start_date?.message}
              />

              <Input
                label={t('mortgages.due_date')}
                type="date"
                {...register('due_date')}
                onChange={(e) => {
                  setSelectedTermPreset('custom');
                  setValue('due_date', e.target.value, { shouldValidate: true });
                }}
                error={errors.due_date?.message}
                helperText={
                  language === 'bn'
                    ? `মেয়াদকাল: ${termDuration.termLabelBn}`
                    : `Duration: ${termDuration.termLabelEn}`
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
                <span className="text-[11px] font-bold text-emerald-700 bg-white px-2.5 py-0.5 rounded-lg border border-emerald-200">
                  {language === 'bn' ? termDuration.termLabelBn : termDuration.termLabelEn}
                </span>
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
    </div>
  );
};
