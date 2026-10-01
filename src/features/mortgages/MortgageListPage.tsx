import React, { useState } from 'react';
import { useMortgages } from './useMortgages';
import { MortgageCard } from './MortgageCard';
import { useI18n } from '../../lib/i18n';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { PlusCircle, Search, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

export const MortgageListPage: React.FC = () => {
  const { language, t } = useI18n();
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'overdue' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: mortgages = [], isLoading, isError, error, refetch } = useMortgages({
    status: activeTab,
    search: searchQuery,
  });

  const tabs = [
    { id: 'all', label: language === 'bn' ? 'সকল' : 'All' },
    { id: 'active', label: language === 'bn' ? 'চলমান (Active)' : 'Active' },
    { id: 'overdue', label: language === 'bn' ? 'মেয়াদোত্তীর্ণ (Overdue)' : 'Overdue' },
    { id: 'closed', label: language === 'bn' ? 'পরিশোধিত (Closed)' : 'Closed' },
  ];

  return (
    <div className="space-y-6 pb-24 md:pb-12">
      {/* Header & New Mortgage Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {t('mortgages.title')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {language === 'bn'
              ? 'সকল চলমান, পরিশোধিত ও তামাদি বন্ধকীর তালিকা'
              : 'Directory of all active, overdue, and closed mortgages'}
          </p>
        </div>

        <Link to="/mortgages/new" className="self-start sm:self-auto">
          <Button variant="primary" className="gap-2 shadow-md shadow-emerald-600/20">
            <PlusCircle className="w-4 h-4" />
            <span>{t('mortgages.new_mortgage')}</span>
          </Button>
        </Link>
      </div>

      {/* Search Bar & Tabs */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === 'bn'
                ? 'বন্ধক নং, গ্রাহকের নাম, ফোন বা জামানতের বিবরণ দিয়ে খুঁজুন...'
                : 'Search by mortgage no, customer name, phone, or collateral...'
            }
            className="pl-10 h-11 bg-white shadow-2xs"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mortgages List / Grid */}
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
      ) : mortgages.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={
            searchQuery
              ? language === 'bn'
                ? 'কোনো বন্ধকী পাওয়া যায়নি'
                : 'No mortgages found'
              : language === 'bn'
              ? 'তালিকায় কোনো বন্ধক নেই'
              : 'No mortgages in list'
          }
          description={
            searchQuery
              ? language === 'bn'
                ? `"${searchQuery}" এর সাথে মিলে এমন কোনো রেকর্ড নেই`
                : `No records matching "${searchQuery}"`
              : language === 'bn'
              ? 'নতুন জামানত গ্রহণ ও বন্ধক তৈরি করতে নিচের বাটনে চাপ দিন'
              : 'Click the button below to issue a new mortgage'
          }
          actionLabel={t('mortgages.new_mortgage')}
          onAction={() => (window.location.href = '/mortgages/new')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mortgages.map((mtg) => (
            <MortgageCard key={mtg.id} mortgage={mtg} />
          ))}
        </div>
      )}
    </div>
  );
};
