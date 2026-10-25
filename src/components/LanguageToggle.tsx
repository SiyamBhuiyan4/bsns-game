'use client';

import React from 'react';
import { useLanguage } from './LanguageContext';
import { Languages } from 'lucide-react';

export default function LanguageToggle() {
  const { lang, setLang, setDigitStyle } = useLanguage();

  const toggleLanguage = () => {
    if (lang === 'bn') {
      setLang('en');
      setDigitStyle('en');
    } else {
      setLang('bn');
      setDigitStyle('bn');
    }
  };

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="btn btn-secondary btn-sm gap-2 font-medium transition-all shadow-sm hover:border-slate-300"
      title={lang === 'bn' ? 'Switch to English (সব ইংলিশ করুন)' : 'Switch to Bangla (সব বাংলা করুন)'}
      aria-label={lang === 'bn' ? 'Switch to English' : 'Switch to Bangla'}
    >
      <Languages className="h-3.5 w-3.5 text-emerald-600" />
      <span className="flex items-center gap-1 text-xs">
        <span
          className={`px-1 py-0.5 rounded transition-colors ${
            lang === 'bn'
              ? 'bg-emerald-100 font-bold text-emerald-800'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          বাংলা
        </span>
        <span className="text-slate-300 font-light">/</span>
        <span
          className={`px-1 py-0.5 rounded transition-colors ${
            lang === 'en'
              ? 'bg-emerald-100 font-bold text-emerald-800'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          EN
        </span>
      </span>
    </button>
  );
}
