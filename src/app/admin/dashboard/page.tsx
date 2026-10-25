import { requireAdmin } from '@/lib/session';
import { getAdminDashboardData, DashboardPeriodKey } from '@/lib/dashboard';
import DashboardPeriodSelector from '@/components/dashboard/DashboardPeriodSelector';
import SectionOverviewCards from '@/components/dashboard/SectionOverviewCards';
import EmployeePerformanceOverview from '@/components/dashboard/EmployeePerformanceOverview';
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
import { toBengaliDigits } from '@/lib/date';

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
  const { periodInfo, summaryCards, sectionsOverview, groupSectionsOverview, employeeWorkSummary } = dashboardData;

  // Extract core quick stats
  const postsDoneItem = sectionsOverview.find((s) => s.key === 'POSTS_DONE');
  const postsCompletedCount = postsDoneItem ? postsDoneItem.totalAchieved : summaryCards.linksCompletedCount;

  const ordersConfirmedItem = sectionsOverview.find((s) => s.key === 'ORDERS_CONFIRMED');
  const ordersConfirmedCount = ordersConfirmedItem ? ordersConfirmedItem.totalAchieved : 0;

  const messagesRepliedItem = sectionsOverview.find((s) => s.key === 'MESSAGES_REPLIED');
  const messagesRepliedCount = messagesRepliedItem ? messagesRepliedItem.totalAchieved : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<LayoutDashboard className="h-5 w-5" />}
        title={`স্বাগতম, ${admin.name}`}
        subtitle="কর্মী পারফরম্যান্স ও সেকশন কাজের সার্বিক ড্যাশবোর্ড"
        actions={
          <span className="badge badge-gray py-1 font-mono">
            <Clock className="h-3.5 w-3.5" />
            ঢাকা: {toBengaliDigits(periodInfo.todayStr)}
          </span>
        }
      />

      {/* Period selector */}
      <DashboardPeriodSelector currentPeriod={periodInfo.period} currentFrom={from} currentTo={to} />

      {/* Core Top Quick Stats bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="সক্রিয় কর্মী"
          icon={<Users className="h-4 w-4" />}
          tone="brand"
          value={
            <>
              {toBengaliDigits(summaryCards.activeEmployeesCount)}{' '}
              <span className="text-sm font-normal text-slate-500">জন</span>
            </>
          }
          note="দায়িত্বপ্রাপ্ত সক্রিয় কর্মী"
        />
        <StatCard
          label="পোস্ট সম্পন্ন"
          tone="violet"
          icon={<CheckCircle2 className="h-4 w-4" />}
          value={
            <>
              {toBengaliDigits(postsCompletedCount)}{' '}
              <span className="text-sm font-normal text-slate-500">টি</span>
            </>
          }
          note={
            <span className="block truncate" title={periodInfo.label}>
              {periodInfo.label}
            </span>
          }
        />
        <StatCard
          label="কনফার্ম অর্ডার"
          tone="blue"
          icon={<ShoppingBag className="h-4 w-4" />}
          value={
            <>
              {toBengaliDigits(ordersConfirmedCount)}{' '}
              <span className="text-sm font-normal text-slate-500">টি</span>
            </>
          }
          note={
            <span className="block truncate" title={periodInfo.label}>
              {periodInfo.label}
            </span>
          }
        />
        <StatCard
          label="মেসেজ রিপ্লাই / ফলো-আপ"
          tone="amber"
          icon={<MessageSquare className="h-4 w-4" />}
          value={
            <>
              {toBengaliDigits(messagesRepliedCount)}{' '}
              <span className="text-sm font-normal text-slate-500">টি</span>
            </>
          }
          note={
            <span className="block truncate" title={periodInfo.label}>
              {periodInfo.label}
            </span>
          }
        />
      </div>

      {/* Section Performance & Deep Dive */}
      <SectionOverviewCards
        sectionsOverview={sectionsOverview}
        groupSectionsOverview={groupSectionsOverview}
      />

      {/* Employee Performance & Full History */}
      <EmployeePerformanceOverview
        employees={employeeWorkSummary}
        periodLabel={periodInfo.label}
      />
    </div>
  );
}
