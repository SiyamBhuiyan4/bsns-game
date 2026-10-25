'use client';

import React from 'react';
import { useLanguage } from '@/components/LanguageContext';
import {
  Users,
  CheckCircle2,
  ShoppingBag,
  MessageSquare,
  Clock,
  LayoutDashboard,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { toBengaliDigits } from '@/lib/formatter';

interface DashboardHeaderStatsProps {
  adminName: string;
  todayStr: string;
  activeEmployeesCount: number;
  postsCompletedCount: number;
  ordersConfirmedCount: number;
  messagesRepliedCount: number;
  periodLabel: string;
  periodKey?: string;
}

export default function DashboardHeaderStats({
  adminName,
  todayStr,
  activeEmployeesCount,
  postsCompletedCount,
  ordersConfirmedCount,
  messagesRepliedCount,
  periodLabel,
  periodKey,
}: DashboardHeaderStatsProps) {
  const { lang, digitStyle, formatNum } = useLanguage();
  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);

  const formatDigits = (val: string | number) => {
    return digitStyle === 'bn' ? toBengaliDigits(val) : String(val);
  };

  // Bilingual period note
  const getPeriodNote = () => {
    if (periodKey === 'today') return L('আজকের হিসাব', 'Today');
    if (periodKey === 'yesterday') return L('গতকালের হিসাব', 'Yesterday');
    if (periodKey === 'last7days') return L('গত ৭ দিনের হিসাব', 'Last 7 Days');
    if (periodKey === 'thisMonth' || periodKey === 'month') return L('চলতি মাসের হিসাব', 'This Month');
    return periodLabel;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<LayoutDashboard className="h-5 w-5" />}
        title={L(`স্বাগতম, ${adminName}`, `Welcome, ${adminName}`)}
        subtitle={L(
          'কর্মী পারফরম্যান্স ও সেকশন কাজের সার্বিক ড্যাশবোর্ড',
          'Employee Performance & Section Overview Dashboard'
        )}
        actions={
          <span className="badge badge-gray py-1 font-mono">
            <Clock className="h-3.5 w-3.5" />
            {L(`ঢাকা: ${formatDigits(todayStr)}`, `Dhaka: ${todayStr}`)}
          </span>
        }
      />

      {/* Core Top Quick Stats bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={L('সক্রিয় কর্মী', 'Active Employees')}
          icon={<Users className="h-4 w-4" />}
          tone="brand"
          value={
            <>
              {formatNum(activeEmployeesCount)}{' '}
              <span className="text-sm font-normal text-slate-500">
                {L('জন কর্মী', 'employees')}
              </span>
            </>
          }
          note={L('দায়িত্বপ্রাপ্ত সক্রিয় কর্মী', 'Assigned active employees')}
        />

        <StatCard
          label={L('পোস্ট সম্পন্ন', 'Posts Completed')}
          tone="violet"
          icon={<CheckCircle2 className="h-4 w-4" />}
          value={
            <>
              {formatNum(postsCompletedCount)}{' '}
              <span className="text-sm font-normal text-slate-500">
                {L('টি', 'posts')}
              </span>
            </>
          }
          note={getPeriodNote()}
        />

        <StatCard
          label={L('কনফার্ম অর্ডার', 'Confirmed Orders')}
          tone="blue"
          icon={<ShoppingBag className="h-4 w-4" />}
          value={
            <>
              {formatNum(ordersConfirmedCount)}{' '}
              <span className="text-sm font-normal text-slate-500">
                {L('টি', 'orders')}
              </span>
            </>
          }
          note={getPeriodNote()}
        />

        <StatCard
          label={L('মেসেজ রিপ্লাই / ফলো-আপ', 'Messages Replied / Follow-ups')}
          tone="amber"
          icon={<MessageSquare className="h-4 w-4" />}
          value={
            <>
              {formatNum(messagesRepliedCount)}{' '}
              <span className="text-sm font-normal text-slate-500">
                {L('টি', 'replies')}
              </span>
            </>
          }
          note={getPeriodNote()}
        />
      </div>
    </div>
  );
}
