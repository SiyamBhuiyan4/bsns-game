'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CalendarCheck,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Award,
  TrendingUp,
  UserCheck,
  Info,
  FileText,
  Filter,
  ListChecks,
} from 'lucide-react';
import { toBengaliDigits, getDhakaDateString, formatDisplayDate } from '@/lib/date';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import StatCard from '@/components/ui/StatCard';
import Avatar from '@/components/ui/Avatar';
import { useLanguage } from '@/components/LanguageContext';
import { Skeleton, SkeletonStatCards } from '@/components/ui/Skeleton';

interface Owner {
  id: string;
  name: string;
  email: string;
}

interface PlanTask {
  id: string;
  plan_id: string;
  phase_id: string;
  title_bn: string;
  title_en: string;
  description: string | null;
  owner_id: string | null;
  due_date: string | null;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';
  progress_percent: number;
  outcome_note: string | null;
  created_at: string;
  updated_at: string;
  owner: Owner | null;
}

interface PlanMilestone {
  id: string;
  plan_id: string;
  phase_id: string;
  title_bn: string;
  expected_result: string;
  achieved_result: string | null;
  status: 'PENDING' | 'MET' | 'PARTIAL' | 'MISSED';
  reviewed_at: string | null;
}

interface PlanPhase {
  id: string;
  plan_id: string;
  name_bn: string;
  name_en: string;
  day_start: number;
  day_end: number;
  order_no: number;
  tasks: PlanTask[];
  milestones: PlanMilestone[];
}

interface PlanData {
  id: string;
  name: string;
  start_date: string;
  status: string;
  created_at: string;
  phases: PlanPhase[];
}

interface PlanStats {
  overall_progress: number;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  current_day: number;
  current_phase_order: number;
  today: string;
}

interface CurrentUser {
  id: string;
  name: string;
  role: string;
  email: string;
}

export default function EmployeePlanPage() {
  const { lang, L } = useLanguage();
  const isEn = lang === 'en';
  const fmtNum = (val: number | string | undefined | null) => {
    if (val === undefined || val === null) return '';
    return isEn ? String(val) : toBengaliDigits(val);
  };
  const getCleanPlanTitle = (name: string) => {
    if (!name) return isEn ? 'Marketing Action Plan' : L('মার্কেটিং কর্মপরিকল্পনা');
    const match = name.match(/^(.*?)\s*\((.*?)\)$/);
    if (match) {
      return isEn ? match[2].trim() : match[1].trim();
    }
    return name;
  };
  const formatPhaseTitle = (title: string) => {
    if (!title) return '';
    // Format "৩১–৬০" as "৩১ – ৬০" with clean spacing so the digit '১' does not collide with the dash
    return title.replace(/(\d|[\u09E6-\u09EF])\s*[–—-]\s*(\d|[\u09E6-\u09EF])/g, '$1 – $2');
  };
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [stats, setStats] = useState<PlanStats | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activePhaseOrder, setActivePhaseOrder] = useState<number>(1);
  const [filterOnlyMyTasks, setFilterOnlyMyTasks] = useState(false);

  const fetchPlanData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await fetch('/api/plan');
      if (!res.ok) {
        throw new Error(L('প্ল্যান ডাটা লোড করা সম্ভব হয়নি'));
      }
      const data = await res.json();
      setPlan(data.plan);
      setStats(data.stats);
      setCurrentUser(data.currentUser);
      if (data.stats?.current_phase_order) {
        setActivePhaseOrder(data.stats.current_phase_order);
      }
    } catch (err) {
      console.error(err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchPlanData();
  }, [fetchPlanData]);

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-busy="true">
        <span className="sr-only">{L('লোড হচ্ছে...', 'Loading...')}</span>
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3.5 w-64" />
          </div>
        </div>
        <SkeletonStatCards count={4} />
        <div className="card space-y-3 p-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={<CalendarCheck className="h-5 w-5" />}
          title={L('কর্মপরিকল্পনা', 'Action Plan')}
          subtitle={L('দলের ধাপে ধাপে কাজের পরিকল্পনা', "The team's phase-by-phase work plan")}
        />
        <div className="card">
          {loadError ? (
            <ErrorState
              title={L('প্ল্যান লোড করা যায়নি', 'Could not load the plan')}
              onRetry={fetchPlanData}
            />
          ) : (
            <EmptyState
              icon={<CalendarCheck className="h-5 w-5" />}
              title={L('এখনো কোনো প্ল্যান চালু হয়নি', 'No plan has been started yet')}
              description={L(
                'হেড অব মার্কেটিং প্ল্যান চালু করলে আপনার কাজ ও মাইলস্টোন এখানে দেখা যাবে।',
                'Once the Head of Marketing starts a plan, your tasks and milestones will appear here.'
              )}
            />
          )}
        </div>
      </div>
    );
  }

  const activePhase = plan.phases.find((p) => p.order_no === activePhaseOrder) || plan.phases[0];
  const activeMilestone = activePhase?.milestones[0];
  const allPhaseTasks = activePhase?.tasks || [];

  const displayTasks = filterOnlyMyTasks
    ? allPhaseTasks.filter((t) => t.owner_id === currentUser?.id)
    : allPhaseTasks;

  const myAssignedCountInCurrentPhase = allPhaseTasks.filter(
    (t) => t.owner_id === currentUser?.id
  ).length;

  const milestoneBadge =
    activeMilestone?.status === 'MET'
      ? 'badge-green'
      : activeMilestone?.status === 'PARTIAL'
      ? 'badge-blue'
      : activeMilestone?.status === 'MISSED'
      ? 'badge-red'
      : 'badge-amber';

  const taskBadge = (s: PlanTask['status']) =>
    s === 'DONE' ? 'badge-green' : s === 'IN_PROGRESS' ? 'badge-blue' : s === 'BLOCKED' ? 'badge-red' : 'badge-gray';

  const totalPlanDays = plan.phases.reduce((max, p) => Math.max(max, p.day_end), 90);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<CalendarCheck className="h-5 w-5" />}
        title={getCleanPlanTitle(plan.name)}
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            {isEn ? 'Start' : L('শুরু')}: {formatDisplayDate(plan.start_date, lang)}
          </span>
        }
        actions={
          <>
            <span className="badge badge-blue">
              <Clock className="h-3 w-3" />
              {isEn
                ? `Day ${stats?.current_day || 1} / ${totalPlanDays} · Phase ${stats?.current_phase_order || 1}`
                : L(`দিন ${fmtNum(stats?.current_day || 1)} / ${fmtNum(totalPlanDays)} · ফেজ ${fmtNum(stats?.current_phase_order || 1)}`)}
            </span>
            {stats && stats.overdue_tasks > 0 ? (
              <span className="badge badge-red">
                <AlertTriangle className="h-3 w-3" />
                {isEn ? `${stats.overdue_tasks} overdue` : L(`${fmtNum(stats.overdue_tasks)}টি বিলম্বিত`)}
              </span>
            ) : (
              <span className="badge badge-green">
                <CheckCircle2 className="h-3 w-3" />
                {L('কোনো ওভারডিউ নেই', 'None overdue')}
              </span>
            )}
          </>
        }
      />

      {/* Admin's guidance and the current phase goal */}
      <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-start gap-3">
          <span className="icon-tile icon-tile-violet h-10 w-10">
            <Award className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-violet-700">
                {L('অ্যাডমিনের দিকনির্দেশনা ও লক্ষ্য', "Admin's guidance & phase goal")}
              </span>
              <span className="badge badge-violet">
                {formatPhaseTitle(isEn ? (activePhase?.name_en || activePhase?.name_bn) : activePhase?.name_bn)}
              </span>
            </div>
            <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-900">
              {activeMilestone?.expected_result ||
                L(
                  'নির্ধারিত সময়সীমার মধ্যে সকল টাস্ক সম্পন্ন করে ব্যবসার বেসলাইন ও লক্ষ্য অর্জন করুন।',
                  'Complete all assigned milestone tasks within deadline to achieve the targeted business growth.'
                )}
            </p>
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {L(
                  'শুধু কর্মীদের দেখার জন্য; টাস্ক পরিবর্তনের জন্য হেড অব মার্কেটিংয়ের সাথে যোগাযোগ করুন।',
                  'Read-only view for employees. Contact Head of Marketing for task re-assignments.'
                )}
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* Key numbers */}
      <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={L('সার্বিক অগ্রগতি', 'Overall progress')}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="brand"
          value={`${fmtNum(stats?.overall_progress || 0)}%`}
        />
        <StatCard
          label={L('মোট টাস্ক', 'Total tasks')}
          icon={<ListChecks className="h-4 w-4" />}
          tone="blue"
          value={fmtNum(stats?.total_tasks || 0)}
        />
        <StatCard
          label={L('সম্পন্ন', 'Completed')}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="violet"
          value={fmtNum(stats?.completed_tasks || 0)}
        />
        <StatCard
          label={L('বিলম্বিত', 'Overdue')}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={stats && stats.overdue_tasks > 0 ? 'red' : 'amber'}
          value={fmtNum(stats?.overdue_tasks || 0)}
        />
      </div>

      {/* Overall progress */}
      <div className="card card-body">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 font-medium text-slate-700">
            <TrendingUp className="h-4 w-4 text-brand-600" />
            {L('সার্বিক অগ্রগতি', 'Overall Progress')}
          </span>
          <span className="text-lg font-semibold text-brand-700 tabular-nums">
            {fmtNum(stats?.overall_progress || 0)}%
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-500"
            style={{ width: `${stats?.overall_progress || 0}%` }}
          ></div>
        </div>
      </div>

      {/* Phase tabs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {plan.phases.map((phase) => {
          const isCurrentActiveTab = activePhaseOrder === phase.order_no;
          const isSystemCurrentPhase = stats?.current_phase_order === phase.order_no;
          const phaseTasks = phase.tasks || [];
          const phaseCompleted = phaseTasks.filter((t) => t.status === 'DONE').length;
          const phaseTotal = phaseTasks.length;
          const phasePct = phaseTotal > 0 ? Math.round((phaseTasks.reduce((s, t) => s + t.progress_percent, 0) / phaseTotal)) : 0;
          const myTasksInPhase = phaseTasks.filter((t) => t.owner_id === currentUser?.id).length;

          return (
            <button
              key={phase.id}
              onClick={() => setActivePhaseOrder(phase.order_no)}
              aria-pressed={isCurrentActiveTab}
              className={`card press flex flex-col p-4 text-left transition-colors ${
                isCurrentActiveTab ? 'border-brand-600 ring-2 ring-brand-600/15' : 'hover:border-slate-300'
              }`}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="badge badge-blue font-medium tabular-nums">
                  {isEn
                    ? `Days ${phase.day_start} – ${phase.day_end}`
                    : L(`দিন ${fmtNum(phase.day_start)} – ${fmtNum(phase.day_end)}`)}
                </span>
                {isSystemCurrentPhase && (
                  <span className="badge badge-green">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-600"></span>
                    {L('চলমান', 'Current')}
                  </span>
                )}
              </div>

              <div className="mt-3">
                <div className="text-[15px] font-semibold text-slate-900 leading-snug">
                  {formatPhaseTitle(isEn ? (phase.name_en || phase.name_bn) : phase.name_bn)}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                <span className="text-slate-500">
                  <span className="font-medium text-slate-700 tabular-nums">
                    {fmtNum(phaseCompleted)}/{fmtNum(phaseTotal)}
                  </span>
                  {myTasksInPhase > 0 && (
                    <span className="ml-1 text-brand-700">
                      ({isEn ? `${myTasksInPhase} yours` : L(`${fmtNum(myTasksInPhase)}টি আপনার`)})
                    </span>
                  )}
                </span>
                <span className="font-medium text-brand-700 tabular-nums">{fmtNum(phasePct)}%</span>
              </div>
            </button>
          );
        })}
      </div>

      {activePhase && (
        <div className="space-y-6">
          {/* Milestone */}
          <div className="card">
            <div className="card-header">
              <div className="flex min-w-0 items-center gap-3">
                <span className="icon-tile icon-tile-amber">
                  <Award className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="card-subtitle">{L('ফেজ', 'Phase')} {fmtNum(activePhase.order_no)} {L('মাইলস্টোন', 'Milestone')}</p>
                  <h3 className="card-title">{activeMilestone?.title_bn || L('মাইলস্টোন বিবরণ', 'Milestone Details')}</h3>
                </div>
              </div>
              <span className={`badge ${milestoneBadge}`}>
                {activeMilestone?.status === 'MET' && L('অর্জিত', 'Met')}
                {activeMilestone?.status === 'PARTIAL' && L('আংশিক', 'Partial')}
                {activeMilestone?.status === 'MISSED' && L('অনর্জিত', 'Missed')}
                {activeMilestone?.status === 'PENDING' && L('অপেক্ষমাণ', 'Pending')}
              </span>
            </div>
            <div className="card-body space-y-3 text-sm">
              <div>
                <div className="text-xs font-medium text-slate-500">{L('প্রত্যাশিত ফলাফল', 'Expected Result')}</div>
                <div className="mt-0.5 text-slate-800">
                  {activeMilestone?.expected_result || L('এখনো যোগ করা হয়নি', 'Not added yet')}
                </div>
              </div>
              {activeMilestone?.achieved_result && (
                <div className="border-t border-slate-100 pt-3">
                  <div className="text-xs font-medium text-slate-500">{L('অর্জিত ফলাফল', 'Achieved Result')}</div>
                  <div className="mt-0.5 text-slate-800">{activeMilestone.achieved_result}</div>
                </div>
              )}
            </div>
          </div>

          {/* Tasks */}
          <div className="card overflow-hidden">
            <div className="card-header">
              <div className="min-w-0">
                <h2 className="card-title flex items-center gap-2">
                  <span className="truncate">
                    {formatPhaseTitle(isEn ? (activePhase.name_en || activePhase.name_bn) : activePhase.name_bn)} · {L('টাস্ক', 'Tasks')}
                  </span>
                  <span className="badge badge-violet tabular-nums">{fmtNum(displayTasks.length)}</span>
                </h2>
                <p className="card-subtitle">{L('এই ফেজের কাজ ও দায়িত্ব', 'Tasks in this phase')}</p>
              </div>

              {myAssignedCountInCurrentPhase > 0 && (
                <button
                  onClick={() => setFilterOnlyMyTasks(!filterOnlyMyTasks)}
                  aria-pressed={filterOnlyMyTasks}
                  className={`btn btn-sm min-h-9 ${filterOnlyMyTasks ? 'btn-primary' : 'btn-secondary'}`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  {filterOnlyMyTasks
                    ? L('সকল টাস্ক', 'All Tasks')
                    : `${L('শুধু আমার', 'Mine')} (${fmtNum(myAssignedCountInCurrentPhase)})`}
                </button>
              )}
            </div>

            {displayTasks.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-5 w-5" />}
                title={L('কোনো টাস্ক নেই', 'No tasks')}
                description={
                  filterOnlyMyTasks
                    ? L('এই ফেজে আপনার কোনো টাস্ক নেই', 'No tasks assigned to you here')
                    : L('এই ফেজে এখনও টাস্ক যোগ হয়নি', 'No tasks added yet')
                }
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {displayTasks.map((task) => {
                  const todayStr = stats?.today || getDhakaDateString();
                  const due = task.due_date ? new Date(task.due_date) : null;
                  const isOverdue =
                    task.status !== 'DONE' && due && !Number.isNaN(due.getTime()) && format(due, 'yyyy-MM-dd') < todayStr;

                  const isMyTask = task.owner_id === currentUser?.id;

                  return (
                    <li
                      key={task.id}
                      className={`px-4 py-4 sm:px-5 ${
                        isMyTask
                          ? 'bg-brand-50/50 shadow-[inset_3px_0_0_var(--color-brand-600)]'
                          : isOverdue
                          ? 'bg-rose-50/40'
                          : ''
                      }`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {isMyTask && (
                              <span className="badge badge-green">
                                <UserCheck className="h-3 w-3" />
                                {L('আপনার', 'Yours')}
                              </span>
                            )}
                            <span className={`badge ${taskBadge(task.status)}`}>
                              {task.status === 'DONE' && L('সম্পন্ন', 'Done')}
                              {task.status === 'IN_PROGRESS' && L('চলমান', 'In progress')}
                              {task.status === 'NOT_STARTED' && L('শুরু হয়নি', 'Not started')}
                              {task.status === 'BLOCKED' && L('স্থগিত', 'Blocked')}
                            </span>
                            {isOverdue && (
                              <span className="badge badge-red">
                                <AlertTriangle className="h-3 w-3" />
                                {L('বিলম্বিত', 'Overdue')}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500 tabular-nums">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              {task.due_date ? formatDisplayDate(task.due_date, lang) : L('তারিখ নেই', 'No date')}
                            </span>
                          </div>

                          <div>
                            <h4 className="text-sm font-medium leading-snug text-slate-900">
                              {isEn ? (task.title_en || task.title_bn) : task.title_bn}
                            </h4>
                            {task.description && <p className="mt-1 text-sm text-slate-600">{task.description}</p>}
                          </div>

                          {task.outcome_note && (
                            <p className="text-xs text-slate-600">
                              <span className="font-medium text-slate-500">{L('ফলাফল', 'Outcome')}:</span>{' '}
                              <span className="italic">&ldquo;{task.outcome_note}&rdquo;</span>
                            </p>
                          )}
                        </div>

                        <div className="grid shrink-0 grid-cols-2 gap-4 sm:flex sm:items-center sm:gap-6">
                          <div className="min-w-0 text-xs sm:min-w-32">
                            <span className="mb-0.5 block text-[11px] text-slate-500">{L('দায়িত্বপ্রাপ্ত', 'Owner')}</span>
                            {task.owner ? (
                              <div className="flex min-w-0 items-center gap-2">
                                <Avatar name={task.owner.name} size={26} animated={false} />
                                <span className="truncate font-medium text-slate-800">{task.owner.name}</span>
                              </div>
                            ) : (
                              <span className="italic text-slate-400">{L('অবণ্টিত', 'Unassigned')}</span>
                            )}
                          </div>

                          <div className="sm:w-36">
                            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                              <span>{L('অগ্রগতি', 'Progress')}</span>
                              <span className="font-medium text-brand-700 tabular-nums">
                                {fmtNum(task.progress_percent)}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-brand-600 transition-all duration-300"
                                style={{ width: `${task.progress_percent}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
