import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCustomers } from '../customers/useCustomers';
import { useCreateMortgage } from './useMortgages';
import { CustomerFormDialog } from '../customers/CustomerFormDialog';
import { useI18n } from '../../lib/i18n';
import {
  calculateYearlyInterest,
  calculateCloseAmount,
  formatBDT,
  getTodayDhakaDateString,
  parseBanglaOrEnglishNumber,
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
  const [interestRateInput, setInterestRateInput] = useState<string>(() => defaultRate.toString());

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

  // Automatically sync due_date to +1 year when start_date changes
  useEffect(() => {
    if (watchedStartDate) {
      const d = new Date(watchedStartDate);
      d.setFullYear(d.getFullYear() + 1);
      setValue('due_date', d.toISOString().split('T')[0]);
    }
  }, [watchedStartDate, setValue]);

  const yearlyInterest = calculateYearlyInterest(watchedPrincipal, watchedRate);
  const settlement = calculateCloseAmount(watchedPrincipal, watchedRate);

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
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-600" />
              <span>{t('mortgages.financial_title')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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

              <Input
                label={t('mortgages.interest_rate')}
                type="text"
                inputMode="decimal"
                placeholder="25.00"
                value={interestRateInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  setInterestRateInput(raw);
                  const parsed = parseBanglaOrEnglishNumber(raw);
                  setValue('interest_rate', parsed, { shouldValidate: true });
                }}
                error={errors.interest_rate?.message}
                helperText={t('mortgages.interest_helper')}
              />
            </div>

            {/* Live Calculation Preview Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-tr from-emerald-50 via-teal-50/40 to-slate-50 border border-emerald-200/80">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-2">
                🧮 {language === 'en' ? 'Live Interest & Settlement Preview (1-Year Term)' : 'লাইভ সুদের হিসাব প্রিভিউ (১ বছর মেয়াদ)'}
              </span>
              <div className="grid grid-cols-3 gap-2 text-center sm:text-left">
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                  <span className="text-[11px] text-slate-500 block">{t('mortgages.principal')}</span>
                  <span className="text-sm sm:text-base font-bold text-slate-900 font-mono">
                    {formatBDT(watchedPrincipal, language)}
                  </span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                  <span className="text-[11px] text-slate-500 block">
                    {language === 'en' ? `1-Yr Interest (${watchedRate}%)` : `১ বছরের সুদ (${watchedRate}%)`}
                  </span>
                  <span className="text-sm sm:text-base font-bold text-emerald-700 font-mono">
                    {formatBDT(yearlyInterest, language)}
                  </span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                  <span className="text-[11px] text-slate-500 block">
                    {language === 'en' ? 'Total Settlement' : 'পরিশোধে মোট দেওয়'}
                  </span>
                  <span className="text-sm sm:text-base font-bold text-slate-900 font-mono">
                    {formatBDT(settlement.total, language)}
                  </span>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
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
                error={errors.due_date?.message}
                helperText={language === 'en' ? 'Auto-extended by 1 year from start date' : 'শুরুর তারিখ থেকে ১ বছর স্বয়ংক্রিয়ভাবে যুক্ত'}
              />
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
