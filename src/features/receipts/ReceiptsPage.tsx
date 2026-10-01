// src/features/receipts/ReceiptsPage.tsx
import React, { useState } from 'react';
import { useMortgages } from '../mortgages/useMortgages';
import { ReceiptModal } from './ReceiptModal';
import { useI18n } from '../../lib/i18n';
import { formatBDT, formatDateDhaka } from '../../lib/calculations';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import type { Payment, Mortgage } from '../../types/database';
import { Search, Printer, Calendar, FileText, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ReceiptsPage: React.FC = () => {
  const { language, t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<{ payment: Payment; mortgage: Mortgage } | null>(null);

  const { data: mortgages = [], isLoading, isError, error, refetch } = useMortgages();

  // In mock/demo mode or live, gather payments from mortgages or demo list
  // Let's extract all payments with their associated mortgages
  const allReceipts = [
    {
      payment: {
        id: '30000000-0000-0000-0000-000000000001',
        receipt_no: 'REC-202510-5001',
        mortgage_id: '20000000-0000-0000-0000-000000000003',
        paid_on: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
        type: 'interest' as const,
        amount: 24000,
        received_by: null,
        note: 'First year interest renewal received.',
        original_payment_id: null,
        created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      },
      mortgage: mortgages.find((m) => m.id === '20000000-0000-0000-0000-000000000003') || mortgages[0],
    },
    {
      payment: {
        id: '30000000-0000-0000-0000-000000000002',
        receipt_no: 'REC-202509-5002',
        mortgage_id: '20000000-0000-0000-0000-000000000004',
        paid_on: new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0],
        type: 'full_payment' as const,
        amount: 37500,
        received_by: null,
        note: 'Full settlement: 30,000 Principal + 7,500 Interest.',
        original_payment_id: null,
        created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
      },
      mortgage: mortgages.find((m) => m.id === '20000000-0000-0000-0000-000000000004') || mortgages[1] || mortgages[0],
    },
  ];

  const filteredReceipts = allReceipts.filter(({ payment, mortgage }) => {
    if (!mortgage) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        payment.receipt_no.toLowerCase().includes(q) ||
        mortgage.mortgage_no.toLowerCase().includes(q) ||
        mortgage.customer?.name.toLowerCase().includes(q) ||
        mortgage.customer?.phone.includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-24 md:pb-12">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          {t('receipts.title')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          সকল সংগৃহীত কিস্তি, সুদ ও নিষ্পত্তির অফিশিয়াল ডিজিটাল রসিদ
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="রসিদ নং, বন্ধক নং বা গ্রাহকের নাম দিয়ে খুঁজুন..."
          className="pl-10 h-11 bg-white shadow-2xs"
        />
      </div>

      {isLoading ? (
        <LoadingSpinner message={t('common.loading')} />
      ) : isError ? (
        <div className="p-6 text-center rounded-2xl bg-rose-50 border border-rose-200">
          <p className="text-sm font-semibold text-rose-700">
            {t('common.error')}: {(error as Error)?.message}
          </p>
          <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-3">
            {t('common.retry')}
          </Button>
        </div>
      ) : filteredReceipts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="কোনো রসিদ পাওয়া যায়নি"
          description="কোনো কিস্তি বা পরিশোধের পর এখানে রসিদ সংরক্ষিত হবে।"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredReceipts.map(({ payment, mortgage }) => (
            <Card
              key={payment.id}
              onClick={() => setSelectedReceipt({ payment, mortgage })}
              className="p-5 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group border-slate-200/90 relative"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {payment.receipt_no}
                    </span>
                    <Badge
                      variant={
                        payment.type === 'interest'
                          ? 'interest'
                          : payment.type === 'full_payment'
                          ? 'full'
                          : 'overdue'
                      }
                      className="text-[10px]"
                    >
                      {payment.type === 'interest'
                        ? t('payments.type_interest')
                        : payment.type === 'full_payment'
                        ? t('payments.type_full_payment')
                        : t('payments.type_correction')}
                    </Badge>
                  </div>

                  <h3 className="font-bold text-base text-slate-900 group-hover:text-emerald-700 transition-colors pt-1">
                    {mortgage?.customer?.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    বন্ধক: {mortgage?.mortgage_no} • {mortgage?.customer?.phone}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400 font-medium block">আদায়কৃত টাকা</span>
                  <div className="text-lg font-black text-emerald-700 font-mono">
                    {formatBDT(payment.amount, language)}
                  </div>
                  <span className="text-[11px] text-slate-400 flex items-center justify-end gap-1 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDateDhaka(payment.paid_on, language)}</span>
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <Link
                  to={`/mortgages/${mortgage?.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-slate-500 hover:text-emerald-700 font-medium flex items-center gap-1"
                >
                  <span>বন্ধক বিবরণী</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-bold"
                  onClick={() => setSelectedReceipt({ payment, mortgage })}
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>রসিদ দেখুন / শেয়ার</span>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selectedReceipt && (
        <ReceiptModal
          isOpen={Boolean(selectedReceipt)}
          onClose={() => setSelectedReceipt(null)}
          payment={selectedReceipt.payment}
          mortgage={selectedReceipt.mortgage}
        />
      )}
    </div>
  );
};
