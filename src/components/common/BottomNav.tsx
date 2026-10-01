import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, PlusCircle, AlertCircle, Settings } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { cn } from '../../lib/utils';

export const BottomNav: React.FC = () => {
  const { t } = useI18n();

  const navItems = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard },
    { to: '/customers', label: t('nav.customers'), icon: Users },
    { to: '/mortgages/new', label: t('nav.new_mortgage'), icon: PlusCircle, highlight: true },
    { to: '/due-list', label: t('nav.due_list'), icon: AlertCircle },
    { to: '/settings', label: t('nav.settings'), icon: Settings },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 safe-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center w-full h-full py-1 text-xs font-medium transition-colors select-none',
                  item.highlight
                    ? 'text-emerald-600 font-bold'
                    : isActive
                    ? 'text-emerald-700 font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {item.highlight ? (
                    <div className="w-10 h-10 -mt-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30">
                      <Icon className="w-5 h-5" />
                    </div>
                  ) : (
                    <Icon className={cn('w-5 h-5 mb-1', isActive && 'stroke-[2.5]')} />
                  )}
                  <span className={cn('text-[11px] truncate max-w-[64px]', item.highlight && 'mt-0.5')}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
