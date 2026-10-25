import { requireAdmin } from '@/lib/session';
import { getAdminDashboardData, DashboardPeriodKey } from '@/lib/dashboard';
import DashboardPeriodSelector from '@/components/dashboard/DashboardPeriodSelector';
import DashboardHeaderStats from '@/components/dashboard/DashboardHeaderStats';
import SectionOverviewCards from '@/components/dashboard/SectionOverviewCards';
import EmployeePerformanceOverview from '@/components/dashboard/EmployeePerformanceOverview';
import PerformancePieCharts from '@/components/dashboard/PerformancePieCharts';

interface PageProps {
  searchParams?: Promise<{
    period?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function AdminDashboardPage(props: PageProps) {
  const admin = await requireAdmin();

  // Next.js 15 searchParams resolution
  const searchParams = props.searchParams ? await props.searchParams : {};
  const rawPeriod = searchParams.period;
  const period = (rawPeriod as DashboardPeriodKey) || 'thisMonth';
  const from = searchParams.from;
  const to = searchParams.to;

  const dashboardData = await getAdminDashboardData({ period, from, to });
  const { periodInfo, summaryCards, sectionsOverview, groupSectionsOverview, employeeWorkSummary, charts } = dashboardData;

  // Extract core quick stats
  const postsDoneItem = sectionsOverview.find((s) => s.key === 'POSTS_DONE');
  const postsCompletedCount = postsDoneItem ? postsDoneItem.totalAchieved : summaryCards.linksCompletedCount;

  const ordersConfirmedItem = sectionsOverview.find((s) => s.key === 'CONFIRMED_ORDERS');
  const ordersConfirmedCount = ordersConfirmedItem ? ordersConfirmedItem.totalAchieved : 0;

  const messagesRepliedItem = sectionsOverview.find((s) => s.key === 'FOLLOWUPS_DONE');
  const messagesRepliedCount = messagesRepliedItem ? messagesRepliedItem.totalAchieved : 0;

  return (
    <div className="space-y-6">
      {/* Dynamic Bilingual Header & Quick Stats Bar */}
      <DashboardHeaderStats
        adminName={admin.name}
        todayStr={periodInfo.todayStr}
        activeEmployeesCount={summaryCards.activeEmployeesCount}
        postsCompletedCount={postsCompletedCount}
        ordersConfirmedCount={ordersConfirmedCount}
        messagesRepliedCount={messagesRepliedCount}
        periodLabel={periodInfo.label}
        periodKey={periodInfo.period}
      />

      {/* Dynamic Bilingual Period selector */}
      <DashboardPeriodSelector currentPeriod={periodInfo.period} currentFrom={from} currentTo={to} />

      {/* 1. Work Sections Performance & Drilldown */}
      <SectionOverviewCards
        sectionsOverview={sectionsOverview}
        groupSectionsOverview={groupSectionsOverview}
      />

      {/* 2. 3D Performance Pie Charts (Overall & for Each Performance / Employee) */}
      <PerformancePieCharts
        employees={employeeWorkSummary}
        teamScoreShare={charts?.teamScoreShare || []}
        sectionsOverview={sectionsOverview}
      />

      {/* 3. Employee Work Performance & Full History */}
      <EmployeePerformanceOverview
        employees={employeeWorkSummary}
        periodLabel={periodInfo.label}
      />
    </div>
  );
}
