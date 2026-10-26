'use client';

import type { ReactNode } from 'react';
import {
  BarChart3, Users, Layers, Target, FileText, CalendarCheck, Sprout,
} from 'lucide-react';
import AppShell, { type NavGroup } from '@/components/AppShell';

// Restructured clean admin navigation: Dashboard, Employees, Groups, Target, Reports, Action Plan
const navGroups: NavGroup[] = [
  {
    key: 'core',
    labelBn: 'প্রধান মেনু',
    labelEn: 'Main Menu',
    items: [
      { href: '/admin/dashboard', key: 'admin_nav.dashboard', labelBn: 'ড্যাশবোর্ড', labelEn: 'Dashboard', icon: BarChart3 },
      { href: '/admin/employees', key: 'admin_nav.team', labelBn: 'কর্মচারী (টিম)', labelEn: 'Employees', icon: Users },
      { href: '/admin/sections', key: 'admin_nav.groups', labelBn: 'গ্রুপ ও লিংক', labelEn: 'Groups & Links', icon: Layers },
      { href: '/admin/targets', key: 'admin_nav.targets', labelBn: 'টার্গেট বণ্টন', labelEn: 'Targets', icon: Target },
      { href: '/admin/reports/daily', key: 'admin_nav.reports', labelBn: 'রিপোর্ট', labelEn: 'Reports', icon: FileText },
      { href: '/admin/plan', key: 'admin_nav.plan', labelBn: 'কর্মপরিকল্পনা', labelEn: 'Action Plan', icon: CalendarCheck },
    ],
  },
];

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
