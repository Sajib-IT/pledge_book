// src/lib/i18n.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import bnDict from '../locales/bn.json';
import enDict from '../locales/en.json';

export type Language = 'bn' | 'en';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, defaultValue?: string) => string;
}

const dictionaries: Record<Language, any> = {
  bn: bnDict,
  en: enDict,
};

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app_lang');
    return (saved === 'en' || saved === 'bn') ? saved : 'bn'; // Bangla default as requested
  });

  useEffect(() => {
    localStorage.setItem('app_lang', language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (path: string, defaultValue?: string): string => {
    const keys = path.split('.');
    let current = dictionaries[language];

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        // Fallback to English dictionary
        let fallback = dictionaries['en'];
        for (const fKey of keys) {
          if (fallback && typeof fallback === 'object' && fKey in fallback) {
            fallback = fallback[fKey];
          } else {
            return defaultValue || path;
          }
        }
        return typeof fallback === 'string' ? fallback : (defaultValue || path);
      }
    }

    return typeof current === 'string' ? current : (defaultValue || path);
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
