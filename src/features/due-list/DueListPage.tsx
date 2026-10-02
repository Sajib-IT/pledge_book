// src/features/due-list/DueListPage.tsx
import React, { useState } from 'react';
import { useMortgages } from '../mortgages/useMortgages';
import { useI18n } from '../../lib/i18n';
import {
  formatBDT,
  formatDateDhaka,
  getDaysUntilDue,
  isMortgageOverdue,
  calculateYearlyInterest,
  toBanglaDigits,
} from '../../lib/calculations';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import {
  AlertTriangle,
  Clock,
  Phone,
  MessageSquare,
  Search,
  Calendar,
  Coins,
  ChevronRight,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const DueListPage: React.FC = () => {
  const navigate = useNavigate();
  const { language, t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'overdue';

  const [activeFilter, setActiveFilter] = useState<string>(initialFilter);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { data: allMortgages = [], isLoading, isError, error, refetch } = useMortgages();

  // Filter only active mortgages and apply time thresholds
  const activeMortgages = allMortgages.filter((m) => m.status === 'active');

  const filteredMortgages = activeMortgages.filter((m) => {
    const isOverdue = isMortgageOverdue(m.due_date, m.status);
    const daysUntilDue = getDaysUntilDue(m.due_date);

    if (activeFilter === 'overdue' && !isOverdue) return false;
    if (activeFilter === '7days' && (isOverdue || daysUntilDue > 7)) return false;
    if (activeFilter === '15days' && (isOverdue || daysUntilDue > 15)) return false;
    if (activeFilter === '30days' && (isOverdue || daysUntilDue > 30)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        m.mortgage_no.toLowerCase().includes(q) ||
        m.customer?.name.toLowerCase().includes(q) ||
        m.customer?.phone.includes(q) ||
        m.collateral_description.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  const businessName =
    localStorage.getItem('business_name') ||
    import.meta.env.VITE_BUSINESS_NAME ||
    'মেসার্স আলম ব্রাদার্স ট্রেডার্স ও বন্ধকী';

  const filterChips = [
    {
      id: 'overdue',
      label: t('due_list.filter_overdue'),
      count: activeMortgages.filter((m) => isMortgageOverdue(m.due_date, m.status)).length,
      alert: true,
    },
    {
      id: '7days',
      label: t('due_list.filter_7_days'),
      count: activeMortgages.filter((m) => !isMortgageOverdue(m.due_date, m.status) && getDaysUntilDue(m.due_date) <= 7).length,
    },
    {
      id: '15days',
      label: t('due_list.filter_15_days'),
      count: activeMortgages.filter((m) => !isMortgageOverdue(m.due_date, m.status) && getDaysUntilDue(m.due_date) <= 15).length,
    },
    {
      id: '30days',
      label: t('due_list.filter_30_days'),
      count: activeMortgages.filter((m) => !isMortgageOverdue(m.due_date, m.status) && getDaysUntilDue(m.due_date) <= 30).length,
    },
    {
      id: 'all',
      label: t('due_list.filter_all'),
      count: activeMortgages.length,
    },
  ];

  const handleFilterChange = (id: string) => {
    setActiveFilter(id);
    setSearchParams({ filter: id });
  };

  const handleCall = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`tel:${phone}`);
  };

  const handleWhatsApp = (
    phone: string,
    customerName: string,
    mortgageNo: string,
    dueDate: string,
    principal: number,
    rate: number,
    isOverdue: boolean,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const intlPhone = cleanPhone.startsWith('880')
      ? cleanPhone
      : cleanPhone.startsWith('0')
      ? '880' + cleanPhone.substring(1)
      : '880' + cleanPhone;

    const yearlyInterest = calculateYearlyInterest(principal, rate);
    const formattedDue = formatDateDhaka(dueDate, language);

    let text = '';
    if (language === 'en') {
      if (isOverdue) {
        text = `Hello ${customerName}, this is ${businessName}. Your mortgage (${mortgageNo}) was due on ${formattedDue}. Please contact us promptly to renew by paying interest of ${formatBDT(yearlyInterest, 'en')} or settle in full.`;
      } else {
        text = `Hello ${customerName}, this is ${businessName}. This is a gentle reminder that your mortgage (${mortgageNo}) is due on ${formattedDue}. Please contact us to renew or settle.`;
      }
    } else {
      if (isOverdue) {
        text = `আসসালামু আলাইকুম ${customerName} ভাই/আপা, ${businessName} থেকে যোগাযোগ করা হচ্ছে। আপনার বন্ধকী (${mortgageNo}) এর মেয়াদ (${formattedDue}) উত্তীর্ণ হয়ে গেছে। দ্রুত যোগাযোগ করে বার্ষিক সুদ ${formatBDT(yearlyInterest, 'bn')} প্রদান করে নবায়ন করার জন্য বিনীত অনুরোধ জানাচ্ছি।`;
      } else {
        text = `আসসালামু আলাইকুম ${customerName} ভাই/আপা, ${businessName} থেকে জানানো যাচ্ছে যে, আপনার বন্ধকী (${mortgageNo}) এর মেয়াদ আগামী ${formattedDue} তারিখে পূর্ণ হবে। সময়মতো সুদ প্রদান করে নবায়ন অথবা সম্পূর্ণ পরিশোধ করার অনুরোধ করা হলো।`;
      }
    }

    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`);
  };

  return (
    <div className="space-y-6 pb-24 md:pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          {t('due_list.title')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          {language === 'en'
            ? 'Track upcoming and overdue mortgage loans with 1-click reminders'
            : 'মেয়াদোত্তীর্ণ ও প্রদেয় বন্ধকী ঋণের তাগাদা এবং যোগাযোগের তালিকা'}
        </p>
      </div>

      {/* Filter Chips & Search Bar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === 'en'
                ? 'Search by customer name, phone, or mortgage no...'
                : 'গ্রাহকের নাম, মোবাইল নম্বর বা বন্ধক নং দিয়ে খুঁজুন...'
            }
            className="pl-10 h-11 bg-white shadow-2xs"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {filterChips.map((chip) => {
            const isSelected = activeFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => handleFilterChange(chip.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? chip.alert
                      ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                      : 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>{chip.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : chip.alert
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* List or States */}
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
      ) : filteredMortgages.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title={language === 'bn' ? "কোনো বন্ধকী তাগাদার প্রয়োজন নেই" : "No Due or Overdue Mortgages"}
          description={language === 'bn' ? "নির্বাচিত ফিল্টারের আওতায় বর্তমানে কোনো মেয়াদোত্তীর্ণ বা প্রদেয় বন্ধকী নেই।" : "There are currently no overdue or upcoming due mortgages under this filter."}
          actionLabel={language === 'bn' ? "সকল বন্ধক দেখুন" : "View All Mortgages"}
          onAction={() => handleFilterChange('all')}
        />
      ) : (
        <div className="space-y-3">
          {filteredMortgages.map((mtg) => {
            const isOverdue = isMortgageOverdue(mtg.due_date, mtg.status);
            const daysUntilDue = getDaysUntilDue(mtg.due_date);
            const yearlyInterest = calculateYearlyInterest(mtg.principal, mtg.interest_rate);

            return (
              <Card
                key={mtg.id}
                onClick={() => navigate(`/mortgages/${mtg.id}`)}
                className={`p-4 sm:p-5 transition-all hover:shadow-md cursor-pointer border hover:border-emerald-300 group ${
                  isOverdue
                    ? 'border-rose-200 bg-gradient-to-r from-rose-50/40 via-white to-white'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Customer and Mortgage Info */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {mtg.mortgage_no}
                      </span>
                      {isOverdue ? (
                        <Badge variant="overdue" className="gap-1 text-[11px] font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{language === 'bn' ? `${toBanglaDigits(Math.abs(daysUntilDue))} দিন মেয়াদোত্তীর্ণ` : `${Math.abs(daysUntilDue)}d overdue`}</span>
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-[11px] text-amber-700 bg-amber-50 border-amber-200 font-bold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{language === 'bn' ? `${toBanglaDigits(daysUntilDue)} দিন বাকি` : `${daysUntilDue}d remaining`}</span>
                        </Badge>
                      )}
                    </div>

                    <div className="pt-1">
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors flex items-center gap-1.5">
                        <span>{mtg.customer?.name}</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
                      <span className="flex items-center gap-1 font-semibold text-slate-700">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {mtg.customer?.phone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{language === 'bn' ? 'মেয়াদ:' : 'Due:'} <strong className="text-slate-700">{formatDateDhaka(mtg.due_date, language)}</strong></span>
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-1 italic pt-1">
                      {language === 'bn' ? 'জামানত:' : 'Collateral:'} {mtg.collateral_description}
                    </p>
                  </div>

                  {/* Financials & Quick Action Buttons */}
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 gap-3">
                    <div className="text-left sm:text-right">
                      <div className="text-xs text-slate-400">
                        {language === 'bn' ? 'প্রদেয় সুদ' : 'Interest Due'}
                      </div>
                      <div className="text-lg font-black text-emerald-700 font-mono flex items-center sm:justify-end gap-1">
                        <Coins className="w-4 h-4 text-emerald-600" />
                        <span>{formatBDT(yearlyInterest, language)}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {language === 'bn' ? 'আসল:' : 'Principal:'} {formatBDT(mtg.principal, language)}
                      </span>
                    </div>

                    {/* Direct Contact Buttons */}
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleCall(mtg.customer?.phone || '', e)}
                        className="gap-1.5 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 h-9 font-bold px-3"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{t('due_list.call_customer')}</span>
                      </Button>

                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={(e) =>
                          handleWhatsApp(
                            mtg.customer?.phone || '',
                            mtg.customer?.name || '',
                            mtg.mortgage_no,
                            mtg.due_date,
                            mtg.principal,
                            mtg.interest_rate,
                            isOverdue,
                            e
                          )
                        }
                        className="gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white h-9 font-bold px-3 shadow-sm shadow-teal-600/20"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{t('due_list.whatsapp_customer')}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
