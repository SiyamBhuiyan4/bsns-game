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
  BookOpen,
  GraduationCap,
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

// Keys use the "admin_nav." prefix on purpose: LanguageContext's dictionary
// has older "nav." entries that would override these labels.
const navGroups = [
  {
    key: 'overview',
    labelBn: 'ওভারভিউ',
    labelEn: 'Overview',
    items: [
      { href: '/admin/dashboard', key: 'admin_nav.dashboard', labelBn: 'ড্যাশবোর্ড', labelEn: 'Dashboard', icon: BarChart3 },
    ],
  },
  {
    key: 'team',
    labelBn: 'টিম ও গ্রুপ',
    labelEn: 'Team & Groups',
    items: [
      { href: '/admin/employees', key: 'admin_nav.team', labelBn: 'টিম', labelEn: 'Team', icon: Users },
      { href: '/admin/sections', key: 'admin_nav.groups', labelBn: 'গ্রুপ', labelEn: 'Groups', icon: Layers },
      { href: '/admin/csv/history', key: 'admin_nav.uploads', labelBn: 'আপলোড ইতিহাস', labelEn: 'Upload History', icon: History },
    ],
  },
  {
    key: 'sales',
    labelBn: 'সেলস ও লিড',
    labelEn: 'Sales & Leads',
    items: [
      { href: '/admin/products', key: 'admin_nav.products', labelBn: 'পণ্য', labelEn: 'Products', icon: Package },
      { href: '/admin/campaigns', key: 'admin_nav.campaigns', labelBn: 'ক্যাম্পেইন', labelEn: 'Campaigns', icon: Megaphone },
      { href: '/admin/leads', key: 'admin_nav.leads', labelBn: 'লিড', labelEn: 'Leads Pipeline', icon: UserPlus },
    ],
  },
  {
    key: 'targets',
    labelBn: 'টার্গেট',
    labelEn: 'Targets',
    items: [
      { href: '/admin/targets', key: 'admin_nav.targets', labelBn: 'টার্গেট ও বাজেট', labelEn: 'Targets & Budget', icon: Target },
    ],
  },
  {
    key: 'reports',
    labelBn: 'রিপোর্ট',
    labelEn: 'Reports',
    items: [
      { href: '/admin/reports/daily', key: 'admin_nav.report_daily', labelBn: 'দৈনিক', labelEn: 'Daily', icon: FileText },
      { href: '/admin/reports/monthly', key: 'admin_nav.report_monthly', labelBn: 'মাসিক', labelEn: 'Monthly', icon: BarChart3 },
    ],
  },
  {
    key: 'planning',
    labelBn: 'পরিকল্পনা',
    labelEn: 'Planning',
    items: [
      { href: '/admin/plan', key: 'admin_nav.plan_90', labelBn: '৯০ দিনের প্ল্যান', labelEn: '90-Day Plan', icon: CalendarCheck },
    ],
  },
  {
    key: 'system',
    labelBn: 'সিস্টেম',
    labelEn: 'System',
    items: [
      { href: '/admin/manual', key: 'admin_nav.manual', labelBn: 'নির্দেশিকা', labelEn: 'Manual', icon: BookOpen },
      { href: '/admin/assistant', key: 'admin_nav.assistant', labelBn: 'সহকারী শেখান', labelEn: 'Teach Assistant', icon: GraduationCap },
      { href: '/admin/settings', key: 'admin_nav.settings', labelBn: 'সেটিংস', labelEn: 'Settings', icon: Settings },
      { href: '/admin/audit', key: 'admin_nav.audit', labelBn: 'অডিট লগ', labelEn: 'Audit Log', icon: ShieldAlert },
    ],
  },
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
          <LogoutButton redirectTo="/admin-login" />
        </div>
      </div>

      {/* Secondary Horizontal Scrollable Navigation */}
      <div className="border-t border-slate-100 bg-slate-50/70 px-2 sm:px-6">
        <nav
          className="mx-auto flex max-w-7xl items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-2 text-xs font-semibold text-slate-600"
          aria-label={lang === 'bn' ? 'অ্যাডমিন নেভিগেশন' : 'Admin navigation'}
        >
          {navGroups.map((group, groupIndex) => (
            <div
              key={group.key}
              className={`flex shrink-0 items-center gap-1 sm:gap-1.5 ${groupIndex > 0 ? 'ml-1 sm:ml-2 border-l border-slate-200 pl-2 sm:pl-3' : ''}`}
            >
              <span className="hidden lg:block shrink-0 whitespace-nowrap pr-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {t(`admin_nav.group_${group.key}`, group.labelBn, group.labelEn)}
              </span>
              {group.items.map((link) => {
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
            </div>
          ))}
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
            {navGroups.map((group) => (
              <div key={group.key} className="pt-2 first:pt-0">
                <div className="px-3.5 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {t(`admin_nav.group_${group.key}`, group.labelBn, group.labelEn)}
                </div>
                {group.items.map((link) => {
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
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
