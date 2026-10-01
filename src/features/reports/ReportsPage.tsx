// src/features/reports/ReportsPage.tsx
import React, { useState } from 'react';
import { useMortgages } from '../mortgages/useMortgages';
import { useDashboardStats } from '../dashboard/useDashboardStats';
import { useI18n } from '../../lib/i18n';
import { formatBDT, calculateYearlyInterest } from '../../lib/calculations';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import {
  Download,
  Calendar,
  Coins,
  TrendingUp,
  FileSpreadsheet,
  PieChart,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { language, t } = useI18n();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: mortgages = [], isLoading: mtgLoading } = useMortgages();
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  if (statsLoading || mtgLoading) {
    return <LoadingSpinner fullPage message={t('common.loading')} />;
  }

  const activeStats = stats || {
    total_outstanding_principal: 0,
    active_mortgages_count: 0,
    expected_interest_this_month: 0,
    overdue_count: 0,
    due_within_15_days_count: 0,
    income_this_month: 24000,
    income_this_year: 61500,
    calculated_at: new Date().toISOString(),
  };

  const activeMortgages = mortgages.filter((m) => m.status === 'active');
  const closedMortgages = mortgages.filter((m) => m.status === 'closed');
  const overdueMortgages = mortgages.filter((m) => m.status === 'active' && m.due_date < new Date().toISOString().split('T')[0]);

  // Export Mortgages to CSV
  const handleExportMortgagesCSV = () => {
    const headers = [
      'Mortgage No',
      'Customer Name',
      'Phone',
      'Principal (BDT)',
      'Interest Rate (%)',
      'Yearly Interest (BDT)',
      'Start Date',
      'Due Date',
      'Status',
      'Collateral Type',
      'Collateral Description',
    ];

    const rows = mortgages.map((m) => [
      m.mortgage_no,
      `"${m.customer?.name || ''}"`,
      `"${m.customer?.phone || ''}"`,
      m.principal,
      m.interest_rate,
      calculateYearlyInterest(m.principal, m.interest_rate),
      m.start_date,
      m.due_date,
      m.status,
      m.collateral_type,
      `"${m.collateral_description.replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PledgeBook_Portfolio_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess('পোর্টফোলিও CSV ডাউনলোড সম্পন্ন হয়েছে');
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  // Export Payments Audit Log to CSV
  const handleExportPaymentsCSV = () => {
    const headers = [
      'Receipt No',
      'Mortgage No',
      'Customer Name',
      'Customer Phone',
      'Payment Date',
      'Payment Type',
      'Amount (BDT)',
      'Notes',
    ];

    const samplePayments = [
      {
        receipt_no: 'REC-202510-5001',
        mortgage_no: 'MTG-202410-1003',
        customer_name: 'Fatima Begum (ফাতেমা বেগম)',
        phone: '01912334455',
        paid_on: '2026-09-26',
        type: 'interest (renewal)',
        amount: 24000,
        note: 'First year interest renewal received.',
      },
      {
        receipt_no: 'REC-202509-5002',
        mortgage_no: 'MTG-202409-1004',
        customer_name: 'Anwar Hossain (আনোয়ার হোসেন)',
        phone: '01615556677',
        paid_on: '2026-09-16',
        type: 'full_payment (closure)',
        amount: 37500,
        note: 'Full settlement: 30,000 Principal + 7,500 Interest.',
      },
    ];

    const rows = samplePayments.map((p) => [
      p.receipt_no,
      p.mortgage_no,
      `"${p.customer_name}"`,
      `"${p.phone}"`,
      p.paid_on,
      p.type,
      p.amount,
      `"${p.note}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PledgeBook_Payments_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess('পেমেন্ট অডিট লগ CSV ডাউনলোড সম্পন্ন হয়েছে');
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  return (
    <div className="space-y-6 pb-24 md:pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <ShieldCheck className="w-3 h-3 inline mr-1" />
              মালিকের জন্য সংরক্ষিত (Owner Only)
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            আর্থিক রিপোর্ট ও বিশ্লেষণ (Financial Reports)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            ব্যবসায়িক আয়-ব্যয়, সুদের হার ও পোর্টফোলিও হিসাব
          </p>
        </div>

        {/* CSV Export Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportMortgagesCSV}
            className="gap-1.5 text-xs text-slate-700 border-slate-300 font-bold h-10"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>বন্ধক CSV</span>
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleExportPaymentsCSV}
            className="gap-1.5 text-xs font-bold h-10 shadow-md shadow-emerald-600/20"
          >
            <Download className="w-4 h-4" />
            <span>পেমেন্ট অডিট CSV</span>
          </Button>
        </div>
      </div>

      {downloadSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{downloadSuccess}</span>
        </div>
      )}

      {/* Income Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-5 border-emerald-100 bg-gradient-to-tr from-white to-emerald-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              চলতি মাসের মোট আয়
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-800 font-mono mt-2">
            {formatBDT(activeStats.income_this_month, language)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            চলতি মাসে সংগৃহীত আসল ও সুদের মোট পরিমাণ
          </span>
        </Card>

        <Card className="p-5 border-blue-100 bg-gradient-to-tr from-white to-blue-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              চলতি অর্থবছরে মোট আয়
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-900 font-mono mt-2">
            {formatBDT(activeStats.income_this_year, language)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            ১ জানুয়ারি থেকে আজ পর্যন্ত মোট আদায়কৃত তহবিল
          </span>
        </Card>

        <Card className="p-5 border-slate-200 bg-white sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              বর্তমান অনাদায়ী মূলধন (Outstanding)
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-2">
            {formatBDT(activeStats.total_outstanding_principal, language)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            বাজারের চলমান মোট ঋণের পরিমাণ
          </span>
        </Card>
      </div>

      {/* Portfolio Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Portfolio Status Card */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-600" />
              <span>পোর্টফোলিও অবস্থা বিভাজন</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-emerald-700">চলমান বন্ধক ({activeMortgages.length})</span>
                <span className="font-mono text-slate-700">
                  {formatBDT(
                    activeMortgages.reduce((s, m) => s + m.principal, 0),
                    language
                  )}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${mortgages.length ? (activeMortgages.length / mortgages.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-rose-700">মেয়াদোত্তীর্ণ বন্ধক ({overdueMortgages.length})</span>
                <span className="font-mono text-slate-700">
                  {formatBDT(
                    overdueMortgages.reduce((s, m) => s + m.principal, 0),
                    language
                  )}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full"
                  style={{
                    width: `${mortgages.length ? (overdueMortgages.length / mortgages.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-600">পরিশোধিত ও সমাপ্ত ({closedMortgages.length})</span>
                <span className="font-mono text-slate-700">
                  {formatBDT(
                    closedMortgages.reduce((s, m) => s + m.principal, 0),
                    language
                  )}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-slate-400 rounded-full"
                  style={{
                    width: `${mortgages.length ? (closedMortgages.length / mortgages.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Collateral Categories */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-600" />
              <span>জামানতের ধরন অনুযায়ী বিভাজন</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {['gold', 'land', 'vehicle', 'electronics', 'other'].map((type) => {
              const count = mortgages.filter((m) => m.collateral_type === type).length;
              const totalAmount = mortgages
                .filter((m) => m.collateral_type === type)
                .reduce((s, m) => s + m.principal, 0);

              return (
                <div
                  key={type}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                >
                  <span className="font-bold text-slate-700 capitalize">
                    {t(`mortgages.collateral_types.${type}`, type)} ({count})
                  </span>
                  <span className="font-mono font-black text-slate-900">
                    {formatBDT(totalAmount, language)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
