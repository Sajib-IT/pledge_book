import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  useMortgageDetail,
  useRenewMortgage,
  useCloseMortgage,
  useAddCorrection,
} from './useMortgages';
import { useI18n } from '../../lib/i18n';
import {
  formatBDT,
  formatDateDhaka,
  isMortgageOverdue,
  getDaysUntilDue,
  calculateYearlyInterest,
  calculateEarlySettlement,
  calculateRenewWithDiscount,
  getTodayDhakaDateString,
  type InterestCalculationMode,
} from '../../lib/calculations';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Dialog } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import type { Payment } from '../../types/database';
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  AlertTriangle,
  RotateCw,
  CheckCircle2,
  FileText,
  RotateCcw,
  Gem,
  Clock,
  ShieldCheck,
  Printer,
  Tag,
} from 'lucide-react';
import { ReceiptModal } from '../receipts/ReceiptModal';

export const MortgageDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { language, t } = useI18n();

  const { data, isLoading, isError, error, refetch } = useMortgageDetail(id);
  const renewMutation = useRenewMortgage();
  const closeMutation = useCloseMortgage();
  const correctionMutation = useAddCorrection();

  // Modals state
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [correctionTargetPayment, setCorrectionTargetPayment] = useState<Payment | null>(null);

  // Form states for modals
  const [paymentDate, setPaymentDate] = useState(getTodayDhakaDateString());
  const [paymentNote, setPaymentNote] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');

  // Close Modal Early Repayment & Discount States
  const [closeMode, setCloseMode] = useState<InterestCalculationMode>('full_year');
  const [closeDiscount, setCloseDiscount] = useState<number>(0);
  const [customCloseInterest, setCustomCloseInterest] = useState<string>('');

  // Renew Modal Discount & Custom Interest States
  const [renewDiscount, setRenewDiscount] = useState<number>(0);
  const [customRenewInterest, setCustomRenewInterest] = useState<string>('');

  const [successReceipt, setSuccessReceipt] = useState<{
    type: 'renew' | 'close' | 'correction';
    receipt_no: string;
    amount: number;
  } | null>(null);
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<Payment | null>(null);

  if (isLoading) {
    return <LoadingSpinner fullPage message={t('common.loading')} />;
  }

  if (isError || !data?.mortgage) {
    return (
      <div className="p-8 text-center rounded-2xl bg-white border border-slate-200">
        <p className="text-base font-bold text-rose-600">
          {t('common.error')}: {(error as Error)?.message || 'Mortgage not found'}
        </p>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-4">
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  const { mortgage, payments } = data;
  const isOverdue = isMortgageOverdue(mortgage.due_date, mortgage.status);
  const daysUntilDue = getDaysUntilDue(mortgage.due_date);
  const yearlyInterest = calculateYearlyInterest(mortgage.principal, mortgage.interest_rate);

  // Early repayment calculation for Close Modal
  const earlySettlement = calculateEarlySettlement(
    mortgage.principal,
    mortgage.interest_rate,
    mortgage.start_date,
    paymentDate,
    closeMode,
    closeDiscount,
    customCloseInterest ? Number(customCloseInterest) : undefined
  );

  // Renewal calculation with discounts
  const renewCalculation = calculateRenewWithDiscount(
    mortgage.principal,
    mortgage.interest_rate,
    renewDiscount,
    customRenewInterest ? Number(customRenewInterest) : undefined
  );

  // Phone Call & WhatsApp helpers
  const phone = mortgage.customer?.phone || '';
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const internationalPhone = cleanPhone.startsWith('880')
    ? cleanPhone
    : cleanPhone.startsWith('0')
    ? '880' + cleanPhone.substring(1)
    : '880' + cleanPhone;

  const handleCall = () => window.open(`tel:${phone}`);
  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      language === 'bn'
        ? `আসসালামু আলাইকুম ${mortgage.customer?.name || ''} ভাই/আপা, আপনার বন্ধকী (${mortgage.mortgage_no}) সংক্রান্ত যোগাযোগ।`
        : `Hello ${mortgage.customer?.name || ''}, contacting you regarding your mortgage ${mortgage.mortgage_no}.`
    );
    window.open(`https://wa.me/${internationalPhone}?text=${text}`);
  };

  // Submit Renew RPC
  const handleConfirmRenew = async () => {
    try {
      const netAmount = renewCalculation.netInterest;
      const discountText =
        renewCalculation.discount > 0
          ? ` [${language === 'bn' ? 'ছাড়' : 'Discount'}: ${formatBDT(renewCalculation.discount, language)}]`
          : '';
      const detailedNote =
        (paymentNote ? paymentNote + ' ' : '') +
        `(${language === 'bn' ? 'বার্ষিক সুদ' : 'Yearly Interest'}: ${formatBDT(renewCalculation.yearlyInterest, language)}${discountText})`;

      const res = await renewMutation.mutateAsync({
        mortgageId: mortgage.id,
        paidOn: paymentDate,
        note: detailedNote,
        amount: netAmount,
      });

      setIsRenewModalOpen(false);
      setSuccessReceipt({
        type: 'renew',
        receipt_no: (res as any).receipt_no,
        amount: netAmount,
      });
      setPaymentNote('');
      setRenewDiscount(0);
      setCustomRenewInterest('');
    } catch (err) {
      alert((language === 'bn' ? 'রিনিউ সম্পন্ন করতে সমস্যা হয়েছে: ' : 'Failed to renew mortgage: ') + (err as Error).message);
    }
  };

  // Submit Close RPC (Supports Early Settlement and Discounts)
  const handleConfirmClose = async () => {
    try {
      const totalAmount = earlySettlement.total;
      const discountText =
        earlySettlement.discount > 0
          ? ` [${language === 'bn' ? 'ছাড়' : 'Discount'}: ${formatBDT(earlySettlement.discount, language)}]`
          : '';
      const modeText =
        earlySettlement.mode !== 'full_year'
          ? ` [${language === 'bn' ? 'পদ্ধতি' : 'Mode'}: ${earlySettlement.mode}, ${language === 'bn' ? 'অতিবাহিত' : 'Elapsed'}: ${earlySettlement.daysElapsed} ${language === 'bn' ? 'দিন' : 'days'}]`
          : '';
      const detailedNote =
        (paymentNote ? paymentNote + ' ' : '') +
        `(${language === 'bn' ? 'আসল' : 'Principal'}: ${formatBDT(earlySettlement.principal, language)}, ${language === 'bn' ? 'নিট সুদ' : 'Net Interest'}: ${formatBDT(earlySettlement.netInterest, language)}${discountText}${modeText})`;

      const res = await closeMutation.mutateAsync({
        mortgageId: mortgage.id,
        paidOn: paymentDate,
        note: detailedNote,
        amount: totalAmount,
      });

      setIsCloseModalOpen(false);
      setSuccessReceipt({
        type: 'close',
        receipt_no: (res as any).receipt_no,
        amount: totalAmount,
      });
      setPaymentNote('');
      setCloseDiscount(0);
      setCustomCloseInterest('');
    } catch (err) {
      alert((language === 'bn' ? 'বন্ধক পরিশোধ ও সমাপ্তি সম্পন্ন করতে সমস্যা হয়েছে: ' : 'Failed to close mortgage: ') + (err as Error).message);
    }
  };

  // Submit Correction RPC
  const handleConfirmCorrection = async () => {
    if (!correctionTargetPayment || !correctionReason.trim()) {
      alert(language === 'bn' ? 'সংশোধনের কারণ উল্লেখ করা আবশ্যক' : 'Reason for correction is required');
      return;
    }

    try {
      const res = await correctionMutation.mutateAsync({
        paymentId: correctionTargetPayment.id,
        mortgageId: mortgage.id,
        reason: correctionReason.trim(),
      });

      setCorrectionTargetPayment(null);
      setCorrectionReason('');
      setSuccessReceipt({
        type: 'correction',
        receipt_no: (res as any).receipt_no,
        amount: (res as any).reversal_amount,
      });
    } catch (err) {
      alert((language === 'bn' ? 'সংশোধন ব্যর্থ হয়েছে: ' : 'Correction failed: ') + (err as Error).message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 md:pb-12">
      {/* Top Bar with Back & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/mortgages"
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                {mortgage.mortgage_no}
              </span>
              {isOverdue ? (
                <Badge variant="overdue" className="gap-1 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{t('mortgages.status_overdue')}</span>
                </Badge>
              ) : mortgage.status === 'closed' ? (
                <Badge variant="closed" className="gap-1 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t('mortgages.status_closed')}</span>
                </Badge>
              ) : (
                <Badge variant="active" className="gap-1 font-semibold">
                  <span>{t('mortgages.status_active')}</span>
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {t('mortgages.start_date')}: {formatDateDhaka(mortgage.start_date, language)} • {t('mortgages.due_date')}:{' '}
              {formatDateDhaka(mortgage.due_date, language)}
            </p>
          </div>
        </div>

        {/* Quick Action Buttons for Active Mortgages */}
        {mortgage.status === 'active' && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setPaymentDate(getTodayDhakaDateString());
                setIsRenewModalOpen(true);
              }}
              className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 font-bold"
            >
              <RotateCw className="w-4 h-4 text-blue-600" />
              <span>{t('mortgages.renew_btn')}</span>
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                setPaymentDate(getTodayDhakaDateString());
                setIsCloseModalOpen(true);
              }}
              className="gap-1.5 shadow-md shadow-emerald-700/20 font-bold"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t('mortgages.close_btn')}</span>
            </Button>
          </div>
        )}
      </div>

      {/* Success Receipt Alert */}
      {successReceipt && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-950">
                {language === 'bn' ? 'লেনদেন সফলভাবে সম্পন্ন ও সংরক্ষিত হয়েছে' : 'Transaction successfully processed and recorded'}
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">
                {t('payments.receipt_no')}: <strong className="font-mono">{successReceipt.receipt_no}</strong> • {language === 'bn' ? 'পরিমাণ:' : 'Amount:'}{' '}
                <strong>{formatBDT(successReceipt.amount, language)}</strong>
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const matchedPayment = payments.find((p) => p.receipt_no === successReceipt.receipt_no) || {
                id: 'temp-id',
                receipt_no: successReceipt.receipt_no,
                mortgage_id: mortgage.id,
                paid_on: paymentDate,
                type: successReceipt.type === 'renew' ? 'interest' : 'full_payment',
                amount: successReceipt.amount,
                received_by: null,
                note: paymentNote,
                original_payment_id: null,
                created_at: new Date().toISOString(),
              };
              setSelectedReceiptPayment(matchedPayment as Payment);
            }}
            className="gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 font-bold shrink-0"
          >
            <Printer className="w-4 h-4 text-emerald-700" />
            <span>{language === 'bn' ? 'রসিদ প্রিন্ট / শেয়ার' : 'Print / Share Receipt'}</span>
          </Button>
        </div>
      )}

      {/* Overdue Alert Banner */}
      {isOverdue && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-900">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs sm:text-sm">
            <p className="font-bold">
              {language === 'bn'
                ? `সতর্কতা: এই বন্ধকটির মেয়াদ ${Math.abs(daysUntilDue)} দিন আগে উত্তীর্ণ হয়েছে!`
                : `Warning: This mortgage expired ${Math.abs(daysUntilDue)} days ago!`}
            </p>
            <p className="text-rose-700 text-xs mt-0.5">
              {language === 'bn'
                ? 'অনতিবিলম্বে গ্রাহকের সাথে যোগাযোগ করে বার্ষিক সুদ আদায়পূর্বক নবায়ন অথবা আসল+সুদ সম্পূর্ণ আদায় করুন।'
                : 'Contact customer immediately to collect annual interest renewal or full settlement.'}
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: 2 columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Financial Summary & Payment History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Financial Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  {t('mortgages.principal')}
                </span>
                <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-1">
                  {formatBDT(mortgage.principal, language)}
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {language === 'bn' ? 'মূল ঋণ হিসাব' : 'Base loan balance'}
                </span>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardContent className="p-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  {t('mortgages.calculated_yearly_interest')}
                </span>
                <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono mt-1">
                  {formatBDT(yearlyInterest, language)}
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {language === 'bn'
                    ? `হার: ${mortgage.interest_rate}% বার্ষিক ফ্ল্যাট`
                    : `Rate: ${mortgage.interest_rate}% yearly flat`}
                </span>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardContent className="p-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  {language === 'bn' ? '১ বছরে মোট নিষ্পত্তি' : '1-Year Total Settlement'}
                </span>
                <div className="text-xl sm:text-2xl font-black text-blue-900 font-mono mt-1">
                  {formatBDT(mortgage.principal + yearlyInterest, language)}
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {language === 'bn' ? 'আসল + ১ বছরের সুদ' : 'Principal + 1 year interest'}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Collateral Details Card */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Gem className="w-4 h-4 text-emerald-600" />
                <CardTitle className="text-base font-bold">
                  {t('mortgages.collateral_desc')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 leading-relaxed font-medium">
                {mortgage.collateral_description}
              </div>

              {/* Photos Gallery */}
              {mortgage.collateral_photo_paths && mortgage.collateral_photo_paths.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-600 block">
                    {language === 'bn' ? 'সংযুক্ত জামানতের ছবিসমূহ:' : 'Attached Collateral Photos:'}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {mortgage.collateral_photo_paths.map((p, idx) => (
                      <div
                        key={idx}
                        className="aspect-square rounded-xl bg-slate-100 border border-slate-200 overflow-hidden"
                      >
                        <img
                          src={p}
                          alt={`Collateral ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment History Timeline (Strictly Immutable, Corrections Only) */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <CardTitle className="text-base font-bold">
                    {t('mortgages.payment_history')}
                  </CardTitle>
                </div>
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  {language === 'bn' ? `মোট ${payments.length}টি লেনদেন` : `${payments.length} transactions`}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  {language === 'bn'
                    ? 'এখনো কোনো কিস্তি বা সুদ পরিশোধের রেকর্ড নেই।'
                    : 'No payment or renewal records yet.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {payments.map((p) => {
                    const isCorrection = p.type === 'correction';
                    const isFullPayment = p.type === 'full_payment';

                    return (
                      <div
                        key={p.id}
                        className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isCorrection ? 'bg-rose-50/40 -mx-4 px-4 rounded-xl' : ''
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                              {p.receipt_no}
                            </span>
                            <Badge
                              variant={
                                isCorrection
                                  ? 'reversal'
                                  : isFullPayment
                                  ? 'closed'
                                  : 'active'
                              }
                            >
                              {isCorrection
                                ? t('payments.type_correction')
                                : isFullPayment
                                ? t('payments.type_full_payment')
                                : t('payments.type_interest')}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500">
                            {t('payments.paid_on')}: {formatDateDhaka(p.paid_on, language)}
                            {p.receiver_profile && (
                              <span> • {t('payments.received_by')}: {p.receiver_profile.name}</span>
                            )}
                          </p>
                          {p.note && (
                            <p className="text-xs text-slate-600 italic mt-0.5">
                              {p.note}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0">
                          <span
                            className={`font-mono text-base font-black ${
                              p.amount < 0
                                ? 'text-rose-600'
                                : 'text-slate-900'
                            }`}
                          >
                            {formatBDT(p.amount, language)}
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedReceiptPayment(p)}
                              title={language === 'bn' ? 'রসিদ দেখুন ও প্রিন্ট করুন' : 'View & Print Receipt'}
                              className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors"
                            >
                              <Printer className="w-4 h-4" />
                            </button>

                            {/* Correction Button (Only for positive payments) */}
                            {p.amount > 0 && !isCorrection && (
                              <button
                                type="button"
                                onClick={() => setCorrectionTargetPayment(p)}
                                title={t('payments.add_correction')}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1 Col): Customer Card */}
        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                {t('mortgages.customer')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  {mortgage.customer?.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {mortgage.customer?.phone}
                </p>
              </div>

              {/* Action Buttons: Call & WhatsApp */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCall}
                  className="gap-1.5 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 h-9"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{t('mortgages.call')}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleWhatsApp}
                  className="gap-1.5 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 h-9"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-teal-600" />
                  <span>{t('mortgages.whatsapp')}</span>
                </Button>
              </div>

              {mortgage.customer?.address && (
                <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-0.5">{t('common.address')}:</span>
                  <span>{mortgage.customer.address}</span>
                </div>
              )}

              {mortgage.customer?.nid_no && (
                <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-0.5">{t('customers.nid')}:</span>
                  <span className="font-mono">{mortgage.customer.nid_no}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MODAL 1: RENEW CONFIRMATION DIALOG (With Discount & Underpayment support) */}
      <Dialog
        isOpen={isRenewModalOpen}
        onClose={() => setIsRenewModalOpen(false)}
        title={t('mortgages.renew_dialog_title')}
        description={t('mortgages.renew_dialog_desc')}
      >
        <div className="space-y-4">
          {/* Financial Breakdown */}
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-center space-y-2">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider block">
              {language === 'bn' ? 'প্রদেয় নিট সুদের পরিমাণ' : 'Net Interest Payable'}
            </span>
            <div className="text-2xl sm:text-3xl font-black text-blue-900 font-mono">
              {formatBDT(renewCalculation.netInterest, language)}
            </div>
            <div className="flex items-center justify-center gap-3 text-xs text-blue-700 pt-1">
              <span>{language === 'bn' ? 'নির্ধারিত সুদ:' : 'Yearly Interest:'} {formatBDT(renewCalculation.yearlyInterest, language)}</span>
              {renewCalculation.discount > 0 && (
                <span className="font-bold text-rose-600">
                  {language === 'bn' ? 'ছাড়:' : 'Discount:'} -{formatBDT(renewCalculation.discount, language)}
                </span>
              )}
            </div>
            <p className="text-[11px] text-blue-600 border-t border-blue-200/60 pt-1.5">
              {language === 'bn'
                ? `মূল আসল ${formatBDT(mortgage.principal, 'bn')} অপরিবর্তিত থাকবে ও মেয়াদ +১ বছর বৃদ্ধি পাবে।`
                : `Principal ${formatBDT(mortgage.principal, 'en')} remains unchanged and due date extends +1 year.`}
            </p>
          </div>

          {/* Discount / Underpayment Section */}
          <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t('mortgages.discount')}</span>
              </label>
              <div className="flex items-center gap-1">
                {[0, 500, 1000].map((disc) => (
                  <button
                    key={disc}
                    type="button"
                    onClick={() => {
                      setRenewDiscount(disc);
                      setCustomRenewInterest('');
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
                      renewDiscount === disc && !customRenewInterest
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    ৳ {disc}
                  </button>
                ))}
              </div>
            </div>
            <Input
              type="number"
              step="100"
              placeholder={language === 'bn' ? 'যেমন: ৫০০ বা ১,০০০ টাকা ছাড়' : 'e.g. 500 or 1,000 taka discount'}
              value={renewDiscount || ''}
              onChange={(e) => {
                setRenewDiscount(Number(e.target.value) || 0);
                setCustomRenewInterest('');
              }}
            />
          </div>

          <Input
            label={t('payments.paid_on')}
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />

          <Input
            label={t('payments.note')}
            placeholder={language === 'bn' ? 'নবায়ন ও ছাড় সংক্রান্ত মন্তব্য (ঐচ্ছিক)' : 'Renewal and discount notes (optional)'}
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRenewModalOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleConfirmRenew}
              isLoading={renewMutation.isPending}
            >
              <RotateCw className="w-4 h-4 mr-1.5" />
              <span>{language === 'bn' ? 'সুদ গ্রহণ ও মেয়াদ বৃদ্ধি নিশ্চিত করুন' : 'Confirm Renewal & Receive Interest'}</span>
            </Button>
          </div>
        </div>
      </Dialog>

      {/* MODAL 2: CLOSE CONFIRMATION DIALOG (With Early Repayment Calculator & Discount) */}
      <Dialog
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        title={t('mortgages.close_dialog_title')}
        description={t('mortgages.close_dialog_desc')}
      >
        <div className="space-y-4">
          {/* Early Repayment Notification */}
          {earlySettlement.isEarly && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">
                  {t('mortgages.early_settlement')} (
                  {earlySettlement.daysElapsed} {language === 'bn' ? 'দিন' : 'days'} /{' '}
                  {earlySettlement.monthsElapsed} {language === 'bn' ? 'মাস অতিবাহিত' : 'months elapsed'})
                </strong>
                <p className="text-amber-700 text-[11px] mt-0.5">
                  {t('mortgages.early_notice')}
                </p>
              </div>
            </div>
          )}

          {/* Interest Calculation Mode Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              {t('mortgages.repayment_mode')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setCloseMode('full_year');
                  setCustomCloseInterest('');
                }}
                className={`p-2 rounded-xl text-xs font-bold border text-left transition-all ${
                  closeMode === 'full_year'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="block text-[10px] text-slate-500 font-normal">
                  {language === 'bn' ? '১ বছর চুক্তি' : '1-Year Term'}
                </span>
                <span>{t('mortgages.mode_full_year')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCloseMode('monthly');
                  setCustomCloseInterest('');
                }}
                className={`p-2 rounded-xl text-xs font-bold border text-left transition-all ${
                  closeMode === 'monthly'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="block text-[10px] text-slate-500 font-normal">
                  {earlySettlement.monthsElapsed} {language === 'bn' ? 'মাস' : 'mos'}
                </span>
                <span>{t('mortgages.mode_monthly')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCloseMode('daily');
                  setCustomCloseInterest('');
                }}
                className={`p-2 rounded-xl text-xs font-bold border text-left transition-all ${
                  closeMode === 'daily'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="block text-[10px] text-slate-500 font-normal">
                  {earlySettlement.daysElapsed} {language === 'bn' ? 'দিন' : 'days'}
                </span>
                <span>{t('mortgages.mode_daily')}</span>
              </button>

              <button
                type="button"
                onClick={() => setCloseMode('custom')}
                className={`p-2 rounded-xl text-xs font-bold border text-left transition-all ${
                  closeMode === 'custom'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="block text-[10px] text-slate-500 font-normal">
                  {language === 'bn' ? 'সমঝোতা' : 'Agreed'}
                </span>
                <span>{t('mortgages.mode_custom')}</span>
              </button>
            </div>
          </div>

          {/* Custom Interest Input if custom mode selected */}
          {closeMode === 'custom' && (
            <Input
              label={t('mortgages.custom_interest')}
              type="number"
              placeholder={language === 'bn' ? 'আদায়কৃত সুদের পরিমাণ লিখুন' : 'Enter agreed interest amount'}
              value={customCloseInterest}
              onChange={(e) => setCustomCloseInterest(e.target.value)}
            />
          )}

          {/* Discount / Waiver Input */}
          <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t('mortgages.discount')}</span>
              </label>
              <div className="flex items-center gap-1">
                {[0, 500, 1000].map((disc) => (
                  <button
                    key={disc}
                    type="button"
                    onClick={() => setCloseDiscount(disc)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
                      closeDiscount === disc
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    ৳ {disc}
                  </button>
                ))}
              </div>
            </div>
            <Input
              type="number"
              step="100"
              placeholder={language === 'bn' ? 'যেমন: ৫০০ বা ১,০০০ টাকা ছাড়' : 'e.g. 500 or 1,000 taka discount'}
              value={closeDiscount || ''}
              onChange={(e) => setCloseDiscount(Number(e.target.value) || 0)}
            />
          </div>

          {/* Final Financial Breakdown Summary Box */}
          <div className="p-4 rounded-2xl bg-gradient-to-tr from-emerald-50 to-teal-50/50 border border-emerald-200">
            <div className="space-y-1.5 text-xs text-slate-700 pb-2 border-b border-emerald-200/60">
              <div className="flex justify-between">
                <span>{language === 'bn' ? 'মূল আসল (Principal):' : 'Principal Amount:'}</span>
                <span className="font-mono font-bold">{formatBDT(earlySettlement.principal, language)}</span>
              </div>
              <div className="flex justify-between">
                <span>{language === 'bn' ? `ধার্যকৃত সুদ (${earlySettlement.mode}):` : `Calculated Interest (${earlySettlement.mode}):`}</span>
                <span className="font-mono font-bold text-emerald-700">
                  +{formatBDT(earlySettlement.calculatedInterest, language)}
                </span>
              </div>
              {earlySettlement.discount > 0 && (
                <div className="flex justify-between text-rose-600 font-bold">
                  <span>{language === 'bn' ? 'ছাড় / ডিসকাউন্ট (Discount):' : 'Discount / Waiver:'}</span>
                  <span className="font-mono">-{formatBDT(earlySettlement.discount, language)}</span>
                </div>
              )}
            </div>

            <div className="pt-2 text-center">
              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block">
                {t('mortgages.net_total')}
              </span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-950 font-mono mt-0.5">
                {formatBDT(earlySettlement.total, language)}
              </div>
            </div>
          </div>

          <Input
            label={t('payments.paid_on')}
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />

          <Input
            label={t('payments.note')}
            placeholder={language === 'bn' ? 'পরিশোধ ও জামানত ফেরত সংক্রান্ত মন্তব্য...' : 'Settlement and collateral return notes...'}
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCloseModalOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleConfirmClose}
              isLoading={closeMutation.isPending}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              <span>{language === 'bn' ? 'সম্পূর্ণ পরিশোধ ও সমাপ্ত করুন' : 'Confirm Full Settlement & Close'}</span>
            </Button>
          </div>
        </div>
      </Dialog>

      {/* MODAL 3: CORRECTION DIALOG */}
      <Dialog
        isOpen={Boolean(correctionTargetPayment)}
        onClose={() => setCorrectionTargetPayment(null)}
        title={t('payments.add_correction')}
        description={t('payments.immutable_warning')}
      >
        {correctionTargetPayment && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
              <div>
                {language === 'bn' ? 'রসিদ নং:' : 'Receipt No:'}{' '}
                <strong className="font-mono">{correctionTargetPayment.receipt_no}</strong>
              </div>
              <div>
                {language === 'bn' ? 'বিপরীত রিভার্সাল পরিমাণ:' : 'Reversal Amount:'}{' '}
                <strong className="font-mono">
                  -{formatBDT(correctionTargetPayment.amount, language)}
                </strong>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                {t('payments.correction_reason')} *
              </label>
              <textarea
                rows={3}
                className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                placeholder={
                  language === 'bn'
                    ? 'যেমন: ভুলবশত অতিরিক্ত সুদ বা ভুল গ্রাহকের হিসাবে টাকা এন্ট্রি করা হয়েছিল...'
                    : 'e.g. Excess interest entered or recorded under incorrect customer...'
                }
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCorrectionTargetPayment(null)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmCorrection}
                isLoading={correctionMutation.isPending}
              >
                <RotateCcw className="w-4 h-4 mr-1.5" />
                <span>{language === 'bn' ? 'রিভার্সাল এন্ট্রি নিশ্চিত করুন' : 'Confirm Reversal Entry'}</span>
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* DIGITAL RECEIPT MODAL */}
      <ReceiptModal
        payment={selectedReceiptPayment}
        mortgage={mortgage}
        isOpen={Boolean(selectedReceiptPayment)}
        onClose={() => setSelectedReceiptPayment(null)}
      />
    </div>
  );
};
