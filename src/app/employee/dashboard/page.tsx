import Link from 'next/link';
import { requireEmployee } from '@/lib/session';
import { getAdminDashboardData, DashboardPeriodKey } from '@/lib/dashboard';
import DashboardPeriodSelector from '@/components/dashboard/DashboardPeriodSelector';
import DashboardHeaderStats from '@/components/dashboard/DashboardHeaderStats';
import SectionOverviewCards from '@/components/dashboard/SectionOverviewCards';
import PerformancePieCharts from '@/components/dashboard/PerformancePieCharts';
import {
  CheckSquare,
  UserPlus,
  FileSpreadsheet,
  ArrowRight,
  Sparkles,
  Swords,
  Trophy,
  Flame,
  Crown,
} from 'lucide-react';

interface PageProps {
  searchParams?: Promise<{
    period?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function EmployeeDashboardPage(props: PageProps) {
  const session = await requireEmployee();

  // Next.js 15 searchParams resolution
  const searchParams = props.searchParams ? await props.searchParams : {};
  const rawPeriod = searchParams.period;
  const period = (rawPeriod as DashboardPeriodKey) || 'thisMonth';
  const from = searchParams.from;
  const to = searchParams.to;

  // Fetch dashboard data scoped to this employee
  const dashboardData = await getAdminDashboardData({
    period,
    from,
    to,
    employeeId: session.userId,
  });

  const {
    periodInfo,
    sectionsOverview,
    groupSectionsOverview,
    employeeWorkSummary,
    charts,
  } = dashboardData;

  // Extract core quick stats for this employee
  const postsDoneItem = sectionsOverview.find((s) => s.key === 'POSTS_DONE');
  const postsCompletedCount = postsDoneItem ? postsDoneItem.totalAchieved : 0;

  const ordersConfirmedItem = sectionsOverview.find((s) => s.key === 'CONFIRMED_ORDERS');
  const ordersConfirmedCount = ordersConfirmedItem ? ordersConfirmedItem.totalAchieved : 0;

  const messagesRepliedItem = sectionsOverview.find((s) => s.key === 'FOLLOWUPS_DONE');
  const messagesRepliedCount = messagesRepliedItem ? messagesRepliedItem.totalAchieved : 0;

  // Employee score from teamScoreShare or employeeWorkSummary
  const myScoreShare = charts?.teamScoreShare?.find((t) => t.employeeId === session.userId);
  const employeeScore = myScoreShare ? myScoreShare.score : undefined;

  return (
    <div className="space-y-6">
      {/* Dynamic Bilingual Header & Quick Stats Bar */}
      <DashboardHeaderStats
        adminName={session.name}
        todayStr={periodInfo.todayStr}
        postsCompletedCount={postsCompletedCount}
        ordersConfirmedCount={ordersConfirmedCount}
        messagesRepliedCount={messagesRepliedCount}
        periodLabel={periodInfo.label}
        periodKey={periodInfo.period}
        isEmployeeView={true}
        employeeScore={employeeScore}
      />

      {/* GAME ARENA BATTLE HUD BANNER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-lg border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-amber-950 font-black text-xl shadow-md ring-2 ring-amber-300">
            <Swords className="w-6 h-6 text-amber-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-wide bg-gradient-to-r from-amber-200 via-white to-indigo-200 bg-clip-text text-transparent">
                বিজনেস গেম এরিনা (Game Arena)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                লাইভ কম্পিটিশন 🔥
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              আজকের মিশন পূরণ করুন, স্কোর বাড়ান এবং লিডারবোর্ডের শীর্ষে পৌঁছান!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 justify-end">
          <Link
            href="/employee/leaderboard"
            className="btn btn-secondary btn-sm gap-1.5 bg-slate-800/80 hover:bg-slate-700 text-amber-300 border-amber-500/40"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>এরিনা লিডারবোর্ড</span>
          </Link>
          <Link
            href="/employee/my-work"
            className="btn btn-primary btn-sm gap-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold shadow-md"
          >
            <CheckSquare className="w-4 h-4" />
            <span>আজকের মিশন ও কাজ</span>
          </Link>
        </div>
      </div>

      {/* Quick Action Shortcuts for Employee */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link
          href="/employee/my-work"
          className="group relative flex items-center justify-between p-4 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 rounded-xl hover:border-emerald-500/60 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-slate-100 group-hover:text-emerald-300 transition-colors">
                আজকের পোস্ট ও টু-ডু মিশন
              </div>
              <div className="text-xs text-slate-400">My Daily Work, Links & Sales</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-emerald-400 transform group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link
          href="/employee/leads"
          className="group relative flex items-center justify-between p-4 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/30 rounded-xl hover:border-blue-500/60 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-slate-100 group-hover:text-blue-300 transition-colors">
                নতুন কাস্টমার ও লিড
              </div>
              <div className="text-xs text-slate-400">Add Customer & Surplus Rollover</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-blue-400 transform group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link
          href="/employee/leaderboard"
          className="group relative flex items-center justify-between p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-xl hover:border-amber-500/60 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-slate-100 group-hover:text-amber-300 transition-colors">
                এরিনা লিডারবোর্ড
              </div>
              <div className="text-xs text-slate-400">Rankings, Podiums & XP</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-amber-400 transform group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* Dynamic Bilingual Period selector */}
      <DashboardPeriodSelector
        currentPeriod={periodInfo.period}
        currentFrom={from}
        currentTo={to}
      />

      {/* 1. Work Sections Performance & Drilldown */}
      <SectionOverviewCards
        sectionsOverview={sectionsOverview}
        groupSectionsOverview={groupSectionsOverview}
      />

      {/* 2. 3D Performance Pie Charts (Overall & Sections Performance) */}
      <PerformancePieCharts
        employees={employeeWorkSummary}
        teamScoreShare={charts?.teamScoreShare || []}
        sectionsOverview={sectionsOverview}
      />
    </div>
  );
}
