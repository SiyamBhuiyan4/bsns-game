'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useLanguage } from './LanguageContext';

/** Light/dark switch. The choice is stored in a cookie, so the server renders it too. */
export default function ThemeToggle() {
  const { theme, toggleTheme, t } = useLanguage();
  const isDark = theme === 'dark';
  const label = isDark ? t('common.light_mode') : t('common.dark_mode');

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="btn-icon relative overflow-hidden"
      title={label}
      aria-label={label}
      aria-pressed={isDark}
    >
      <Sun
        className={`absolute h-[18px] w-[18px] text-amber-500 transition-all duration-300 ${
          isDark ? 'translate-y-5 rotate-90 opacity-0' : 'translate-y-0 rotate-0 opacity-100'
        }`}
      />
      <Moon
        className={`absolute h-[18px] w-[18px] text-sky-400 transition-all duration-300 ${
          isDark ? 'translate-y-0 rotate-0 opacity-100' : '-translate-y-5 -rotate-90 opacity-0'
        }`}
      />
    </button>
  );
}
