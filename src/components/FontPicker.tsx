'use client';

import React, { useState } from 'react';
import { Type } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';

export const FONT_OPTIONS = [
  { value: 'hind', label: 'Hind Siliguri' },
  { value: 'noto', label: 'Noto Sans Bengali' },
  { value: 'inter', label: 'Inter (English)' },
] as const;

/** Currently applied font, as set on <html data-font>. */
export function readFont(): string {
  return typeof document === 'undefined' ? 'hind' : document.documentElement.dataset.font || 'hind';
}

/** Applies a font and remembers it in a cookie so the server renders it first time. */
export function applyFont(value: string) {
  document.documentElement.dataset.font = value;
  document.cookie = `app_font=${value}; path=/; max-age=31536000; SameSite=Lax`;
}

/**
 * Font choice for the employee panel, shown in the top bar from tablet width up.
 * On phones the top bar is too narrow, so the same choice lives in the profile menu.
 */
export default function FontPicker() {
  const { L } = useLanguage();
  const [font, setFont] = useState<string>(readFont);

  const change = (value: string) => {
    setFont(value);
    applyFont(value);
  };

  return (
    <label className="relative hidden h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-600 shadow-sm transition-colors hover:border-slate-300 sm:inline-flex">
      <Type className="h-3.5 w-3.5 text-violet-500" aria-hidden />
      <span className="sr-only">{L('ফন্ট', 'Font')}</span>
      <select
        value={font}
        onChange={(e) => change(e.target.value)}
        className="cursor-pointer bg-transparent text-xs font-medium text-slate-700 outline-none"
      >
        {FONT_OPTIONS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
    </label>
  );
}
