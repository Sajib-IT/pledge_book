// src/features/receipts/ReceiptModal.tsx
import React, { useRef, useState } from 'react';
import { Dialog } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { useI18n } from '../../lib/i18n';
import { formatBDT, formatDateDhaka } from '../../lib/calculations';
import type { Payment, Mortgage } from '../../types/database';
import { Share2, Download, Printer, ShieldCheck } from 'lucide-react';
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

  const businessName = import.meta.env.VITE_BUSINESS_NAME || 'মেসার্স আলম ব্রাদার্স ট্রেডার্স ও বন্ধকী';

  const paymentTypeTitle =
    payment.type === 'interest'
      ? 'বার্ষিক সুদ আদায় ও ১ বছর মেয়াদ বৃদ্ধি (Renewal)'
      : payment.type === 'full_payment'
      ? 'আসল + সুদ সম্পূর্ণ পরিশোধ ও বন্ধক সমাপ্তি (Closure)'
      : 'ভুল পেমেন্ট রিভার্সাল ও সংশোধনী এন্ট্রি (Correction)';

  // Print action
  const handlePrint = () => {
    window.print();
  };

  // Download PDF action
  const handleDownloadPDF = async () => {
    if (!receiptRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5',
      });
      const imgWidth = 148;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`Receipt_${payment.receipt_no}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('PDF তৈরি করতে সমস্যা হয়েছে। প্রিন্ট অপশন ব্যবহার করুন।');
    } finally {
      setIsDownloading(false);
    }
  };

  // Share via WhatsApp / Capacitor Share
  const handleShare = async () => {
    const text = `*পেমেন্ট রসিদ - ${businessName}*\nরসিদ নং: ${payment.receipt_no}\nগ্রাহক: ${mortgage.customer?.name}\nটাকার পরিমাণ: ${formatBDT(payment.amount, 'bn')}\nতারিখ: ${formatDateDhaka(payment.paid_on, 'bn')}\nবন্ধক নং: ${mortgage.mortgage_no}`;

    try {
      await Share.share({
        title: `Receipt ${payment.receipt_no}`,
        text: text,
        dialogTitle: 'রসিদ শেয়ার করুন (হোয়াটসঅ্যাপ)',
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
      title="পেমেন্ট রসিদ"
      description="গ্রাহক কপি ও অফিশিয়াল ভাউচার"
      className="max-w-md"
    >
      <div className="space-y-4">
        {/* Printable Receipt Paper Container */}
        <div
          ref={receiptRef}
          className="p-6 rounded-2xl bg-white border-2 border-emerald-800/20 shadow-sm text-slate-900 space-y-4 font-sans print:p-0 print:border-none"
        >
          {/* Business Header */}
          <div className="text-center pb-3 border-b-2 border-dashed border-slate-300">
            <h2 className="text-lg font-black text-emerald-800 tracking-tight">
              {businessName}
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              বিশ্বস্ততার সাথে স্বর্ণ ও বন্ধকী ব্যবসা
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              উত্তরা, ঢাকা • মোবাইল: ০১৭১১০০০০০১
            </p>
            <div className="mt-2 inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
              <ShieldCheck className="w-3 h-3" />
              <span>{t('receipts.customer_copy')}</span>
            </div>
          </div>

          {/* Receipt Meta */}
          <div className="flex items-center justify-between text-xs pb-1">
            <div>
              <span className="text-slate-400 block text-[10px]">রসিদ নম্বর</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {payment.receipt_no}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px]">তারিখ</span>
              <span className="font-semibold text-slate-800">
                {formatDateDhaka(payment.paid_on, language)}
              </span>
            </div>
          </div>

          {/* Customer & Mortgage Details */}
          <div className="space-y-1.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <div className="flex justify-between">
              <span className="text-slate-500">গ্রাহকের নাম:</span>
              <span className="font-bold text-slate-800">{mortgage.customer?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">মোবাইল:</span>
              <span className="font-mono font-semibold text-slate-700">
                {mortgage.customer?.phone}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">বন্ধক নং:</span>
              <span className="font-mono font-semibold text-slate-700">
                {mortgage.mortgage_no}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">জামানত:</span>
              <span className="text-slate-700 line-clamp-1 italic max-w-[200px] text-right">
                {mortgage.collateral_description}
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
              নগদে বুঝিয়া পাইয়া রশিদ প্রদান করা হলো।
            </p>
          </div>

          {payment.note && (
            <p className="text-[11px] text-slate-500 italic border-l-2 border-emerald-300 pl-2">
              মন্তব্য: {payment.note}
            </p>
          )}

          {/* Signatures */}
          <div className="pt-6 flex items-end justify-between text-[11px] text-slate-500">
            <div className="text-center">
              <div className="w-24 border-t border-slate-300 pt-1">গ্রাহকের স্বাক্ষর</div>
            </div>
            <div className="text-center">
              <div className="w-28 border-t border-slate-300 pt-1 font-semibold text-slate-800">
                দায়িত্বপ্রাপ্ত কর্মকর্তা
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
            <span>প্রিন্ট</span>
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
            <span>শেয়ার</span>
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
