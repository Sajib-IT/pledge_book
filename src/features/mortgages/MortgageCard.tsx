import React from 'react';
import type { Mortgage } from '../../types/database';
import { useI18n } from '../../lib/i18n';
import { formatBDT, formatDateDhaka, isMortgageOverdue, getDaysUntilDue, calculateYearlyInterest } from '../../lib/calculations';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  Calendar,
  AlertTriangle,
  ChevronRight,
  Shield,
  Coins,
  Gem,
  FileCheck,
  Bike,
  Tv,
  HelpCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const collateralIcons: Record<string, any> = {
  gold: Gem,
  land: FileCheck,
  vehicle: Bike,
  electronics: Tv,
  other: HelpCircle,
};

export const MortgageCard: React.FC<{ mortgage: Mortgage }> = ({ mortgage }) => {
  const { language, t } = useI18n();
  const navigate = useNavigate();

  const isOverdue = isMortgageOverdue(mortgage.due_date, mortgage.status);
  const daysUntilDue = getDaysUntilDue(mortgage.due_date);
  const yearlyInterest = calculateYearlyInterest(mortgage.principal, mortgage.interest_rate);
  const CollateralIcon = collateralIcons[mortgage.collateral_type] || HelpCircle;

  const handleClick = () => {
    navigate(`/mortgages/${mortgage.id}`);
  };

  return (
    <Card
      onClick={handleClick}
      className="p-5 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group border-slate-200/90 relative overflow-hidden"
    >
      {/* Top Header: Mortgage No & Status Badge */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
            {mortgage.mortgage_no}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 capitalize bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
            <CollateralIcon className="w-3 h-3 text-emerald-600" />
            <span>{t(`mortgages.collateral_types.${mortgage.collateral_type}`, mortgage.collateral_type)}</span>
          </span>
        </div>

        {isOverdue ? (
          <Badge variant="overdue" className="gap-1 font-bold">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            <span>{t('mortgages.status_overdue')}</span>
          </Badge>
        ) : mortgage.status === 'closed' ? (
          <Badge variant="closed" className="gap-1 font-semibold">
            <Shield className="w-3 h-3 text-slate-500" />
            <span>{t('mortgages.status_closed')}</span>
          </Badge>
        ) : (
          <Badge variant="active" className="gap-1 font-semibold">
            <span>{t('mortgages.status_active')}</span>
          </Badge>
        )}
      </div>

      {/* Customer Info & Amounts */}
      <div className="py-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-base text-slate-900 group-hover:text-emerald-700 transition-colors">
            {mortgage.customer?.name || (language === 'bn' ? 'গ্রাহকের তথ্য' : 'Customer Info')}
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {mortgage.customer?.phone}
          </p>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-400 font-medium block">
            {language === 'bn' ? 'আসল মূলধন' : 'Principal'}
          </span>
          <div className="text-lg font-black text-slate-900 font-mono flex items-center justify-end gap-1">
            <Coins className="w-4 h-4 text-emerald-600" />
            <span>{formatBDT(mortgage.principal, language)}</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold block">
            +{formatBDT(yearlyInterest, language)} {language === 'bn' ? 'সুদ' : 'interest'} ({mortgage.interest_rate}%)
          </span>
        </div>
      </div>

      {/* Collateral Description Snippet */}
      <p className="text-xs text-slate-600 line-clamp-1 bg-slate-50/70 p-2 rounded-xl border border-slate-100 italic">
        {mortgage.collateral_description}
      </p>

      {/* Footer: Due date info & arrow */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{language === 'bn' ? 'মেয়াদ:' : 'Due:'} <strong className="text-slate-800">{formatDateDhaka(mortgage.due_date, language)}</strong></span>
          {mortgage.status === 'active' && (
            <span
              className={`font-bold ml-1 ${
                isOverdue
                  ? 'text-rose-600 font-bold'
                  : daysUntilDue <= 15
                  ? 'text-amber-600'
                  : 'text-emerald-600'
              }`}
            >
              ({isOverdue
                ? (language === 'bn' ? `${Math.abs(daysUntilDue)} দিন বিলম্বিত` : `${Math.abs(daysUntilDue)}d overdue`)
                : (language === 'bn' ? `${daysUntilDue} দিন বাকি` : `${daysUntilDue}d remaining`)})
            </span>
          )}
        </div>

        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all shrink-0" />
      </div>
    </Card>
  );
};
