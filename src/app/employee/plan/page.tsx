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
  Loader2,
  FileText,
  Filter,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { toBengaliDigits, getDhakaDateString } from '@/lib/date';
import { format, parseISO } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { useLanguage } from '@/components/LanguageContext';

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
  const { lang } = useLanguage();
  const L = (bn: string, en: string) => (lang === 'en' ? en : bn);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [stats, setStats] = useState<PlanStats | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhaseOrder, setActivePhaseOrder] = useState<number>(1);
  const [filterOnlyMyTasks, setFilterOnlyMyTasks] = useState(false);

  const fetchPlanData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/plan');
      if (!res.ok) {
        throw new Error('প্ল্যান ডাটা লোড করা সম্ভব হয়নি');
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlanData();
  }, [fetchPlanData]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        <p className="text-sm text-slate-500">{L('লোড হচ্ছে...', 'Loading...')}</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="card">
        <EmptyState
          icon={<AlertCircle className="h-5 w-5 text-rose-600" />}
          title={L('প্ল্যান পাওয়া যায়নি', 'Plan not found')}
          description={L('সার্ভারে সংযোগ করা যায়নি, আবার চেষ্টা করুন।', 'Could not reach the server, please retry.')}
          action={
            <button onClick={fetchPlanData} className="btn btn-primary">
              <RefreshCw className="h-4 w-4" /> {L('আবার চেষ্টা', 'Retry')}
            </button>
          }
        />
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

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<CalendarCheck className="h-5 w-5" />}
        title={plan.name}
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            {L('শুরু', 'Start')}: {format(parseISO(plan.start_date), 'dd MMMM, yyyy')} ({toBengaliDigits(plan.start_date)})
          </span>
        }
        actions={
          <>
            <span className="badge badge-blue">
              <Clock className="h-3 w-3" />
              দিন {toBengaliDigits(stats?.current_day || 1)} / ৯০ · ফেজ {toBengaliDigits(stats?.current_phase_order || 1)}
            </span>
            {stats && stats.overdue_tasks > 0 ? (
              <span className="badge badge-red">
                <AlertTriangle className="h-3 w-3" />
                {lang === 'en' ? `${stats.overdue_tasks} overdue` : `${toBengaliDigits(stats.overdue_tasks)}টি বিলম্বিত`}
              </span>
            ) : (
              <span className="badge badge-gray">
                <CheckCircle2 className="h-3 w-3" />
                {L('কোনো ওভারডিউ নেই', 'None overdue')}
              </span>
            )}
          </>
        }
      />

      <div className="alert alert-info">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {L('শুধু দেখার জন্য; টাস্ক বদলাতে হেড অব মার্কেটিংয়ের সাথে যোগাযোগ করুন।', 'Read-only — contact the Head of Marketing to update tasks.')}
        </span>
      </div>

      {/* Overall progress */}
      <div className="card card-body">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 font-medium text-slate-700">
            <TrendingUp className="h-4 w-4 text-slate-400" />
            {L('সার্বিক অগ্রগতি', 'Overall progress')}
          </span>
          <span className="text-lg font-semibold text-brand-700 tabular-nums">
            {toBengaliDigits(stats?.overall_progress || 0)}%
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-500"
            style={{ width: `${stats?.overall_progress || 0}%` }}
          ></div>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span>{L('মোট টাস্ক', 'Total')}: {toBengaliDigits(stats?.total_tasks || 0)}</span>
          <span>{L('সম্পন্ন', 'Done')}: {toBengaliDigits(stats?.completed_tasks || 0)}</span>
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
              className={`card flex flex-col p-4 text-left transition-colors ${
                isCurrentActiveTab ? 'border-brand-600 ring-2 ring-brand-600/15' : 'hover:border-slate-300'
              }`}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="badge badge-gray">
                  দিন {toBengaliDigits(phase.day_start)}–{toBengaliDigits(phase.day_end)}
                </span>
                {isSystemCurrentPhase && (
                  <span className="badge badge-green">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-600"></span>
                    {L('চলমান', 'Current')}
                  </span>
                )}
              </div>

              <div className="mt-3">
                <div className="text-[15px] font-semibold text-slate-900">{phase.name_bn}</div>
                <div className="mt-0.5 text-xs text-slate-500">{phase.name_en}</div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                <span className="text-slate-500">
                  <span className="font-medium text-slate-700 tabular-nums">
                    {toBengaliDigits(phaseCompleted)}/{toBengaliDigits(phaseTotal)}
                  </span>
                  {myTasksInPhase > 0 && (
                    <span className="ml-1 text-brand-700">({toBengaliDigits(myTasksInPhase)}টি আপনার)</span>
                  )}
                </span>
                <span className="font-medium text-brand-700 tabular-nums">{toBengaliDigits(phasePct)}%</span>
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
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                  <Award className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="card-subtitle">{L('ফেজ', 'Phase')} {toBengaliDigits(activePhase.order_no)} {L('মাইলস্টোন', 'Milestone')}</p>
                  <h3 className="card-title">{activeMilestone?.title_bn || 'মাইলস্টোন বিবরণ'}</h3>
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
                <div className="text-xs font-medium text-slate-500">{L('প্রত্যাশিত ফলাফল', 'Expected')}</div>
                <div className="mt-0.5 text-slate-800">{activeMilestone?.expected_result}</div>
              </div>
              {activeMilestone?.achieved_result && (
                <div className="border-t border-slate-100 pt-3">
                  <div className="text-xs font-medium text-slate-500">{L('অর্জিত অগ্রগতি', 'Achieved')}</div>
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
                  <span className="truncate">{activePhase.name_bn} · টাস্ক</span>
                  <span className="badge badge-gray tabular-nums">{toBengaliDigits(displayTasks.length)}</span>
                </h2>
                <p className="card-subtitle">{L('এই ফেজের কাজ ও দায়িত্ব', 'Tasks in this phase')}</p>
              </div>

              {myAssignedCountInCurrentPhase > 0 && (
                <button
                  onClick={() => setFilterOnlyMyTasks(!filterOnlyMyTasks)}
                  aria-pressed={filterOnlyMyTasks}
                  className={`btn btn-sm ${filterOnlyMyTasks ? 'btn-primary' : 'btn-secondary'}`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  {filterOnlyMyTasks
                    ? L('সকল টাস্ক', 'All tasks')
                    : `${L('শুধু আমার', 'Mine')} (${toBengaliDigits(myAssignedCountInCurrentPhase)})`}
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
                  const isOverdue =
                    task.status !== 'DONE' &&
                    task.due_date &&
                    format(new Date(task.due_date), 'yyyy-MM-dd') < todayStr;

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
                              {task.due_date ? format(new Date(task.due_date), 'dd MMM, yyyy') : 'তারিখ নেই'}
                            </span>
                          </div>

                          <div>
                            <h4 className="text-sm font-medium leading-snug text-slate-900">{task.title_bn}</h4>
                            <p className="mt-0.5 text-xs text-slate-500">{task.title_en}</p>
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
                            <div className="truncate font-medium text-slate-800">
                              {task.owner ? task.owner.name : <span className="italic text-slate-400">অবণ্টিত</span>}
                            </div>
                          </div>

                          <div className="sm:w-36">
                            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                              <span>অগ্রগতি</span>
                              <span className="font-medium text-brand-700 tabular-nums">
                                {toBengaliDigits(task.progress_percent)}%
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
