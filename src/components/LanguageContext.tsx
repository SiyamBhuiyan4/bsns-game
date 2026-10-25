'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  formatCurrency,
  formatNumber,
  DecimalLike,
  FormatterOptions,
} from '@/lib/formatter';

export type Language = 'bn' | 'en';
export type DigitStyle = 'bn' | 'en';

export interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  digitStyle: DigitStyle;
  setDigitStyle: (style: DigitStyle) => void;
  t: (key: string, defaultTextBn?: string, textEn?: string) => string;
  formatMoney: (
    val: DecimalLike | null | undefined,
    options?: Omit<FormatterOptions, 'digitStyle'>
  ) => string;
  formatNum: (
    val: DecimalLike | null | undefined,
    options?: Omit<FormatterOptions, 'digitStyle'>
  ) => string;
}

const COOKIE_LANG_KEY = 'app_lang';
const COOKIE_DIGIT_KEY = 'app_digit_style';

const dictionary: Record<Language, Record<string, string>> = {
  bn: {
    'nav.dashboard': 'ড্যাশবোর্ড',
    'nav.sections': 'গ্রুপ সেকশন',
    'nav.upload_history': 'আপলোড হিস্ট্রি',
    'nav.team': 'কর্মী',
    'nav.products': 'পণ্য (Products)',
    'nav.campaigns': 'ক্যাম্পেইন',
    'nav.leads': 'লিডস পাইপলাইন',
    'nav.targets': 'টার্গেট ও বাজেট',
    'nav.daily_reports': 'দৈনিক রিপোর্ট',
    'nav.weekly_reports': 'সাপ্তাহিক রিপোর্ট',
    'nav.monthly_reports': 'মাসিক রিপোর্ট',
    'nav.plan_90': '৯০ দিনের প্ল্যান',
    'nav.audit': 'অডিট লগ',
    'nav.settings': 'সেটিংস',
    'nav.my_work': 'আমার কাজ (My Work)',
    'nav.my_leads': 'আমার লিড (Leads)',
    'nav.daily_entry': 'দৈনিক এন্ট্রি',
    'nav.performance': 'পারফরম্যান্স',
    'nav.leaderboard': 'লিডারবোর্ড',
    'common.logout': 'লগআউট',
    'common.admin_title': 'মার্কেটিং অ্যাডমিন প্যানেল',
    'common.admin_subtitle': 'Head of Marketing Control Center',
    'common.employee_title': 'ডিজিটাল মার্কেটার পোর্টাল',
    'common.employee_subtitle': 'Marketer Work & Performance Station',
    'common.language': 'ভাষা',
    'common.digit_format': 'সংখ্যার রূপ',
    'common.bangla': 'বাংলা',
    'common.english': 'English',
    'common.bangla_digits': 'বাংলা (০-৯)',
    'common.english_digits': 'English (0-9)',
    'common.save': 'সংরক্ষণ করুন',
    'common.cancel': 'বাতিল',
    'common.edit': 'সম্পাদনা',
    'common.delete': 'মুছুন',
    'common.loading': 'লোড হচ্ছে...',
    'common.search': 'অনুসন্ধান',
    'common.filter': 'ফিল্টার',
    'common.total': 'মোট',
    'common.spend': 'খরচ',
    'common.revenue': 'রাজস্ব',
    'common.profit': 'লাভ',
    'common.roas': 'আরওএএস (ROAS)',
  },
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.sections': 'Group Sections',
    'nav.upload_history': 'Upload History',
    'nav.team': 'Employees',
    'nav.products': 'Products',
    'nav.campaigns': 'Campaigns',
    'nav.leads': 'Leads Pipeline',
    'nav.targets': 'Targets & Budget',
    'nav.daily_reports': 'Daily Reports',
    'nav.weekly_reports': 'Weekly Reports',
    'nav.monthly_reports': 'Monthly Reports',
    'nav.plan_90': '90-Day Plan',
    'nav.audit': 'Audit Log',
    'nav.settings': 'Settings',
    'nav.my_work': 'My Work',
    'nav.my_leads': 'My Leads',
    'nav.daily_entry': 'Daily Entry',
    'nav.performance': 'Performance',
    'nav.leaderboard': 'Leaderboard',
    'common.logout': 'Logout',
    'common.admin_title': 'Marketing Admin Panel',
    'common.admin_subtitle': 'Head of Marketing Control Center',
    'common.employee_title': 'Digital Marketer Portal',
    'common.employee_subtitle': 'Marketer Work & Performance Station',
    'common.language': 'Language',
    'common.digit_format': 'Number Format',
    'common.bangla': 'বাংলা',
    'common.english': 'English',
    'common.bangla_digits': 'বাংলা (০-৯)',
    'common.english_digits': 'English (0-9)',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.loading': 'Loading...',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.total': 'Total',
    'common.spend': 'Spend',
    'common.revenue': 'Revenue',
    'common.profit': 'Profit',
    'common.roas': 'ROAS',
  },
};

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function setCookie(name: string, value: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({
  children,
  initialLang = 'bn',
  initialDigitStyle = 'bn',
}: {
  children: ReactNode;
  initialLang?: Language;
  initialDigitStyle?: DigitStyle;
}) {
  const [lang, setLangState] = useState<Language>(initialLang);
  const [digitStyle, setDigitStyleState] = useState<DigitStyle>(initialDigitStyle);

  // Sync from localStorage / cookies on client mount
  useEffect(() => {
    try {
      const storedLang =
        (localStorage.getItem(COOKIE_LANG_KEY) as Language | null) ||
        (getCookie(COOKIE_LANG_KEY) as Language | undefined);
      if (storedLang === 'bn' || storedLang === 'en') {
        setLangState(storedLang);
        document.documentElement.lang = storedLang;
      }

      const storedDigits =
        (localStorage.getItem(COOKIE_DIGIT_KEY) as DigitStyle | null) ||
        (getCookie(COOKIE_DIGIT_KEY) as DigitStyle | undefined);
      if (storedDigits === 'bn' || storedDigits === 'en') {
        setDigitStyleState(storedDigits);
      }
    } catch {
      // Ignore localStorage access restrictions
    }
  }, []);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    setDigitStyleState(newLang);
    try {
      localStorage.setItem(COOKIE_LANG_KEY, newLang);
      localStorage.setItem(COOKIE_DIGIT_KEY, newLang);
      setCookie(COOKIE_LANG_KEY, newLang);
      setCookie(COOKIE_DIGIT_KEY, newLang);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = newLang;
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const setDigitStyle = useCallback((newStyle: DigitStyle) => {
    setDigitStyleState(newStyle);
    try {
      localStorage.setItem(COOKIE_DIGIT_KEY, newStyle);
      setCookie(COOKIE_DIGIT_KEY, newStyle);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const t = useCallback(
    (key: string, defaultTextBn?: string, textEn?: string): string => {
      const langDict = dictionary[lang];
      if (langDict && langDict[key]) {
        return langDict[key];
      }
      if (lang === 'en') {
        return textEn ?? defaultTextBn ?? key;
      }
      return defaultTextBn ?? textEn ?? key;
    },
    [lang]
  );

  const formatMoney = useCallback(
    (
      val: DecimalLike | null | undefined,
      options?: Omit<FormatterOptions, 'digitStyle'>
    ): string => {
      return formatCurrency(val, { ...options, digitStyle });
    },
    [digitStyle]
  );

  const formatNum = useCallback(
    (
      val: DecimalLike | null | undefined,
      options?: Omit<FormatterOptions, 'digitStyle'>
    ): string => {
      return formatNumber(val, { ...options, digitStyle });
    },
    [digitStyle]
  );

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLang,
        digitStyle,
        setDigitStyle,
        t,
        formatMoney,
        formatNum,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
