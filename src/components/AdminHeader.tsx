'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';
import LanguageToggle from '@/components/LanguageToggle';
import { useLanguage } from '@/components/LanguageContext';
import {
  ShieldCheck,
  BarChart3,
  Users,
  Layers,
  Settings,
  FileText,
  CalendarCheck,
  History,
  Package,
  Megaphone,
  UserPlus,
  Target,
  FileSpreadsheet,
  ShieldAlert,
  Menu,
  X,
} from 'lucide-react';

interface AdminHeaderProps {
  session: {
    name: string;
    email: string;
    role: string;
  };
}

const navLinks = [
  { href: '/admin/dashboard', key: 'nav.dashboard', labelBn: 'ড্যাশবোর্ড', labelEn: 'Dashboard', icon: BarChart3 },
  { href: '/admin/sections', key: 'nav.sections', labelBn: 'গ্রুপ সেকশন', labelEn: 'Group Sections', icon: Layers },
  { href: '/admin/csv/history', key: 'nav.upload_history', labelBn: 'আপলোড হিস্ট্রি', labelEn: 'Upload History', icon: History },
  { href: '/admin/employees', key: 'nav.team', labelBn: 'টিম', labelEn: 'Team', icon: Users },
  { href: '/admin/products', key: 'nav.products', labelBn: 'পণ্য (Products)', labelEn: 'Products', icon: Package },
  { href: '/admin/campaigns', key: 'nav.campaigns', labelBn: 'ক্যাম্পেইন', labelEn: 'Campaigns', icon: Megaphone },
  { href: '/admin/leads', key: 'nav.leads', labelBn: 'লিডস পাইপলাইন', labelEn: 'Leads Pipeline', icon: UserPlus },
  { href: '/admin/targets', key: 'nav.targets', labelBn: 'টার্গেট ও বাজেট', labelEn: 'Targets & Budget', icon: Target },
  { href: '/admin/reports/daily', key: 'nav.daily_reports', labelBn: 'দৈনিক রিপোর্ট', labelEn: 'Daily Reports', icon: FileText },
  { href: '/admin/reports/weekly', key: 'nav.weekly_reports', labelBn: 'সাপ্তাহিক রিপোর্ট', labelEn: 'Weekly Reports', icon: FileSpreadsheet },
  { href: '/admin/reports/monthly', key: 'nav.monthly_reports', labelBn: 'মাসিক রিপোর্ট', labelEn: 'Monthly Reports', icon: BarChart3 },
  { href: '/admin/plan', key: 'nav.plan_90', labelBn: '৯০ দিনের প্ল্যান', labelEn: '90-Day Plan', icon: CalendarCheck },
  { href: '/admin/audit', key: 'nav.audit', labelBn: 'অডিট লগ', labelEn: 'Audit Log', icon: ShieldAlert },
  { href: '/admin/settings', key: 'nav.settings', labelBn: 'সেটিংস', labelEn: 'Settings', icon: Settings },
];

export default function AdminHeader({ session }: AdminHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { t, lang } = useLanguage();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const isLinkActive = (href: string) => {
    if (href === '/admin/dashboard') {
      return pathname === '/admin/dashboard';
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

          <Link href="/admin/dashboard" className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="truncate">
              <div className="text-sm sm:text-base font-bold text-slate-900 hover:text-emerald-700 truncate">
                {t('common.admin_title', 'মার্কেটিং অ্যাডমিন প্যানেল', 'Marketing Admin Panel')}
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
                <span className="text-[11px] text-slate-500">
                  {t('common.admin_subtitle', 'Head of Marketing Control Center', 'Head of Marketing Control Center')}
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
          <span className="rounded-full bg-emerald-100 px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-[11px] font-bold text-emerald-800 shrink-0">
            ADMIN
          </span>
          <LogoutButton />
        </div>
      </div>

      {/* Secondary Horizontal Scrollable Navigation */}
      <div className="border-t border-slate-100 bg-slate-50/70 px-2 sm:px-6">
        <nav
          className="mx-auto flex max-w-7xl items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-2 text-xs font-semibold text-slate-600"
          aria-label={lang === 'bn' ? 'অ্যাডমিন নেভিগেশন' : 'Admin navigation'}
        >
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isLinkActive(link.href);
            const labelText = t(link.key, link.labelBn, link.labelEn);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-emerald-800 hover:bg-emerald-50'
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
          {/* User info on mobile */}
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-900">{session.name}</div>
              <div className="text-[11px] text-slate-500">{session.email}</div>
            </div>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              ADMIN
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
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`h-4 w-4 ${active ? 'text-emerald-600' : 'text-slate-500'}`} />
                    <span>{labelText}</span>
                  </div>
                  {active && (
                    <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
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
