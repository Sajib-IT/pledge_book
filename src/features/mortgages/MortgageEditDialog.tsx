import React, { useState } from 'react';
import { Dialog } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { DatePicker } from '../../components/ui/date-picker';
import { useI18n } from '../../lib/i18n';
import type { Mortgage, CollateralType, MortgageStatus } from '../../types/database';
import {
  parseBanglaOrEnglishNumber,
  convertMonthlyToYearlyRate,
  convertYearlyToMonthlyRate,
} from '../../lib/calculations';
import { useUpdateMortgage } from './useMortgages';
import { AlertCircle, Save } from 'lucide-react';

interface MortgageEditDialogProps {
  mortgage: Mortgage;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const MortgageEditDialog: React.FC<MortgageEditDialogProps> = ({
  mortgage,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { language, t } = useI18n();
  const updateMutation = useUpdateMortgage();

  const [principalStr, setPrincipalStr] = useState<string>(mortgage.principal.toString());
  const [rateBasis, setRateBasis] = useState<'yearly' | 'monthly'>('yearly');
  const [yearlyRateStr, setYearlyRateStr] = useState<string>(mortgage.interest_rate.toString());
  const [monthlyRateStr, setMonthlyRateStr] = useState<string>(() =>
    convertYearlyToMonthlyRate(mortgage.interest_rate).toFixed(2)
  );

  const [startDate, setStartDate] = useState<string>(mortgage.start_date);
  const [dueDate, setDueDate] = useState<string>(mortgage.due_date);
  const [collateralType, setCollateralType] = useState<CollateralType>(mortgage.collateral_type);
  const [collateralDescription, setCollateralDescription] = useState<string>(mortgage.collateral_description);
  const [status, setStatus] = useState<MortgageStatus>(mortgage.status);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleYearlyChange = (val: string) => {
    setYearlyRateStr(val);
    const num = parseBanglaOrEnglishNumber(val);
    setMonthlyRateStr(convertYearlyToMonthlyRate(num).toFixed(2));
  };

  const handleMonthlyChange = (val: string) => {
    setMonthlyRateStr(val);
    const num = parseBanglaOrEnglishNumber(val);
    setYearlyRateStr(convertMonthlyToYearlyRate(num).toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const parsedPrincipal = parseBanglaOrEnglishNumber(principalStr);
    const parsedRate = parseBanglaOrEnglishNumber(yearlyRateStr);

    if (parsedPrincipal <= 0) {
      setErrorMsg(language === 'bn' ? 'সঠিক আসল টাকার পরিমাণ লিখুন' : 'Enter valid principal amount');
      return;
    }

    if (parsedRate < 0) {
      setErrorMsg(language === 'bn' ? 'সুদের হার ০ বা তার বেশি হতে হবে' : 'Interest rate must be 0 or more');
      return;
    }

    if (!startDate || !dueDate) {
      setErrorMsg(language === 'bn' ? 'তারিখদ্বয় নির্বাচন করুন' : 'Select both dates');
      return;
    }

    if (!collateralDescription.trim()) {
      setErrorMsg(language === 'bn' ? 'জামানতের বিবরণ দিন' : 'Provide collateral description');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: mortgage.id,
        principal: Math.round(parsedPrincipal),
        interest_rate: parsedRate,
        start_date: startDate,
        due_date: dueDate,
        collateral_type: collateralType,
        collateral_description: collateralDescription.trim(),
        status,
      });

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update mortgage';
      setErrorMsg(msg);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={language === 'bn' ? 'বন্ধক তথ্য সম্পাদনা (Owner Edit)' : 'Edit Mortgage Details (Owner)'}
      description={
        language === 'bn'
          ? `বন্ধক নং: ${mortgage.mortgage_no} — শুধুমাত্র মালিক তথ্য সংশোধন করতে পারবেন`
          : `Mortgage: ${mortgage.mortgage_no} — Only owner has permission to edit`
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Principal Input */}
        <div>
          <Input
            label={language === 'bn' ? 'আসল টাকা (Principal BDT)' : 'Principal (BDT)'}
            type="text"
            inputMode="numeric"
            value={principalStr}
            onChange={(e) => setPrincipalStr(e.target.value)}
            className="text-base font-bold font-mono"
            required
          />
        </div>

        {/* Interest Rate with Toggle */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              {language === 'bn' ? 'সুদের হার' : 'Interest Rate'}
            </label>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setRateBasis('yearly')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                  rateBasis === 'yearly'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {language === 'bn' ? 'বাৎসরিক %' : 'Yearly %'}
              </button>
              <button
                type="button"
                onClick={() => setRateBasis('monthly')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                  rateBasis === 'monthly'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {language === 'bn' ? 'মাসিক %' : 'Monthly %'}
              </button>
            </div>
          </div>

          {rateBasis === 'yearly' ? (
            <Input
              type="text"
              value={yearlyRateStr}
              onChange={(e) => handleYearlyChange(e.target.value)}
              placeholder="e.g. 25"
              className="font-mono text-sm"
              helperText={
                language === 'bn'
                  ? `(মাসিক প্রায় ${monthlyRateStr}%)`
                  : `(approx ${monthlyRateStr}% monthly)`
              }
            />
          ) : (
            <Input
              type="text"
              value={monthlyRateStr}
              onChange={(e) => handleMonthlyChange(e.target.value)}
              placeholder="e.g. 2.08"
              className="font-mono text-sm"
              helperText={
                language === 'bn'
                  ? `(বাৎসরিক প্রায় ${yearlyRateStr}%)`
                  : `(approx ${yearlyRateStr}% yearly)`
              }
            />
          )}
        </div>

        {/* Start Date & Due Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DatePicker
            label={t('mortgages.start_date')}
            value={startDate}
            onChange={(val) => setStartDate(val)}
            required
            className="text-xs"
          />
          <DatePicker
            label={t('mortgages.due_date')}
            value={dueDate}
            onChange={(val) => setDueDate(val)}
            required
            className="text-xs"
          />
        </div>

        {/* Collateral Type */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            {language === 'bn' ? 'জামানতের ধরন' : 'Collateral Type'}
          </label>
          <select
            value={collateralType}
            onChange={(e) => setCollateralType(e.target.value as CollateralType)}
            className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
          >
            <option value="gold">{language === 'bn' ? 'স্বর্ণ (Gold)' : 'Gold'}</option>
            <option value="land">{language === 'bn' ? 'জমি / দলিল (Land)' : 'Land'}</option>
            <option value="vehicle">{language === 'bn' ? 'যানবাহন (Vehicle)' : 'Vehicle'}</option>
            <option value="electronics">{language === 'bn' ? 'ইলেকট্রনিক্স (Electronics)' : 'Electronics'}</option>
            <option value="other">{language === 'bn' ? 'অন্যান্য (Other)' : 'Other'}</option>
          </select>
        </div>

        {/* Collateral Description */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            {language === 'bn' ? 'জামানতের বিবরণ' : 'Collateral Description'}
          </label>
          <textarea
            value={collateralDescription}
            onChange={(e) => setCollateralDescription(e.target.value)}
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            required
          />
        </div>

        {/* Mortgage Status */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            {language === 'bn' ? 'বন্ধকের বর্তমান স্ট্যাটাস' : 'Mortgage Status'}
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as MortgageStatus)}
            className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-semibold"
          >
            <option value="active">{language === 'bn' ? 'সক্রিয় (Active)' : 'Active'}</option>
            <option value="closed">{language === 'bn' ? 'খালাস / পরিশোধিত (Closed)' : 'Closed'}</option>
            <option value="defaulted">{language === 'bn' ? 'খেলাপি (Defaulted)' : 'Defaulted'}</option>
          </select>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={updateMutation.isPending}>
            {t('common.close')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={updateMutation.isPending}
            className="gap-2 shadow-md shadow-emerald-700/20"
          >
            <Save className="w-4 h-4" />
            <span>{t('common.save')}</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
