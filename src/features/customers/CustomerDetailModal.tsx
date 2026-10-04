import React, { useState } from 'react';
import { Dialog } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { useI18n } from '../../lib/i18n';
import type { Customer } from '../../types/database';
import { Phone, MessageSquare, CreditCard, MapPin, FileText, User, ZoomIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ImageZoomModal } from '../../components/ui/image-zoom-modal';

interface CustomerDetailModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (cust: Customer) => void;
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  customer,
  isOpen,
  onClose,
  onEdit,
}) => {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const [zoomedImage, setZoomedImage] = useState<{ src: string; title: string } | null>(null);

  if (!customer) return null;

  const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
  const internationalPhone = cleanPhone.startsWith('880')
    ? cleanPhone
    : cleanPhone.startsWith('0')
    ? '880' + cleanPhone.substring(1)
    : '880' + cleanPhone;

  const handleCall = () => {
    window.open(`tel:${customer.phone}`);
  };

  const handleWhatsApp = () => {
    window.open(`https://wa.me/${internationalPhone}?text=${encodeURIComponent('আসসালামু আলাইকুম ' + customer.name + ' ভাই/আপা,')}`);
  };

  const handleNewMortgage = () => {
    onClose();
    navigate(`/mortgages/new?customer_id=${customer.id}`);
  };

  return (
    <>
      <Dialog
        isOpen={isOpen}
      onClose={onClose}
      title={customer.name}
      description={language === 'en' ? 'Customer Profile & Details' : 'গ্রাহক বিবরণী ও প্রোফাইল'}
    >
      <div className="space-y-4">
        {/* Customer Header Info */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-tr from-emerald-50 to-teal-50/50 border border-emerald-100">
          <div
            className={`w-16 h-16 rounded-2xl bg-white shadow-md border border-emerald-200 overflow-hidden flex items-center justify-center shrink-0 ${customer.photo_path ? 'cursor-pointer hover:border-emerald-500 hover:shadow-lg transition-all group relative' : ''}`}
            onClick={() => customer.photo_path && setZoomedImage({ src: customer.photo_path, title: customer.name })}
            title={customer.photo_path ? (language === 'bn' ? 'ছবি জুম করে দেখুন' : 'Click to zoom photo') : undefined}
          >
            {customer.photo_path ? (
              <>
                <img src={customer.photo_path} alt={customer.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ZoomIn className="w-4 h-4 text-white drop-shadow" />
                </div>
              </>
            ) : (
              <User className="w-8 h-8 text-emerald-600" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-900 leading-snug">{customer.name}</h3>
            <p className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5 mt-0.5">
              <Phone className="w-3.5 h-3.5" />
              {customer.phone}
            </p>
          </div>
        </div>

        {/* Action Buttons: Call & WhatsApp */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCall}
            className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            <Phone className="w-4 h-4 text-emerald-600" />
            <span>{t('due_list.call_customer')}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleWhatsApp}
            className="gap-2 border-teal-300 text-teal-700 hover:bg-teal-50"
          >
            <MessageSquare className="w-4 h-4 text-teal-600" />
            <span>{t('due_list.whatsapp_customer')}</span>
          </Button>
        </div>

        {/* Details List */}
        <div className="space-y-2.5 rounded-2xl bg-slate-50 p-4 border border-slate-200 text-sm">
          {customer.nid_no && (
            <div className="flex items-start gap-2.5">
              <CreditCard className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs text-slate-500 block">{t('customers.nid')}</span>
                <span className="font-semibold text-slate-800">{customer.nid_no}</span>
              </div>
            </div>
          )}

          {customer.address && (
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs text-slate-500 block">{t('common.address')}</span>
                <span className="text-slate-700">{customer.address}</span>
              </div>
            </div>
          )}

          {customer.notes && (
            <div className="flex items-start gap-2.5">
              <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs text-slate-500 block">{t('common.notes')}</span>
                <span className="text-slate-700 italic">{customer.notes}</span>
              </div>
            </div>
          )}

          {customer.nid_photo_path && (
            <div className="pt-2 border-t border-slate-200">
              <span className="text-xs text-slate-500 block mb-1.5 font-medium">{t('customers.nid_photo')}</span>
              <div
                className="group relative rounded-xl overflow-hidden border border-slate-200 max-h-48 bg-slate-100 flex items-center justify-center cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all"
                onClick={() =>
                  setZoomedImage({
                    src: customer.nid_photo_path!,
                    title:
                      language === 'bn'
                        ? `জাতীয় পরিচয়পত্র (NID) - ${customer.name}`
                        : `NID Document - ${customer.name}`,
                  })
                }
                title={language === 'bn' ? 'NID জুম করে দেখুন' : 'Click to zoom NID document'}
              >
                <img
                  src={customer.nid_photo_path}
                  alt="NID Document"
                  className="w-full h-auto max-h-48 object-contain group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="p-2 rounded-full bg-white/90 text-slate-800 shadow-md">
                    <ZoomIn className="w-4 h-4 text-emerald-700" />
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Issue Mortgage Button */}
        <Button
          type="button"
          variant="primary"
          className="w-full h-11 text-sm font-bold shadow-md shadow-emerald-600/20"
          onClick={handleNewMortgage}
        >
          {t('mortgages.new_mortgage')}
        </Button>

        {onEdit && (
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onClose();
                onEdit(customer);
              }}
            >
              {t('common.edit')}
            </Button>
          </div>
        )}
      </div>
    </Dialog>

    {zoomedImage && (
      <ImageZoomModal
        isOpen={Boolean(zoomedImage)}
        onClose={() => setZoomedImage(null)}
        images={zoomedImage.src}
        title={zoomedImage.title}
      />
    )}
  </>
  );
};
