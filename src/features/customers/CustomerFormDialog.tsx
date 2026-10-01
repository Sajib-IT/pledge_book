import React, { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { useI18n } from '../../lib/i18n';
import type { Customer } from '../../types/database';
import { useCreateCustomer, useUpdateCustomer } from './useCustomers';
import { Camera, Image as ImageIcon, User, Trash2, CreditCard } from 'lucide-react';
import { captureFromCamera, pickFromGallery, readFileAsDataUrl } from '../../lib/media';
import {
  compressCustomerAvatar,
  compressDocumentPhoto,
  getBase64SizeInBytes,
  formatBytes,
} from '../../lib/imageCompressor';

const customerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z
    .string()
    .regex(/^01[3-9]\d{8}$/, 'Valid 11-digit Bangladesh phone number required (e.g. 01711223344)'),
  nid_no: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  photo_path: z.string().optional().nullable(),
  nid_photo_path: z.string().optional().nullable(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

interface CustomerFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  customerToEdit?: Customer | null;
}

export const CustomerFormDialog: React.FC<CustomerFormDialogProps> = ({
  isOpen,
  onClose,
  customerToEdit,
}) => {
  const { language, t } = useI18n();
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [nidPhotoPreview, setNidPhotoPreview] = useState<string | null>(null);

  const photoCameraInputRef = useRef<HTMLInputElement>(null);
  const photoGalleryInputRef = useRef<HTMLInputElement>(null);
  const nidCameraInputRef = useRef<HTMLInputElement>(null);
  const nidGalleryInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      phone: '',
      nid_no: '',
      address: '',
      notes: '',
      photo_path: null,
      nid_photo_path: null,
    },
  });

  useEffect(() => {
    if (customerToEdit) {
      reset({
        name: customerToEdit.name,
        phone: customerToEdit.phone,
        nid_no: customerToEdit.nid_no || '',
        address: customerToEdit.address || '',
        notes: customerToEdit.notes || '',
        photo_path: customerToEdit.photo_path,
        nid_photo_path: customerToEdit.nid_photo_path,
      });
      setPhotoPreview(customerToEdit.photo_path || null);
      setNidPhotoPreview(customerToEdit.nid_photo_path || null);
    } else {
      reset({
        name: '',
        phone: '',
        nid_no: '',
        address: '',
        notes: '',
        photo_path: null,
        nid_photo_path: null,
      });
      setPhotoPreview(null);
      setNidPhotoPreview(null);
    }
  }, [customerToEdit, reset, isOpen]);

  // Handlers for Customer Photo
  const handlePhotoFromCamera = async () => {
    const dataUrl = await captureFromCamera(85);
    if (dataUrl) {
      setPhotoPreview(dataUrl);
      setValue('photo_path', dataUrl);
    } else {
      photoCameraInputRef.current?.click();
    }
  };

  const handlePhotoFromGallery = async () => {
    const dataUrl = await pickFromGallery(85);
    if (dataUrl) {
      setPhotoPreview(dataUrl);
      setValue('photo_path', dataUrl);
    } else {
      photoGalleryInputRef.current?.click();
    }
  };

  const handlePhotoFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const dataUrl = await readFileAsDataUrl(file);
      setPhotoPreview(dataUrl);
      setValue('photo_path', dataUrl);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setValue('photo_path', null);
  };

  // Handlers for NID Photo
  const handleNidFromCamera = async () => {
    const dataUrl = await captureFromCamera(85);
    if (dataUrl) {
      setNidPhotoPreview(dataUrl);
      setValue('nid_photo_path', dataUrl);
    } else {
      nidCameraInputRef.current?.click();
    }
  };

  const handleNidFromGallery = async () => {
    const dataUrl = await pickFromGallery(85);
    if (dataUrl) {
      setNidPhotoPreview(dataUrl);
      setValue('nid_photo_path', dataUrl);
    } else {
      nidGalleryInputRef.current?.click();
    }
  };

  const handleNidFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const dataUrl = await readFileAsDataUrl(file);
      setNidPhotoPreview(dataUrl);
      setValue('nid_photo_path', dataUrl);
      e.target.value = '';
    }
  };

  const handleRemoveNidPhoto = () => {
    setNidPhotoPreview(null);
    setValue('nid_photo_path', null);
  };

  const onSubmit = async (data: CustomerFormData) => {
    try {
      let finalPhoto = data.photo_path;
      if (finalPhoto && finalPhoto.startsWith('data:')) {
        finalPhoto = await compressCustomerAvatar(finalPhoto);
      }

      let finalNidPhoto = data.nid_photo_path;
      if (finalNidPhoto && finalNidPhoto.startsWith('data:')) {
        finalNidPhoto = await compressDocumentPhoto(finalNidPhoto);
      }

      if (customerToEdit) {
        await updateMutation.mutateAsync({
          id: customerToEdit.id,
          name: data.name,
          phone: data.phone,
          address: data.address || undefined,
          nid_no: data.nid_no || undefined,
          photo_path: finalPhoto || undefined,
          nid_photo_path: finalNidPhoto || undefined,
          notes: data.notes || undefined,
        });
      } else {
        await createMutation.mutateAsync({
          name: data.name,
          phone: data.phone,
          address: data.address || undefined,
          nid_no: data.nid_no || undefined,
          photo_path: finalPhoto || undefined,
          nid_photo_path: finalNidPhoto || undefined,
          notes: data.notes || undefined,
        });
      }
      onClose();
    } catch (err) {
      console.error('Failed to save customer:', err);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={customerToEdit ? t('customers.edit_customer') : t('customers.add_customer')}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Customer Photo Upload (Camera + Gallery) */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="relative w-16 h-16 rounded-xl bg-slate-200 overflow-hidden flex items-center justify-center shrink-0 border border-slate-300">
            {photoPreview ? (
              <>
                <img src={photoPreview} alt="Customer" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-md shadow-xs hover:bg-rose-700 transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <div className="absolute bottom-0 inset-x-0 bg-slate-900/70 text-[9px] text-white text-center font-mono py-0.5">
                  {formatBytes(getBase64SizeInBytes(photoPreview))}
                </div>
              </>
            ) : (
              <User className="w-8 h-8 text-slate-400" />
            )}
          </div>
          <div className="space-y-1.5 flex-1">
            <span className="text-xs font-bold text-slate-800 block">
              {t('customers.customer_photo')}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePhotoFromCamera}
                className="gap-1.5 text-xs h-8 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-600" />
                <span>{language === 'bn' ? 'ক্যামেরা' : 'Camera'}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePhotoFromGallery}
                className="gap-1.5 text-xs h-8 text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
              >
                <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                <span>{language === 'bn' ? 'গ্যালারি / ফাইল' : 'Gallery / Files'}</span>
              </Button>

              <input
                ref={photoCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoFileInput}
              />
              <input
                ref={photoGalleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoFileInput}
              />
            </div>
          </div>
        </div>

        {/* NID Document Photo Upload (Camera + Gallery) */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="relative w-16 h-16 rounded-xl bg-slate-200 overflow-hidden flex items-center justify-center shrink-0 border border-slate-300">
            {nidPhotoPreview ? (
              <>
                <img src={nidPhotoPreview} alt="NID Document" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={handleRemoveNidPhoto}
                  className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-md shadow-xs hover:bg-rose-700 transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <div className="absolute bottom-0 inset-x-0 bg-slate-900/70 text-[9px] text-white text-center font-mono py-0.5">
                  {formatBytes(getBase64SizeInBytes(nidPhotoPreview))}
                </div>
              </>
            ) : (
              <CreditCard className="w-8 h-8 text-slate-400" />
            )}
          </div>
          <div className="space-y-1.5 flex-1">
            <span className="text-xs font-bold text-slate-800 block">
              {t('customers.nid_photo')}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleNidFromCamera}
                className="gap-1.5 text-xs h-8 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-600" />
                <span>{language === 'bn' ? 'ক্যামেরা' : 'Camera'}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleNidFromGallery}
                className="gap-1.5 text-xs h-8 text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
              >
                <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                <span>{language === 'bn' ? 'গ্যালারি / ফাইল' : 'Gallery / Files'}</span>
              </Button>

              <input
                ref={nidCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleNidFileInput}
              />
              <input
                ref={nidGalleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleNidFileInput}
              />
            </div>
          </div>
        </div>

        {/* Customer Name */}
        <Input
          label={t('customers.name')}
          placeholder={language === 'bn' ? 'যেমন: আব্দুর রহিম' : 'e.g. Abdur Rahim'}
          {...register('name')}
          error={errors.name?.message}
        />

        {/* Phone */}
        <Input
          label={t('common.phone')}
          placeholder="01711223344"
          {...register('phone')}
          error={errors.phone?.message}
        />

        {/* NID */}
        <Input
          label={t('customers.nid')}
          placeholder={language === 'bn' ? 'যেমন: 19852691234567890' : 'e.g. 19852691234567890'}
          {...register('nid_no')}
          error={errors.nid_no?.message}
        />

        {/* Address */}
        <Input
          label={t('common.address')}
          placeholder={language === 'bn' ? 'গ্রাম, থানা, জেলা' : 'Village, Police Station, District'}
          {...register('address')}
          error={errors.address?.message}
        />

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            {t('common.notes')}
          </label>
          <textarea
            className="flex w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            rows={2}
            placeholder={language === 'bn' ? 'গ্রাহক সম্পর্কে অতিরিক্ত তথ্য...' : 'Additional notes about customer...'}
            {...register('notes')}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting || createMutation.isPending || updateMutation.isPending}
          >
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
