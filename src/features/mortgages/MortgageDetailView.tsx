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
  calculateCloseAmount,
  getTodayDhakaDateString,
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
  Calendar,
  Coins,
  Phone,
  MessageSquare,
  AlertTriangle,
  RotateCw,
  CheckCircle2,
  FileText,
  RotateCcw,
  Gem,
  Clock,
  Sparkles,
  ShieldCheck,
  Printer,
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
  const closeCalculation = calculateCloseAmount(mortgage.principal, mortgage.interest_rate);

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
      `আসসালামু আলাইকুম ${mortgage.customer?.name || ''} ভাই/আপা, আপনার বন্ধকী (${mortgage.mortgage_no}) সংক্রান্ত যোগাযোগ।`
    );
    window.open(`https://wa.me/${internationalPhone}?text=${text}`);
  };

  // Submit Renew RPC
  const handleConfirmRenew = async () => {
    try {
      const res = await renewMutation.mutateAsync({
        mortgageId: mortgage.id,
        paidOn: paymentDate,
        note: paymentNote || undefined,
      });

      setIsRenewModalOpen(false);
      setSuccessReceipt({
        type: 'renew',
        receipt_no: (res as any).receipt_no,
        amount: yearlyInterest,
      });
      setPaymentNote('');
    } catch (err) {
      alert('রিনিউ সম্পন্ন করতে সমস্যা হয়েছে: ' + (err as Error).message);
    }
  };

  // Submit Close RPC
  const handleConfirmClose = async () => {
    try {
      const res = await closeMutation.mutateAsync({
        mortgageId: mortgage.id,
        paidOn: paymentDate,
        note: paymentNote || undefined,
      });

      setIsCloseModalOpen(false);
      setSuccessReceipt({
        type: 'close',
        receipt_no: (res as any).receipt_no,
        amount: closeCalculation.total,
      });
      setPaymentNote('');
    } catch (err) {
      alert('বন্ধক পরিশোধ ও সমাপ্তি সম্পন্ন করতে সমস্যা হয়েছে: ' + (err as Error).message);
    }
  };

  // Submit Correction RPC
  const handleConfirmCorrection = async () => {
    if (!correctionTargetPayment || !correctionReason.trim()) {
      alert('সংশোধনের কারণ উল্লেখ করা আবশ্যক');
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
      alert('সংশোধন ব্যর্থ হয়েছে: ' + (err as Error).message);
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
              শুরুর তারিখ: {formatDateDhaka(mortgage.start_date, language)} • মেয়াদ:{' '}
              {formatDateDhaka(mortgage.due_date, language)}
            </p>
          </div>
        </div>

        {/* Quick Action Buttons for Active Mortgages */}
        {mortgage.status === 'active' && (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setPaymentDate(getTodayDhakaDateString());
                setIsRenewModalOpen(true);
              }}
              variant="outline"
              className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 font-bold text-xs sm:text-sm h-11"
            >
              <RotateCw className="w-4 h-4 text-blue-600" />
              <span>{t('mortgages.renew_btn')}</span>
            </Button>

            <Button
              onClick={() => {
                setPaymentDate(getTodayDhakaDateString());
                setIsCloseModalOpen(true);
              }}
              variant="primary"
              className="gap-2 font-bold text-xs sm:text-sm h-11 shadow-md shadow-emerald-600/25"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t('mortgages.close_btn')}</span>
            </Button>
          </div>
        )}
      </div>

      {/* Success Notification Banner */}
      {successReceipt && (
        <div className="p-4 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 flex items-center justify-between animate-in zoom-in-95">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-sm">
                {successReceipt.type === 'renew'
                  ? '✅ সুদ গ্রহণ ও ১ বছর মেয়াদ বৃদ্ধি সফল!'
                  : successReceipt.type === 'close'
                  ? '🎉 বন্ধক সম্পূর্ণ পরিশোধ ও সমাপ্ত করা হয়েছে!'
                  : '⚠️ ভুল পেমেন্টের বিপরীত সংশোধনী সফলভাবে নথিভুক্ত হয়েছে'}
              </h4>
              <p className="text-xs text-emerald-100 font-mono mt-0.5">
                রসিদ নং: {successReceipt.receipt_no} • পরিমাণ:{' '}
                {formatBDT(successReceipt.amount, language)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-bold border-0 shadow-sm"
              onClick={() => {
                const found = payments.find((p) => p.receipt_no === successReceipt.receipt_no);
                const paymentToView = found || {
                  id: 'temp',
                  receipt_no: successReceipt.receipt_no,
                  mortgage_id: mortgage.id,
                  paid_on: getTodayDhakaDateString(),
                  type:
                    successReceipt.type === 'renew'
                      ? 'interest'
                      : successReceipt.type === 'close'
                      ? 'full_payment'
                      : 'correction',
                  amount: successReceipt.amount,
                  received_by: null,
                  note: null,
                  original_payment_id: null,
                  created_at: new Date().toISOString(),
                };
                setSelectedReceiptPayment(paymentToView);
              }}
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              <span>রসিদ প্রিন্ট / শেয়ার</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/20 text-xs"
              onClick={() => setSuccessReceipt(null)}
            >
              {t('common.close')}
            </Button>
          </div>
        </div>
      )}

      {/* 2-Column Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Customer & Financials (2 cols) */}
        <div className="md:col-span-2 space-y-6">
          {/* Financial Breakdown Card */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-600" />
                <span>আর্থিক হিসাব ও সুদের বিবরণ</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-xs text-slate-500 font-medium block">আসল মূলধন</span>
                  <span className="text-xl font-black text-slate-900 font-mono block mt-1">
                    {formatBDT(mortgage.principal, language)}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-xs text-slate-500 font-medium block">
                    বার্ষিক সুদ ({mortgage.interest_rate}%)
                  </span>
                  <span className="text-xl font-black text-emerald-700 font-mono block mt-1">
                    {formatBDT(yearlyInterest, language)}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 col-span-2 sm:col-span-1">
                  <span className="text-xs text-slate-500 font-medium block">পরিশোধে মোট দেওয়</span>
                  <span className="text-xl font-black text-slate-900 font-mono block mt-1">
                    {formatBDT(closeCalculation.total, language)}
                  </span>
                </div>
              </div>

              {/* Due Date Alert Box */}
              <div
                className={`mt-4 p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                  isOverdue
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : daysUntilDue <= 15
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>
                    পরিশোধের মেয়াদ: <strong>{formatDateDhaka(mortgage.due_date, language)}</strong>
                  </span>
                </div>
                <span className="font-bold">
                  {isOverdue
                    ? `⚠️ ${Math.abs(daysUntilDue)} দিন বিলম্বিত`
                    : `${daysUntilDue} দিন অবশিষ্ট`}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Collateral Card */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Gem className="w-4 h-4 text-emerald-600" />
                <span>জামানতের বিবরণ ও ছবি</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize text-xs font-bold text-slate-700">
                  {t(`mortgages.collateral_types.${mortgage.collateral_type}`, mortgage.collateral_type)}
                </Badge>
                {mortgage.collateral_returned_at && (
                  <Badge variant="closed" className="text-emerald-700 bg-emerald-50 border-emerald-200">
                    জামানত ফেরত সম্পন্ন
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-800 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 leading-relaxed">
                {mortgage.collateral_description}
              </p>

              {mortgage.collateral_photo_paths && mortgage.collateral_photo_paths.length > 0 && (
                <div className="grid grid-cols-3 gap-3 pt-2">
                  {mortgage.collateral_photo_paths.map((p, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl overflow-hidden aspect-square border border-slate-200 bg-slate-100"
                    >
                      <img src={p} alt="Collateral" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment History Timeline */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>{t('mortgages.payment_history')}</span>
                </CardTitle>
                <span className="text-xs font-semibold text-slate-500">
                  {payments.length} টি লেনদেন
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  এখনো কোনো পেমেন্ট জমা হয়নি।
                </p>
              ) : (
                <div className="space-y-3">
                  {payments.map((p) => {
                    const isReversal = p.type === 'correction' || p.amount < 0;
                    return (
                      <div
                        key={p.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isReversal
                            ? 'bg-rose-50/50 border-rose-200 text-rose-900'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {p.receipt_no}
                            </span>
                            <Badge
                              variant={
                                p.type === 'interest'
                                  ? 'interest'
                                  : p.type === 'full_payment'
                                  ? 'full'
                                  : 'overdue'
                              }
                              className="text-[10px]"
                            >
                              {p.type === 'interest'
                                ? t('payments.type_interest')
                                : p.type === 'full_payment'
                                ? t('payments.type_full_payment')
                                : t('payments.type_correction')}
                            </Badge>
                          </div>

                          <div className="text-right">
                            <span
                              className={`text-sm sm:text-base font-black font-mono ${
                                isReversal ? 'text-rose-600' : 'text-emerald-700'
                              }`}
                            >
                              {formatBDT(p.amount, language)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{formatDateDhaka(p.paid_on, language)}</span>
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setSelectedReceiptPayment(p)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
                              title="রসিদ দেখুন / ডাউনলোড / শেয়ার করুন"
                            >
                              <Printer className="w-3 h-3" />
                              <span>রসিদ</span>
                            </button>

                            {/* Reversal / Correction Button */}
                            {!isReversal && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCorrectionTargetPayment(p);
                                  setCorrectionReason('');
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-rose-600 transition-colors"
                                title="ভুল সংশোধনী এন্ট্রি যোগ করুন"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>{t('payments.add_correction')}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {p.note && (
                          <p className="text-xs text-slate-600 italic mt-1.5 pl-2 border-l-2 border-slate-200">
                            {p.note}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Customer Card */}
        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <span>গ্রাহক পরিচিতি</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg shrink-0">
                  {mortgage.customer?.photo_path ? (
                    <img
                      src={mortgage.customer.photo_path}
                      alt={mortgage.customer.name}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    mortgage.customer?.name.charAt(0) || 'গ'
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-base text-slate-900 leading-snug">
                    {mortgage.customer?.name}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">{mortgage.customer?.phone}</p>
                </div>
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
                  <span>কল করুন</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleWhatsApp}
                  className="gap-1.5 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 h-9"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-teal-600" />
                  <span>হোয়াটসঅ্যাপ</span>
                </Button>
              </div>

              {mortgage.customer?.address && (
                <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-0.5">ঠিকানা:</span>
                  <span>{mortgage.customer.address}</span>
                </div>
              )}

              {mortgage.customer?.nid_no && (
                <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-700 block mb-0.5">NID নম্বর:</span>
                  <span className="font-mono">{mortgage.customer.nid_no}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MODAL 1: RENEW CONFIRMATION DIALOG */}
      <Dialog
        isOpen={isRenewModalOpen}
        onClose={() => setIsRenewModalOpen(false)}
        title={t('mortgages.renew_dialog_title')}
        description={t('mortgages.renew_dialog_desc')}
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-center">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider block">
              প্রদেয় সুদের পরিমাণ
            </span>
            <div className="text-2xl sm:text-3xl font-black text-blue-900 font-mono mt-1">
              {formatBDT(yearlyInterest, language)}
            </div>
            <p className="text-xs text-blue-600 mt-1">
              মূল আসল {formatBDT(mortgage.principal, language)} অপরিবর্তিত থাকবে।
            </p>
          </div>

          <Input
            label={t('payments.paid_on')}
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />

          <Input
            label={t('payments.note')}
            placeholder="নবায়ন সংক্রান্ত মন্তব্য (ঐচ্ছিক)"
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
              <span>সুদ গ্রহণ ও মেয়াদ বৃদ্ধি নিশ্চিত করুন</span>
            </Button>
          </div>
        </div>
      </Dialog>

      {/* MODAL 2: CLOSE CONFIRMATION DIALOG */}
      <Dialog
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        title={t('mortgages.close_dialog_title')}
        description={t('mortgages.close_dialog_desc')}
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-center">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block">
              সম্পূর্ণ নিষ্পত্তির মোট পরিমাণ
            </span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-900 font-mono mt-1">
              {formatBDT(closeCalculation.total, language)}
            </div>
            <p className="text-xs text-emerald-700 mt-1">
              আসল {formatBDT(closeCalculation.principal, language)} + সুদ{' '}
              {formatBDT(closeCalculation.interest, language)}
            </p>
          </div>

          <Input
            label={t('payments.paid_on')}
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
          />

          <Input
            label={t('payments.note')}
            placeholder="পরিশোধ ও জামানত ফেরত সংক্রান্ত মন্তব্য..."
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
              <span>সম্পূর্ণ পরিশোধ ও সমাপ্ত করুন</span>
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
                রসিদ নং: <strong className="font-mono">{correctionTargetPayment.receipt_no}</strong>
              </div>
              <div>
                বিপরীত রিভার্সাল পরিমাণ:{' '}
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
                required
                placeholder="যেমন: ভুলবশত ভুল গ্রাহকের একাউন্টে এন্ট্রি দেওয়া হয়েছিল..."
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
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
                <span>রিভার্সাল এন্ট্রি নিশ্চিত করুন</span>
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* MODAL 4: RECEIPT MODAL */}
      <ReceiptModal
        isOpen={Boolean(selectedReceiptPayment)}
        onClose={() => setSelectedReceiptPayment(null)}
        payment={selectedReceiptPayment}
        mortgage={mortgage}
      />
    </div>
  );
};
