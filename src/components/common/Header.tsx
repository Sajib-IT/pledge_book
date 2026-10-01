import React from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { useI18n } from '../../lib/i18n';
import { Globe, LogOut, Shield } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const Header: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const navigate = useNavigate();

  const handleLanguageToggle = () => {
    setLanguage(language === 'bn' ? 'en' : 'bn');
  };

  const handleLogout = async () => {
    if (window.confirm(t('settings.logout_confirm'))) {
      await logout();
      navigate('/login');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 safe-top">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md shadow-emerald-700/20 group-hover:scale-105 transition-transform border border-emerald-600/30 shrink-0">
            <img src="/app-icon.jpg" alt="PledgeBook Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight leading-tight">
              {t('app_name')}
            </div>
            <div className="text-[10px] text-emerald-700 font-medium tracking-wide">
              {t('tagline')}
            </div>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 font-medium text-sm text-slate-600">
          <Link
            to="/"
            className="px-3 py-2 rounded-lg hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors"
          >
            {t('nav.dashboard')}
          </Link>
          <Link
            to="/customers"
            className="px-3 py-2 rounded-lg hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors"
          >
            {t('nav.customers')}
          </Link>
          <Link
            to="/mortgages"
            className="px-3 py-2 rounded-lg hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors"
          >
            {t('nav.mortgages')}
          </Link>
          <Link
            to="/due-list"
            className="px-3 py-2 rounded-lg hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors"
          >
            {t('nav.due_list')}
          </Link>
          <Link
            to="/receipts"
            className="px-3 py-2 rounded-lg hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors"
          >
            {t('nav.receipts')}
          </Link>
          {profile?.role === 'owner' && (
            <Link
              to="/reports"
              className="px-3 py-2 rounded-lg hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors"
            >
              {t('nav.reports')}
            </Link>
          )}
          <Link
            to="/settings"
            className="px-3 py-2 rounded-lg hover:text-emerald-700 hover:bg-emerald-50/60 transition-colors"
          >
            {t('nav.settings')}
          </Link>
        </nav>

        {/* Right Action Icons: Language Toggle & User Profile */}
        <div className="flex items-center gap-2">
          {/* Language Toggle */}
          <button
            onClick={handleLanguageToggle}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors shadow-2xs"
            title="Toggle Language"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-600" />
            <span>{language === 'bn' ? 'বাংলা' : 'EN'}</span>
          </button>

          {/* User Role Badge & Signout */}
          {user && (
            <div className="flex items-center gap-2 pl-1 sm:pl-2 border-l border-slate-200">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-semibold text-slate-900 leading-tight">
                  {profile?.name || user.email?.split('@')[0]}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                  <Shield className="w-2.5 h-2.5" />
                  {profile?.role === 'owner' ? t('auth.role_owner') : t('auth.role_staff')}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title={t('auth.logout')}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
