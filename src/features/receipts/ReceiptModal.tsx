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
    if (!receiptRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt_${payment.receipt_no}</title>
          <style>
            @page { size: A5 portrait; margin: 8mm; }
            body { margin: 0; padding: 0; font-family: Inter, system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #fff; }
            * { box-sizing: border-box; }
          </style>
        </head>
        <body>
          <div style="width: 100%; max-width: 460px;">
            ${receiptRef.current.innerHTML}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Download PDF action
  const handleDownloadPDF = async () => {
    if (!receiptRef.current) return;
    setIsDownloading(true);
    try {
      const element = receiptRef.current;
      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
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
      const posY = (pageHeight - renderH) / 2;

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
          style={{
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            border: '2px solid #059669',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '460px',
            margin: '0 auto',
            boxSizing: 'border-box',
          }}
          className="shadow-md space-y-4"
        >
          {/* Business Header */}
          <div
            style={{
              textAlign: 'center',
              paddingBottom: '14px',
              borderBottom: '2px dashed #cbd5e1',
            }}
          >
            <h2
              style={{
                fontSize: '20px',
                fontWeight: '900',
                color: '#065f46',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              {businessName}
            </h2>
            <p
              style={{
                fontSize: '12px',
                color: '#64748b',
                fontWeight: '500',
                margin: '3px 0 0 0',
              }}
            >
              {t('receipts.tagline')}
            </p>
            <p
              style={{
                fontSize: '11px',
                color: '#94a3b8',
                margin: '2px 0 0 0',
              }}
            >
              {businessAddress} • {t('common.phone')}: {businessPhone}
            </p>
            <div
              style={{
                marginTop: '10px',
                display: 'inline-block',
                backgroundColor: '#ecfdf5',
                color: '#065f46',
                fontSize: '11px',
                fontWeight: '700',
                padding: '4px 14px',
                borderRadius: '9999px',
                border: '1px solid #6ee7b7',
                letterSpacing: '0.05em',
              }}
            >
              ✓ {t('receipts.customer_copy')}
            </div>
          </div>

          {/* Receipt Meta */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              paddingBottom: '4px',
            }}
          >
            <div>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '10px' }}>
                {t('payments.receipt_no')}
              </span>
              <span style={{ fontFamily: 'monospace', fontWeight: '800', color: '#0f172a', fontSize: '14px' }}>
                {payment.receipt_no}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '10px' }}>
                {t('payments.paid_on')}
              </span>
              <span style={{ fontWeight: '700', color: '#1e293b' }}>
                {formatDateDhaka(payment.paid_on, language)}
              </span>
            </div>
          </div>

          {/* Customer & Mortgage Details */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 14px',
              fontSize: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
              <span style={{ color: '#64748b', fontWeight: '500' }}>{t('customers.name')}:</span>
              <span style={{ fontWeight: '800', color: '#0f172a' }}>{mortgage.customer?.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
              <span style={{ color: '#64748b', fontWeight: '500' }}>{t('common.phone')}:</span>
              <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#334155' }}>
                {mortgage.customer?.phone}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
              <span style={{ color: '#64748b', fontWeight: '500' }}>{t('mortgages.mortgage_no')}:</span>
              <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#334155' }}>
                {mortgage.mortgage_no}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                paddingTop: '6px',
                marginTop: '4px',
                borderTop: '1px solid #e2e8f0',
                gap: '12px',
              }}
            >
              <span style={{ color: '#64748b', fontWeight: '500', flexShrink: 0 }}>
                {t('mortgages.collateral_type')}:
              </span>
              <span
                style={{
                  fontStyle: 'italic',
                  fontWeight: '600',
                  color: '#1e293b',
                  textAlign: 'right',
                  wordBreak: 'break-word',
                  maxWidth: '240px',
                }}
              >
                {mortgage.collateral_description ||
                  t(`mortgages.collateral_types.${mortgage.collateral_type}`, mortgage.collateral_type)}
              </span>
            </div>
          </div>

          {/* Payment Type and Amount */}
          <div
            style={{
              backgroundColor: '#ecfdf5',
              border: '1.5px solid #a7f3d0',
              borderRadius: '14px',
              padding: '16px',
              textAlign: 'center',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: '800',
                color: '#065f46',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'block',
              }}
            >
              {paymentTypeTitle}
            </span>
            <div
              style={{
                fontSize: '28px',
                fontWeight: '900',
                color: '#064e3b',
                fontFamily: 'monospace',
                marginTop: '6px',
              }}
            >
              {formatBDT(payment.amount, language)}
            </div>
            <p
              style={{
                fontSize: '11px',
                color: '#047857',
                margin: '6px 0 0 0',
                fontWeight: '500',
              }}
            >
              {language === 'bn'
                ? 'নগদে বুঝিয়া পাইয়া রশিদ প্রদান করা হলো।'
                : 'Received with thanks in cash and receipt issued.'}
            </p>
          </div>

          {payment.note && (
            <p
              style={{
                fontSize: '11px',
                color: '#64748b',
                fontStyle: 'italic',
                borderLeft: '3px solid #6ee7b7',
                paddingLeft: '10px',
                margin: 0,
              }}
            >
              {t('payments.note')}: {payment.note}
            </p>
          )}

          {/* Signatures */}
          <div
            style={{
              paddingTop: '20px',
              paddingBottom: '4px',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: '#64748b',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '110px',
                  borderTop: '1.5px solid #94a3b8',
                  paddingTop: '4px',
                  fontWeight: '600',
                  color: '#475569',
                }}
              >
                {language === 'bn' ? 'গ্রাহকের স্বাক্ষর' : "Customer's Signature"}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '120px',
                  borderTop: '1.5px solid #94a3b8',
                  paddingTop: '4px',
                  fontWeight: '800',
                  color: '#0f172a',
                }}
              >
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
