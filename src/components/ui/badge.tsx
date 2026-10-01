import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'active' | 'closed' | 'overdue' | 'defaulted' | 'secondary' | 'outline' | 'interest' | 'full';
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = 'secondary', ...props }) => {
  const variants = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    closed: 'bg-slate-100 text-slate-700 border-slate-200',
    overdue: 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse',
    defaulted: 'bg-amber-50 text-amber-700 border-amber-200',
    secondary: 'bg-slate-100 text-slate-600 border-slate-200',
    outline: 'border border-slate-300 text-slate-700 bg-transparent',
    interest: 'bg-blue-50 text-blue-700 border-blue-200',
    full: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors',
        variants[variant],
        className
      )}
      {...props}
    />
  );
};
