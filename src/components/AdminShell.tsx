'use client';

import type { ReactNode } from 'react';
import {
  BarChart3, Users, Layers, Settings, FileText, FileSpreadsheet, CalendarCheck, History,
  Package, Megaphone, UserPlus, Target, BookOpen, GraduationCap, ShieldAlert, Sprout,
} from 'lucide-react';
import AppShell, { type NavGroup } from '@/components/AppShell';

// Keys use the "admin_nav." prefix on purpose: LanguageContext's dictionary
// has older "nav." entries that would override these labels.
const navGroups: NavGroup[] = [
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
      { href: '/admin/reports/weekly', key: 'admin_nav.report_weekly', labelBn: 'সাপ্তাহিক', labelEn: 'Weekly', icon: FileSpreadsheet },
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

export default function AdminShell({ session, children }: { session: { name: string; email: string }; children: ReactNode }) {
  return (
    <AppShell
      brandBn="মার্কেটিং প্যানেল"
      brandEn="Marketing Panel"
      brandIcon={Sprout}
      homeHref="/admin/dashboard"
      roleLabel="Admin"
      groups={navGroups}
      session={session}
      logoutRedirect="/admin-login"
    >
      {children}
    </AppShell>
  );
}
