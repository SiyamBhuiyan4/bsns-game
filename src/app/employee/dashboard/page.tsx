import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getAdminDashboardData, DashboardPeriodKey } from '@/lib/dashboard';
import DashboardPeriodSelector from '@/components/dashboard/DashboardPeriodSelector';
import DashboardHeaderStats from '@/components/dashboard/DashboardHeaderStats';
import SectionOverviewCards from '@/components/dashboard/SectionOverviewCards';
import PerformancePieCharts from '@/components/dashboard/PerformancePieCharts';
import EmployeeQuickActions from './EmployeeQuickActions';

interface PageProps {
  searchParams?: Promise<{
    period?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function EmployeeDashboardPage(props: PageProps) {
  const session = await getSession();
  if (!session || session.role !== 'EMPLOYEE') redirect('/api/auth/logout');

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

      {/* Shortcuts to the three things a marketer does every day */}
      <EmployeeQuickActions />

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
