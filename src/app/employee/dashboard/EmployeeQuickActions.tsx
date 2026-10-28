'use client';

import Link from 'next/link';
import { ArrowRight, CheckSquare, Trophy, UserPlus, type LucideIcon } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';

type Tone = 'brand' | 'sky' | 'amber';

const CHIP: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-600/10',
  sky: 'bg-sky-50 text-sky-700 ring-sky-600/10',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/10',
};

/** Three shortcuts under the dashboard stats: today's work, leads, leaderboard. */
export default function EmployeeQuickActions() {
  const { L } = useLanguage();

  const items: { href: string; icon: LucideIcon; tone: Tone; title: string; note: string }[] = [
    {
      href: '/employee/my-work',
      icon: CheckSquare,
      tone: 'brand',
      title: L('আজকের কাজ ও দৈনিক এন্ট্রি', "Today's work & daily entry"),
      note: L('পোস্ট, লিংক ও বিক্রির হিসাব', 'Posts, links and sales log'),
    },
    {
      href: '/employee/leads',
      icon: UserPlus,
      tone: 'sky',
      title: L('নতুন কাস্টমার ও লিড', 'New clients & leads'),
      note: L('কাস্টমার যোগ ও ফলোআপ', 'Add customers and follow up'),
    },
    {
      href: '/employee/leaderboard',
      icon: Trophy,
      tone: 'amber',
      title: L('লিডারবোর্ড', 'Leaderboard'),
      note: L('দলে আপনার অবস্থান দেখুন', 'See where you stand in the team'),
    },
  ];

  return (
    <nav aria-label={L('দ্রুত লিংক', 'Shortcuts')} className="stagger grid grid-cols-1 gap-4 md:grid-cols-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="card hover-lift press group flex min-h-[72px] items-center gap-3 p-4"
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform duration-200 group-hover:scale-105 ${CHIP[item.tone]}`}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-900">{item.title}</span>
              <span className="block truncate text-xs text-slate-500">{item.note}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-600" />
          </Link>
        );
      })}
    </nav>
  );
}
