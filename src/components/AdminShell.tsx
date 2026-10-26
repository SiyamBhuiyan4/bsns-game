'use client';

import type { ReactNode } from 'react';
import {
  BarChart3, Users, Layers, Target, FileText, CalendarCheck, Sprout, UserPlus,
} from 'lucide-react';
import AppShell, { type NavGroup } from '@/components/AppShell';
import { useLanguage } from '@/components/LanguageContext';

// Restructured clean admin navigation: Dashboard, Employees, Customers, Groups, Target, Reports, Action Plan


/*
 * Legacy routes maintained for system compatibility:
 * '/admin/csv/history'
 * '/admin/products'
 * '/admin/campaigns'
 * '/admin/leads'
 * '/admin/reports/weekly'
 * '/admin/reports/monthly'
 * '/admin/plan'
 * '/admin/audit'
 * '/admin/settings'
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
        { href: '/admin/targets', key: 'admin_nav.targets', labelBn: L('টার্গেট বণ্টন'), labelEn: 'Targets', icon: Target },
        { href: '/admin/reports/daily', key: 'admin_nav.reports', labelBn: L('রিপোর্ট'), labelEn: 'Reports', icon: FileText },
        { href: '/admin/plan', key: 'admin_nav.plan', labelBn: L('কর্মপরিকল্পনা'), labelEn: 'Action Plan', icon: CalendarCheck },
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
