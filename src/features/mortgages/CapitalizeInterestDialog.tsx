import React, { useState } from 'react';
import { Dialog } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { DatePicker } from '../../components/ui/date-picker';
import { useI18n } from '../../lib/i18n';
import type { Mortgage } from '../../types/database';
import {
  formatBDT,
  formatDateDhaka,
  toBanglaDigits,
  parseBanglaOrEnglishNumber,
  calculateElapsedDuration,
  calculateEarlySettlement,
  getTodayDhakaDateString,
  calculateYearlyInterest,
} from '../../lib/calculations';
import { useCapitalizeInterest } from './useMortgages';
import { TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react';

interface CapitalizeInterestDialogProps {
  mortgage: Mortgage;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newPrincipal: number) => void;
}

export const CapitalizeInterestDialog: React.FC<CapitalizeInterestDialogProps> = ({
  mortgage,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { language, t } = useI18n();
  const capitalizeMutation = useCapitalizeInterest();

  const todayStr = getTodayDhakaDateString();
  const { monthsElapsed } = calculateElapsedDuration(mortgage.start_date, todayStr);

  // Suggested accrued interest calculation
  const settlement = calculateEarlySettlement(
    mortgage.principal,
    mortgage.interest_rate,
    mortgage.start_date,
    todayStr,
    'monthly'
  );
  const suggestedInterest = settlement.calculatedInterest;

  const [addedAmountStr, setAddedAmountStr] = useState<string>(suggestedInterest.toString());
  const [dueDateOption, setDueDateOption] = useState<'keep' | '1y_from_today' | '1y_from_due' | 'custom'>('1y_from_today');
  const [customDueDate, setCustomDueDate] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });
  const [note, setNote] = useState<string>(
    language === 'bn' ? 'বকেয়া সুদ আসলের সাথে সমন্বয় করা হলো' : 'Accrued interest capitalized into principal'
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const numericAddedAmount = parseBanglaOrEnglishNumber(addedAmountStr);
  const newPrincipal = (Number(mortgage.principal) || 0) + numericAddedAmount;
  const newYearlyInterest = calculateYearlyInterest(newPrincipal, mortgage.interest_rate);

  // Compute resolved due date based on option
  const getResolvedDueDate = (): string => {
    if (dueDateOption === 'keep') return mortgage.due_date;
    if (dueDateOption === '1y_from_today') {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().split('T')[0];
    }
    if (dueDateOption === '1y_from_due') {
      const d = new Date(mortgage.due_date);
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().split('T')[0];
    }
    return customDueDate;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (numericAddedAmount <= 0) {
      setErrorMsg(
        language === 'bn'
          ? 'আসলে যোগ করার পরিমাণ ০ এর বেশি হতে হবে'
          : 'Amount to add must be greater than 0'
      );
      return;
    }

    try {
      const resolvedDueDate = getResolvedDueDate();
      const res = await capitalizeMutation.mutateAsync({
        mortgageId: mortgage.id,
        addedAmount: numericAddedAmount,
        newDueDate: resolvedDueDate !== mortgage.due_date ? resolvedDueDate : undefined,
        note: note.trim() || undefined,
      });

      onSuccess?.(res.newPrincipal);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update principal';
      setErrorMsg(msg);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={language === 'bn' ? 'সুদ আসলে যোগ / আসল বৃদ্ধি' : 'Capitalize Interest into Principal'}
      description={
        language === 'bn'
          ? `বন্ধক নং: ${mortgage.mortgage_no} — বকেয়া সুদ বা অতিরিক্ত টাকা মূল আসলের সাথে যুক্ত করুন`
          : `Mortgage: ${mortgage.mortgage_no} — Add accrued interest or extra capital to principal`
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Current State Info Banner */}
        <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-amber-900 font-medium">
              {language === 'bn' ? 'বর্তমান আসল মূলধন:' : 'Current Principal:'}
            </span>
            <span className="font-black text-slate-900 font-mono text-sm">
              {formatBDT(mortgage.principal, language)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-amber-800 font-medium">
              {language === 'bn' ? `বিগত ${toBanglaDigits(monthsElapsed)} মাসের হিসাবকৃত সুদ:` : `Accrued Interest (${monthsElapsed} mo):`}
            </span>
            <span className="font-bold text-amber-900 font-mono text-xs">
              {formatBDT(suggestedInterest, language)}
            </span>
          </div>
          {suggestedInterest > 0 && (
            <button
              type="button"
              onClick={() => setAddedAmountStr(suggestedInterest.toString())}
              className="mt-1 w-full text-center py-1 px-2 rounded-lg bg-amber-100/90 hover:bg-amber-200 text-[11px] font-bold text-amber-900 transition-colors"
            >
              💡 {language === 'bn' ? `বকেয়া সুদ (${formatBDT(suggestedInterest, language)}) সিলেক্ট করুন` : `Use Accrued Interest (${formatBDT(suggestedInterest, language)})`}
            </button>
          )}
        </div>

        {/* Input: Amount to add */}
        <div>
          <Input
            label={language === 'bn' ? 'আসলে যোগ করার পরিমাণ (টাকা)' : 'Amount to Add (BDT)'}
            type="text"
            inputMode="numeric"
            value={addedAmountStr}
            onChange={(e) => setAddedAmountStr(e.target.value)}
            placeholder="e.g. 15000"
            className="text-base font-bold font-mono"
            required
          />
          <p className="text-[11px] text-slate-500 mt-1">
            {language === 'bn'
              ? 'গ্রাহক যদি বকেয়া সুদ নগদ না দিয়ে মূল টাকার সাথে যোগ করে রাখতে চায়, অথবা অতিরিক্ত ঋণ নেয়।'
              : 'Add interest or top-up loan directly to principal balance.'}
          </p>
        </div>

        {/* Due Date Extension Selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            {language === 'bn' ? 'মেয়াদ উত্তীর্ণের তারিখ (Due Date)' : 'Due Date Setting'}
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setDueDateOption('1y_from_today')}
              className={`p-2.5 rounded-xl border text-left transition-all font-semibold ${
                dueDateOption === '1y_from_today'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="font-bold">{language === 'bn' ? 'আজ থেকে ১ বছর' : '1 Year from Today'}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {formatDateDhaka(
                  (() => {
                    const d = new Date();
                    d.setFullYear(d.getFullYear() + 1);
                    return d.toISOString().split('T')[0];
                  })(),
                  language
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDueDateOption('1y_from_due')}
              className={`p-2.5 rounded-xl border text-left transition-all font-semibold ${
                dueDateOption === '1y_from_due'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="font-bold">{language === 'bn' ? 'বর্তমান মেয়াদ + ১ বছর' : 'Current Due + 1 Yr'}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {formatDateDhaka(
                  (() => {
                    const d = new Date(mortgage.due_date);
                    d.setFullYear(d.getFullYear() + 1);
                    return d.toISOString().split('T')[0];
                  })(),
                  language
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDueDateOption('keep')}
              className={`p-2.5 rounded-xl border text-left transition-all font-semibold ${
                dueDateOption === 'keep'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="font-bold">{language === 'bn' ? 'অপরিবর্তিত রাখুন' : 'Keep Existing Due'}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {formatDateDhaka(mortgage.due_date, language)}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDueDateOption('custom')}
              className={`p-2.5 rounded-xl border text-left transition-all font-semibold ${
                dueDateOption === 'custom'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="font-bold">{language === 'bn' ? 'কাস্টম তারিখ' : 'Custom Date'}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {language === 'bn' ? 'নিজের পছন্দমতো দিন' : 'Select calendar date'}
              </div>
            </button>
          </div>

          {dueDateOption === 'custom' && (
            <div className="pt-1.5">
              <DatePicker
                value={customDueDate}
                onChange={(val) => setCustomDueDate(val)}
                className="text-xs"
              />
            </div>
          )}
        </div>

        {/* Note / Reason */}
        <div>
          <Input
            label={language === 'bn' ? 'মন্তব্য / সমন্বয়ের কারণ' : 'Note / Reason'}
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={language === 'bn' ? 'যেমন: ১ বছরের বকেয়া সুদ আসলে যোগ' : 'e.g. 1 year interest added to capital'}
            className="text-xs"
          />
        </div>

        {/* Summary Preview Box */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-emerald-50 to-teal-50 border border-emerald-200 text-xs space-y-2">
          <p className="font-bold text-emerald-950 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{language === 'bn' ? 'সমন্বয় পরবর্তী নতুন অবস্থা (Preview):' : 'Updated Position Preview:'}</span>
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-emerald-200/60">
            <div>
              <span className="text-[11px] text-slate-500 block">
                {language === 'bn' ? 'নতুন মোট আসল মূলধন' : 'New Total Principal'}
              </span>
              <span className="font-black text-slate-900 font-mono text-base">
                {formatBDT(newPrincipal, language)}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 block">
                {language === 'bn' ? 'পরবর্তী বাৎসরিক সুদ' : 'Next Yearly Interest'}
              </span>
              <span className="font-bold text-emerald-800 font-mono text-sm">
                {formatBDT(newYearlyInterest, language)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={capitalizeMutation.isPending}>
            {t('common.close')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={capitalizeMutation.isPending}
            className="gap-2 shadow-md shadow-emerald-700/20"
          >
            <TrendingUp className="w-4 h-4" />
            <span>{language === 'bn' ? 'আসলে যোগ করুন' : 'Confirm Capitalize'}</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
