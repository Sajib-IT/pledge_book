// src/features/receipts/ReceiptModal.tsx
import React, { useRef, useState } from 'react';
import { Dialog } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { useI18n } from '../../lib/i18n';
import { formatBDT, formatDateDhaka } from '../../lib/calculations';
import type { Payment, Mortgage } from '../../types/database';
import { Share2, Download, Printer } from 'lucide-react';
import { Share } from '@capacitor/share';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
  mortgage: Mortgage | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  payment,
  mortgage,
}) => {
  const { language, t } = useI18n();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!payment || !mortgage) return null;

  const businessName =
    localStorage.getItem('business_name') ||
    import.meta.env.VITE_BUSINESS_NAME ||
    'মেসার্স আলম ব্রাদার্স ট্রেডার্স ও বন্ধকী';
  const businessAddress =
    localStorage.getItem('business_address') || 'উত্তরা, ঢাকা';
  const businessPhone =
    localStorage.getItem('business_phone') || '০১৭১১০০০০০১';

  const paymentTypeTitle =
    payment.type === 'interest'
      ? (language === 'bn' ? 'বার্ষিক সুদ আদায় ও ১ বছর মেয়াদ বৃদ্ধি (নবায়ন)' : 'Annual Interest Payment & 1-Year Extension (Renewal)')
      : payment.type === 'full_payment'
      ? (language === 'bn' ? 'আসল + সুদ সম্পূর্ণ পরিশোধ ও বন্ধক সমাপ্তি' : 'Principal + Interest Full Settlement & Closure')
      : (language === 'bn' ? 'ভুল পেমেন্ট রিভার্সাল ও সংশোধনী এন্ট্রি' : 'Payment Reversal & Correction Entry');

  // Print action
  const handlePrint = () => {
    window.print();
  };

  // Download PDF action
  const handleDownloadPDF = async () => {
    if (!receiptRef.current) return;
    setIsDownloading(true);
    try {
      const element = receiptRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');

      const pageWidth = 148;
      const pageHeight = 210;
      const margin = 8;
      const maxW = pageWidth - margin * 2;
      const maxH = pageHeight - margin * 2;

      let renderW = maxW;
      let renderH = (canvas.height * renderW) / canvas.width;

      if (renderH > maxH) {
        renderH = maxH;
        renderW = (canvas.width * renderH) / canvas.height;
      }

      const posX = (pageWidth - renderW) / 2;
      const posY = margin + (maxH - renderH) / 2;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5',
      });

      pdf.addImage(imgData, 'PNG', posX, posY, renderW, renderH);
      pdf.save(`Receipt_${payment.receipt_no}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert(language === 'bn' ? 'PDF তৈরি করতে সমস্যা হয়েছে। প্রিন্ট অপশন ব্যবহার করুন।' : 'Failed to generate PDF. Please use the Print option.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Share via WhatsApp / Capacitor Share
  const handleShare = async () => {
    const text = language === 'bn'
      ? `*পেমেন্ট রসিদ - ${businessName}*\nরসিদ নং: ${payment.receipt_no}\nগ্রাহক: ${mortgage.customer?.name}\nটাকার পরিমাণ: ${formatBDT(payment.amount, 'bn')}\nতারিখ: ${formatDateDhaka(payment.paid_on, 'bn')}\nবন্ধক নং: ${mortgage.mortgage_no}`
      : `*Payment Receipt - ${businessName}*\nReceipt No: ${payment.receipt_no}\nCustomer: ${mortgage.customer?.name}\nAmount: ${formatBDT(payment.amount, 'en')}\nDate: ${formatDateDhaka(payment.paid_on, 'en')}\nMortgage No: ${mortgage.mortgage_no}`;

    try {
      await Share.share({
        title: `Receipt ${payment.receipt_no}`,
        text: text,
        dialogTitle: language === 'bn' ? 'রসিদ শেয়ার করুন (হোয়াটসঅ্যাপ)' : 'Share Receipt (WhatsApp)',
      });
    } catch {
      // Fallback for desktop: Open WhatsApp web
      const cleanPhone = (mortgage.customer?.phone || '').replace(/[^0-9]/g, '');
      const intlPhone = cleanPhone.startsWith('880')
        ? cleanPhone
        : cleanPhone.startsWith('0')
        ? '880' + cleanPhone.substring(1)
        : '880' + cleanPhone;
      window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('receipts.title')}
      description={language === 'bn' ? 'গ্রাহক কপি ও অফিশিয়াল ভাউচার' : 'Customer Copy & Official Receipt Voucher'}
      className="max-w-md"
    >
      <div className="space-y-4">
        {/* Printable Receipt Paper Container */}
        <div
          ref={receiptRef}
          id="printable-receipt"
          className="p-5 rounded-2xl bg-white border border-emerald-800/20 shadow-sm text-slate-900 space-y-3.5 font-sans print:p-0 print:border-none"
        >
          {/* Business Header */}
          <div className="text-center pb-2.5 border-b-2 border-dashed border-slate-300">
            <h2 className="text-lg font-black text-emerald-800 tracking-tight">
              {businessName}
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              {t('receipts.tagline')}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {businessAddress} • {t('common.phone')}: {businessPhone}
            </p>
            <div className="mt-2 inline-block bg-emerald-50 text-emerald-800 text-[11px] font-bold px-3 py-0.5 rounded-full border border-emerald-300 tracking-wide">
              ✓ {t('receipts.customer_copy')}
            </div>
          </div>

          {/* Receipt Meta */}
          <div className="flex items-center justify-between text-xs pb-1">
            <div>
              <span className="text-slate-400 block text-[10px]">{t('payments.receipt_no')}</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {payment.receipt_no}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px]">{t('payments.paid_on')}</span>
              <span className="font-semibold text-slate-800">
                {formatDateDhaka(payment.paid_on, language)}
              </span>
            </div>
          </div>

          {/* Customer & Mortgage Details */}
          <div className="space-y-1.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">{t('customers.name')}:</span>
              <span className="font-bold text-slate-800">{mortgage.customer?.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">{t('common.phone')}:</span>
              <span className="font-mono font-semibold text-slate-700">
                {mortgage.customer?.phone}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">{t('mortgages.mortgage_no')}:</span>
              <span className="font-mono font-semibold text-slate-700">
                {mortgage.mortgage_no}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3 pt-1 border-t border-slate-200/60">
              <span className="text-slate-500 font-medium shrink-0">{t('mortgages.collateral_type')}:</span>
              <span className="text-slate-800 font-semibold italic text-right break-words max-w-[220px]">
                {mortgage.collateral_description || t(`mortgages.collateral_types.${mortgage.collateral_type}`, mortgage.collateral_type)}
              </span>
            </div>
          </div>

          {/* Payment Type and Amount */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-center">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
              {paymentTypeTitle}
            </span>
            <div className="text-2xl font-black text-emerald-900 font-mono mt-1">
              {formatBDT(payment.amount, language)}
            </div>
            <p className="text-[11px] text-emerald-700 mt-1">
              {language === 'bn' ? 'নগদে বুঝিয়া পাইয়া রশিদ প্রদান করা হলো।' : 'Received with thanks in cash and receipt issued.'}
            </p>
          </div>

          {payment.note && (
            <p className="text-[11px] text-slate-500 italic border-l-2 border-emerald-300 pl-2">
              {t('payments.note')}: {payment.note}
            </p>
          )}

          {/* Signatures */}
          <div className="pt-5 pb-1 flex items-end justify-between text-[11px] text-slate-500">
            <div className="text-center">
              <div className="w-24 border-t border-slate-400 pt-1 font-medium text-slate-600">
                {language === 'bn' ? 'গ্রাহকের স্বাক্ষর' : "Customer's Signature"}
              </div>
            </div>
            <div className="text-center">
              <div className="w-28 border-t border-slate-400 pt-1 font-bold text-slate-800">
                {language === 'bn' ? 'দায়িত্বপ্রাপ্ত কর্মকর্তা' : 'Authorized Officer'}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 text-xs h-10"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'প্রিন্ট' : 'Print'}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadPDF}
            isLoading={isDownloading}
            className="gap-1.5 text-xs h-10"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF</span>
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleShare}
            className="gap-1.5 text-xs h-10 bg-teal-600 hover:bg-teal-700 text-white"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'শেয়ার' : 'Share'}</span>
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
