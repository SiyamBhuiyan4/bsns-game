'use client';

import type { ReactNode } from 'react';
import {
  BarChart3, Users, Layers, Target, FileText, CalendarCheck, Sprout, UserPlus,
  Package, Megaphone, Wallet, ShieldCheck, Settings, BookOpen
} from 'lucide-react';
import AppShell, { type NavGroup } from '@/components/AppShell';
import { useLanguage } from '@/components/LanguageContext';

/*
 * Legacy and secondary routes reference:
 * '/admin/csv/history'
 * '/admin/reports/weekly'
 * '/admin/reports/monthly'
 */

export default function AdminShell({ session, children }: { session: { name: string; email: string }; children: ReactNode }) {
  const { L } = useLanguage();
  const navGroups: NavGroup[] = [
    {
      key: 'core',
      labelBn: L('প্রধান মেনু'),
      labelEn: 'Main Menu',
      items: [
        { href: '/admin/dashboard', key: 'admin_nav.dashboard', labelBn: L('ড্যাশবোর্ড'), labelEn: 'Dashboard', icon: BarChart3 },
        { href: '/admin/employees', key: 'admin_nav.team', labelBn: L('কর্মচারী'), labelEn: 'Employees', icon: Users },
        { href: '/admin/leads', key: 'admin_nav.leads', labelBn: L('কাস্টমার ও লিড'), labelEn: 'Customers & Leads', icon: UserPlus },
        { href: '/admin/sections', key: 'admin_nav.groups', labelBn: L('গ্রুপ ও লিংক'), labelEn: 'Groups & Links', icon: Layers },
        { href: '/admin/targets', key: 'admin_nav.targets', labelBn: L('কাজ ও টার্গেট'), labelEn: 'Tasks & Targets', icon: Target },
        { href: '/admin/reports/daily', key: 'admin_nav.reports', labelBn: L('রিপোর্ট'), labelEn: 'Reports', icon: FileText },
        { href: '/admin/plan', key: 'admin_nav.plan', labelBn: L('কর্মপরিকল্পনা'), labelEn: 'Action Plan', icon: CalendarCheck },
      ],
    },
    {
      key: 'business',
      labelBn: L('ব্যবসা ও প্রচারণা'),
      labelEn: 'Business & Marketing',
      items: [
        { href: '/admin/products', key: 'admin_nav.products', labelBn: L('পণ্য তালিকা'), labelEn: 'Products', icon: Package },
        { href: '/admin/campaigns', key: 'admin_nav.campaigns', labelBn: L('ক্যাম্পেইন'), labelEn: 'Campaigns', icon: Megaphone },
        { href: '/admin/budgets', key: 'admin_nav.budgets', labelBn: L('বাজেট'), labelEn: 'Budgets', icon: Wallet },
      ],
    },
    {
      key: 'system',
      labelBn: L('সিস্টেম ও অ্যাডমিন'),
      labelEn: 'System & Admin',
      items: [
        { href: '/admin/audit', key: 'admin_nav.audit', labelBn: L('অডিট লগ'), labelEn: 'Audit Log', icon: ShieldCheck },
        { href: '/admin/settings', key: 'admin_nav.settings', labelBn: L('সেটিংস'), labelEn: 'Settings', icon: Settings },
        { href: '/admin/manual', key: 'admin_nav.manual', labelBn: L('নির্দেশিকা'), labelEn: 'Manual', icon: BookOpen },
      ],
    },
  ];
  return (
    <AppShell
      brandBn={L("মার্কেটিং প্যানেল")}
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
