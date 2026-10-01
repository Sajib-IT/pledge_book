import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { useI18n } from '../../lib/i18n';
import type { Customer } from '../../types/database';
import { useCreateCustomer, useUpdateCustomer } from './useCustomers';
import { Camera, User } from 'lucide-react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';

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
    }
  }, [customerToEdit, reset, isOpen]);

  const handleTakePhoto = async () => {
    try {
      const image = await CapCamera.getPhoto({
        quality: 85,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt, // Prompts camera or photos
      });

      if (image?.dataUrl) {
        setPhotoPreview(image.dataUrl);
        setValue('photo_path', image.dataUrl);
      }
    } catch {
      // Fallback for desktop browser: triggers standard file input
      const fileInput = document.getElementById('customer-photo-file') as HTMLInputElement;
      if (fileInput) fileInput.click();
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setPhotoPreview(base64);
        setValue('photo_path', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: CustomerFormData) => {
    try {
      if (customerToEdit) {
        await updateMutation.mutateAsync({
          id: customerToEdit.id,
          name: data.name,
          phone: data.phone,
          address: data.address || undefined,
          nid_no: data.nid_no || undefined,
          photo_path: data.photo_path || undefined,
          nid_photo_path: data.nid_photo_path || undefined,
          notes: data.notes || undefined,
        });
      } else {
        await createMutation.mutateAsync({
          name: data.name,
          phone: data.phone,
          address: data.address || undefined,
          nid_no: data.nid_no || undefined,
          photo_path: data.photo_path || undefined,
          nid_photo_path: data.nid_photo_path || undefined,
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
        {/* Customer Photo Upload / Camera Preview */}
        <div className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="relative w-16 h-16 rounded-xl bg-slate-200 overflow-hidden flex items-center justify-center shrink-0 border border-slate-300">
            {photoPreview ? (
              <img src={photoPreview} alt="Customer" className="w-full h-full object-cover" />
            ) : (
              <User className="w-8 h-8 text-slate-400" />
            )}
          </div>
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-800 block">
              {t('customers.customer_photo')}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTakePhoto}
                className="gap-1.5 text-xs h-8"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t('customers.take_photo')}</span>
              </Button>
              <input
                id="customer-photo-file"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileInput}
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
