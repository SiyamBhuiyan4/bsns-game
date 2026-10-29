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
  Award,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { toBengaliDigits } from '@/lib/formatter';

interface DashboardHeaderStatsProps {
  adminName: string;
  todayStr: string;
  activeEmployeesCount?: number;
  postsCompletedCount: number;
  ordersConfirmedCount: number;
  messagesRepliedCount: number;
  periodLabel: string;
  periodKey?: string;
  isEmployeeView?: boolean;
  employeeScore?: number;
}

export default function DashboardHeaderStats({
  adminName,
  todayStr,
  activeEmployeesCount = 0,
  postsCompletedCount,
  ordersConfirmedCount,
  messagesRepliedCount,
  periodLabel,
  periodKey,
  isEmployeeView,
  employeeScore,
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
        subtitle={
          isEmployeeView
            ? L('আপনার ব্যক্তিগত কাজের অগ্রগতি, টার্গেট ও সেকশন ড্যাশবোর্ড', 'Your personal work progress, targets and section dashboard')
            : L('কর্মী পারফরম্যান্স ও সেকশন কাজের সার্বিক ড্যাশবোর্ড', 'Employee Performance & Section Overview Dashboard')
        }
        actions={
          <span className="badge badge-blue py-1 tabular-nums">
            <Clock className="h-3.5 w-3.5" />
            {L(`ঢাকা: ${formatDigits(todayStr)}`, `Dhaka: ${todayStr}`)}
          </span>
        }
      />

      {/* Core Top Quick Stats bar */}
      <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isEmployeeView ? (
          <StatCard
            label={L('আমার স্কোর', 'My Score')}
            icon={<Award className="h-4 w-4" />}
            tone="brand"
            value={
              <>
                {employeeScore === undefined ? '—' : formatNum(employeeScore)}{' '}
                <span className="text-sm font-normal text-slate-500">
                  / {formatNum(100)}
                </span>
              </>
            }
            note={
              employeeScore === undefined
                ? L('এই সময়ে এখনো কোনো স্কোর নেই', 'No score yet for this period')
                : L('চলতি পারফরম্যান্স রেটিং', 'Current performance rating')
            }
          />
        ) : (
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
        )}

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
