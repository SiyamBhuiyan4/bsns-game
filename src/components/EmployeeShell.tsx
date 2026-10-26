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
import { useLanguage } from '@/components/LanguageContext';

// Merged route alias retained for backward compatibility: '/employee/daily-entry'
export const LEGACY_DAILY_ENTRY_ROUTE = '/employee/daily-entry';



export default function EmployeeShell({ session, children }: { session: { name: string; email: string }; children: ReactNode }) {
  const { L } = useLanguage();
  const navGroups: NavGroup[] = [
    {
      key: 'core',
      labelBn: L('প্রধান মেনু'),
      labelEn: 'Main Menu',
      items: [
        { href: '/employee/dashboard', key: 'emp_nav.dashboard', labelBn: L('ড্যাশবোর্ড'), labelEn: 'Dashboard', icon: BarChart3 },
        { href: '/employee/my-work', key: 'emp_nav.my_work', labelBn: L('আমার কাজ ও দৈনিক এন্ট্রি'), labelEn: 'My Work & Daily Entry', icon: CheckSquare },
        { href: '/employee/leads', key: 'emp_nav.leads', labelBn: L('কাস্টমার ও লিড'), labelEn: 'Clients & Leads', icon: UserPlus },
        { href: '/employee/performance', key: 'emp_nav.performance', labelBn: L('পারফরম্যান্স'), labelEn: 'Performance', icon: TrendingUp },
        { href: '/employee/leaderboard', key: 'emp_nav.leaderboard', labelBn: L('লিডারবোর্ড'), labelEn: 'Leaderboard', icon: Trophy },
        { href: '/employee/plan', key: 'emp_nav.plan', labelBn: L('কর্মপরিকল্পনা'), labelEn: 'Action Plan', icon: CalendarCheck },
      ],
    },
  ];
  return (
    <AppShell
      brandBn={L("মার্কেটার পোর্টাল")}
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
