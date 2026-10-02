import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../lib/i18n';
import { formatBDT, toBanglaDigits } from '../../lib/calculations';
import { useDashboardStats } from './useDashboardStats';
import { useMortgages } from '../mortgages/useMortgages';
import { MortgageCard } from '../mortgages/MortgageCard';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Link } from 'react-router-dom';
import {
  Coins,
  TrendingUp,
  AlertTriangle,
  Clock,
  PlusCircle,
  Users,
  Calendar,
  ChevronRight,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { isOwner } = useAuth();
  const { language, t } = useI18n();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: mortgages = [], isLoading: mtgLoading } = useMortgages();

  if (statsLoading || mtgLoading) {
    return <LoadingSpinner message={t('common.loading')} />;
  }

  const activeStats = stats || {
    total_outstanding_principal: 0,
    active_mortgages_count: 0,
    expected_interest_this_month: 0,
    overdue_count: 0,
    due_within_15_days_count: 0,
    income_this_month: 0,
    income_this_year: 0,
    calculated_at: new Date().toISOString(),
  };

  const recentMortgages = mortgages.slice(0, 4);

  return (
    <div className="space-y-6 pb-24 md:pb-12">
      {/* Top Banner with Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-700 p-6 rounded-3xl text-white shadow-xl shadow-emerald-900/15">
        <div>
          <span className="text-emerald-200 text-xs font-bold uppercase tracking-wider">
            {t('dashboard.title')}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">
            {t('app_name')}
          </h1>
          <p className="text-emerald-100 text-xs sm:text-sm mt-1 max-w-md">
            {language === 'bn'
              ? 'বন্ধকী ঋণ, স্বর্ণের হিসাব ও সুদের সম্পূর্ণ ডিজিটাল খাতা'
              : 'Complete digital ledger for mortgage loans, collateral & interest tracking'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
          <Link to="/mortgages/new">
            <Button
              variant="outline"
              size="sm"
              className="bg-white text-emerald-800 hover:bg-emerald-50 border-0 font-bold shadow-md h-10"
            >
              <PlusCircle className="w-4 h-4 mr-1.5 text-emerald-600" />
              <span>{t('dashboard.new_mortgage_btn')}</span>
            </Button>
          </Link>
          <Link to="/customers">
            <Button
              variant="outline"
              size="sm"
              className="bg-emerald-600/40 text-white hover:bg-emerald-600/60 border border-white/20 font-bold backdrop-blur-sm h-10"
            >
              <Users className="w-4 h-4 mr-1.5" />
              <span>{t('dashboard.add_customer_btn')}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Principal Outstanding */}
        <Card className="p-4 sm:p-5 border-emerald-100 bg-gradient-to-b from-white to-emerald-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('dashboard.outstanding_principal')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2 font-mono">
            {formatBDT(activeStats.total_outstanding_principal, language)}
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-1 block">
            {language === 'bn'
              ? `${toBanglaDigits(activeStats.active_mortgages_count)} টি সক্রিয় বন্ধক`
              : `${activeStats.active_mortgages_count} active ${activeStats.active_mortgages_count === 1 ? 'mortgage' : 'mortgages'}`}
          </span>
        </Card>

        {/* Expected Interest This Month */}
        <Card className="p-4 sm:p-5 border-blue-100 bg-gradient-to-b from-white to-blue-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {t('dashboard.interest_this_month')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-900 mt-2 font-mono">
            {formatBDT(activeStats.expected_interest_this_month, language)}
          </div>
          <span className="text-[11px] text-blue-600 font-medium mt-1 block">
            {language === 'bn' ? 'চলতি মাসে প্রদেয়' : 'Receivable this month'}
          </span>
        </Card>

        {/* Overdue Count */}
        <Link to="/due-list?filter=overdue">
          <Card className="p-4 sm:p-5 border-rose-100 bg-gradient-to-b from-white to-rose-50/40 hover:border-rose-300 transition-all cursor-pointer">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">
                {t('dashboard.overdue_count')}
              </span>
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center animate-pulse">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-800 mt-2 font-mono">
              {language === 'bn' ? `${toBanglaDigits(activeStats.overdue_count)} টি` : activeStats.overdue_count}
            </div>
            <span className="text-[11px] text-rose-600 font-semibold mt-1 block">
              {language === 'bn' ? 'তাগাদা প্রদান আবশ্যক' : 'Urgent follow-up required'}
            </span>
          </Card>
        </Link>

        {/* Due in 15 days */}
        <Link to="/due-list?filter=15days">
          <Card className="p-4 sm:p-5 border-amber-100 bg-gradient-to-b from-white to-amber-50/40 hover:border-amber-300 transition-all cursor-pointer">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                {t('dashboard.due_in_15_days')}
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-900 mt-2 font-mono">
              {language === 'bn' ? `${toBanglaDigits(activeStats.due_within_15_days_count)} টি` : activeStats.due_within_15_days_count}
            </div>
            <span className="text-[11px] text-amber-600 font-medium mt-1 block">
              {language === 'bn' ? 'মেয়াদ আসন্ন' : 'Due date approaching'}
            </span>
          </Card>
        </Link>
      </div>

      {/* Income Summary (Owner Only View) */}
      {isOwner && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="p-5 border-slate-200 bg-white">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>{t('dashboard.income_month')}</span>
            </div>
            <div className="text-2xl font-black text-emerald-800 mt-2 font-mono">
              {formatBDT(activeStats.income_this_month, language)}
            </div>
            <span className="text-[11px] text-slate-500 font-medium mt-1 block">
              {language === 'bn'
                ? 'সকল সুদ ও পরিশোধিত বন্ধক থেকে আয়'
                : 'From all interest & settled mortgages'}
            </span>
          </Card>
          <Card className="p-5 border-slate-200 bg-white">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>{t('dashboard.income_year')}</span>
            </div>
            <div className="text-2xl font-black text-emerald-800 mt-2 font-mono">
              {formatBDT(activeStats.income_this_year, language)}
            </div>
            <span className="text-[11px] text-slate-500 font-medium mt-1 block">
              {language === 'bn'
                ? 'চলতি অর্থবছরে সংগৃহীত মোট আয়'
                : 'Total collected in current fiscal year'}
            </span>
          </Card>
        </div>
      )}

      {/* Recent Mortgages Section */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              {language === 'bn' ? 'সাম্প্রতিক বন্ধকী হিসাব' : 'Recent Mortgages'}
            </h2>
            <p className="text-xs text-slate-500">
              {language === 'bn' ? 'চলমান ও সাম্প্রতিক লেনদেনসমূহ' : 'Active and recent transactions'}
            </p>
          </div>
          <Link
            to="/mortgages"
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
          >
            <span>{language === 'bn' ? 'সবগুলো দেখুন' : 'View All'}</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recentMortgages.map((mtg) => (
            <MortgageCard key={mtg.id} mortgage={mtg} />
          ))}
        </div>
      </div>
    </div>
  );
};
