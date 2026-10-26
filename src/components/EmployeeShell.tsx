'use client';

import type { ReactNode } from 'react';
import {
  BarChart3,
  CheckSquare,
  TrendingUp,
  Trophy,
  FileSpreadsheet,
  UserPlus,
  CalendarCheck,
  Sprout,
} from 'lucide-react';
import AppShell, { type NavGroup } from '@/components/AppShell';

// Merged route alias retained for backward compatibility: '/employee/daily-entry'
export const LEGACY_DAILY_ENTRY_ROUTE = '/employee/daily-entry';

const navGroups: NavGroup[] = [
  {
    key: 'core',
    labelBn: 'প্রধান মেনু',
    labelEn: 'Main Menu',
    items: [
      { href: '/employee/dashboard', key: 'emp_nav.dashboard', labelBn: 'ড্যাশবোর্ড', labelEn: 'Dashboard', icon: BarChart3 },
      { href: '/employee/my-work', key: 'emp_nav.my_work', labelBn: 'আমার কাজ ও দৈনিক এন্ট্রি', labelEn: 'My Work & Daily Entry', icon: CheckSquare },
      { href: '/employee/leads', key: 'emp_nav.leads', labelBn: 'কাস্টমার ও লিড', labelEn: 'Clients & Leads', icon: UserPlus },
      { href: '/employee/performance', key: 'emp_nav.performance', labelBn: 'পারফরম্যান্স', labelEn: 'Performance', icon: TrendingUp },
      { href: '/employee/leaderboard', key: 'emp_nav.leaderboard', labelBn: 'লিডারবোর্ড', labelEn: 'Leaderboard', icon: Trophy },
      { href: '/employee/plan', key: 'emp_nav.plan', labelBn: 'কর্মপরিকল্পনা', labelEn: 'Action Plan', icon: CalendarCheck },
    ],
  },
];

export default function EmployeeShell({ session, children }: { session: { name: string; email: string }; children: ReactNode }) {
  return (
    <AppShell
      brandBn="মার্কেটার পোর্টাল"
      brandEn="Marketer Portal"
      brandIcon={Sprout}
      homeHref="/employee/dashboard"
      roleLabel="Marketer"
      groups={navGroups}
      session={session}
      logoutRedirect="/login"
    >
      {children}
    </AppShell>
  );
}
