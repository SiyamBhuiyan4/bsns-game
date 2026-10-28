'use client';

import React, { useState } from 'react';
import { Type } from 'lucide-react';

export const FONT_OPTIONS = [
  { value: 'hind', label: 'Hind Siliguri' },
  { value: 'noto', label: 'Noto Sans Bengali' },
  { value: 'inter', label: 'Inter (English)' },
] as const;

/** Font choice for the employee panel. Stored in a cookie so the server renders it first time. */
export default function FontPicker() {
  const [font, setFont] = useState<string>(() =>
    typeof document === 'undefined' ? 'hind' : document.documentElement.dataset.font || 'hind'
  );

  const change = (value: string) => {
    setFont(value);
    document.documentElement.dataset.font = value;
    document.cookie = `app_font=${value}; path=/; max-age=31536000; SameSite=Lax`;
  };

  return (
    <label className="relative inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 shadow-sm">
      <Type className="h-3.5 w-3.5 text-violet-500" />
      <span className="sr-only">Font</span>
      <select
        value={font}
        onChange={(e) => change(e.target.value)}
        className="bg-transparent text-xs font-medium text-slate-700 outline-none"
      >
        {FONT_OPTIONS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>
    </label>
  );
}
