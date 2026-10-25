'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from './LanguageContext';
import { Languages, ChevronDown, Check } from 'lucide-react';

export default function LanguageToggle() {
  const { lang, setLang, digitStyle, setDigitStyle } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Compact Header Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="btn btn-secondary btn-sm"
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={lang === 'bn' ? 'ভাষা ও সংখ্যার রূপ পরিবর্তন করুন' : 'Change language and number format'}
      >
        <Languages className="h-3.5 w-3.5 text-emerald-600" />
        <span className="font-bold">{lang === 'bn' ? 'বাংলা' : 'EN'}</span>
        <span className="text-slate-300">|</span>
        <span className="text-[11px] text-slate-600 font-mono">
          {digitStyle === 'bn' ? '০-৯' : '0-9'}
        </span>
        <ChevronDown
          className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl border border-slate-200 bg-white p-3 shadow-lg ring-1 ring-black/5 z-50 animate-in fade-in zoom-in-95 duration-100">
          {/* Language Selection */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {lang === 'bn' ? 'ভাষা (Language)' : 'Language (ভাষা)'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setLang('bn')}
                className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  lang === 'bn'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lang === 'bn' && <Check className="h-3 w-3 text-emerald-600" />}
                <span>বাংলা</span>
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  lang === 'en'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lang === 'en' && <Check className="h-3 w-3 text-emerald-600" />}
                <span>English</span>
              </button>
            </div>
          </div>

          {/* Number Digits Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {lang === 'bn' ? 'সংখ্যার রূপ (Digits)' : 'Digits (সংখ্যার রূপ)'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setDigitStyle('bn')}
                className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  digitStyle === 'bn'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {digitStyle === 'bn' && <Check className="h-3 w-3 text-emerald-600" />}
                <span>বাংলা (০-৯)</span>
              </button>
              <button
                type="button"
                onClick={() => setDigitStyle('en')}
                className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  digitStyle === 'en'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {digitStyle === 'en' && <Check className="h-3 w-3 text-emerald-600" />}
                <span>English (0-9)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
