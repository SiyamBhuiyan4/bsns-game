'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';
import LanguageToggle from '@/components/LanguageToggle';
import { useLanguage } from '@/components/LanguageContext';
import {
  UserCheck,
  CheckSquare,
  TrendingUp,
  Trophy,
  FileSpreadsheet,
  UserPlus,
  CalendarCheck,
  Menu,
  X,
} from 'lucide-react';

interface EmployeeHeaderProps {
  session: {
    name: string;
    email: string;
    role: string;
  };
}

const navLinks = [
  { href: '/employee/my-work', key: 'nav.my_work', labelBn: 'আমার কাজ (My Work)', labelEn: 'My Work', icon: CheckSquare },
  { href: '/employee/leads', key: 'nav.my_leads', labelBn: 'আমার লিড (Leads)', labelEn: 'My Leads', icon: UserPlus },
  { href: '/employee/daily-entry', key: 'nav.daily_entry', labelBn: 'দৈনিক এন্ট্রি', labelEn: 'Daily Entry', icon: FileSpreadsheet },
  { href: '/employee/performance', key: 'nav.performance', labelBn: 'পারফরম্যান্স', labelEn: 'Performance', icon: TrendingUp },
  { href: '/employee/plan', key: 'nav.plan_90', labelBn: '৯০ দিনের প্ল্যান', labelEn: '90-Day Plan', icon: CalendarCheck },
  { href: '/employee/leaderboard', key: 'nav.leaderboard', labelBn: 'লিডারবোর্ড', labelEn: 'Leaderboard', icon: Trophy },
];

export default function EmployeeHeader({ session }: EmployeeHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { t, lang } = useLanguage();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const isLinkActive = (href: string) => {
    if (href === '/employee/my-work') {
      return pathname === '/employee/my-work';
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur max-w-full">
      {/* Top Main Bar */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
            aria-label={mobileMenuOpen ? (lang === 'bn' ? 'মেনু বন্ধ করুন' : 'Close menu') : (lang === 'bn' ? 'মেনু খুলুন' : 'Open menu')}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link href="/employee/my-work" className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
              <UserCheck className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="truncate">
              <div className="text-sm sm:text-base font-bold text-slate-900 hover:text-teal-700 truncate">
                {t('common.employee_title', 'ডিজিটাল মার্কেটার পোর্টাল', 'Digital Marketer Portal')}
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-teal-500"></span>
                <span className="text-[11px] text-slate-500">
                  {t('common.employee_subtitle', 'Marketer Work & Performance Station', 'Marketer Work & Performance Station')}
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* User Badge & Actions */}
        <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
          <LanguageToggle />
          <div className="hidden md:block text-right">
            <div className="text-xs font-bold text-slate-800 leading-tight">{session.name}</div>
            <div className="text-[11px] text-slate-500">{session.email}</div>
          </div>
          <span className="rounded-full bg-teal-100 px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-[11px] font-bold text-teal-800 shrink-0">
            EMPLOYEE
          </span>
          <LogoutButton />
        </div>
      </div>

      {/* Secondary Horizontal Scrollable Navigation */}
      <div className="border-t border-slate-100 bg-slate-50/70 px-2 sm:px-6">
        <nav
          className="mx-auto flex max-w-7xl items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-2 text-xs font-semibold text-slate-600"
          aria-label={lang === 'bn' ? 'কর্মী নেভিগেশন' : 'Employee navigation'}
        >
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isLinkActive(link.href);
            const labelText = t(link.key, link.labelBn, link.labelEn);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? 'bg-teal-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-teal-800 hover:bg-teal-50'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${active ? 'text-white' : 'text-slate-500'}`} />
                <span>{labelText}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Mobile Drawer / Slide-down Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white shadow-xl animate-in fade-in duration-150">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-900">{session.name}</div>
              <div className="text-[11px] text-slate-500">{session.email}</div>
            </div>
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800">
              EMPLOYEE
            </span>
          </div>

          <div className="max-h-[calc(100vh-140px)] overflow-y-auto p-2 space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isLinkActive(link.href);
              const labelText = t(link.key, link.labelBn, link.labelEn);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors min-h-[44px] ${
                    active
                      ? 'bg-teal-50 text-teal-800 border border-teal-200'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`h-4 w-4 ${active ? 'text-teal-600' : 'text-slate-500'}`} />
                    <span>{labelText}</span>
                  </div>
                  {active && (
                    <span className="h-2 w-2 rounded-full bg-teal-600"></span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
