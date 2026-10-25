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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-9 w-9 animate-spin text-teal-600" />
        <p className="text-sm font-medium text-slate-600">৯০ দিনের কর্মপরিকল্পনা লোড হচ্ছে...</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-red-500 mb-2" />
        <h3 className="text-base font-bold text-red-800">প্ল্যান ডাটা পাওয়া যায়নি</h3>
        <p className="text-sm text-red-600 mt-1">সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি। অনুগ্রহ করে রিফ্রেশ করুন।</p>
        <button
          onClick={fetchPlanData}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700"
        >
          <RefreshCw className="h-4 w-4" /> পুনরায় চেষ্টা করুন
        </button>
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

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* READ-ONLY BANNER FOR EMPLOYEES */}
      <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4 shadow-sm flex items-start gap-3">
        <Info className="h-5 w-5 text-teal-700 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-teal-900 leading-relaxed">
          <strong className="font-bold">দৃষ্টি আকর্ষণ:</strong> কর্মীদের জন্য এটি পাঠযোগ্য (Read-only) ভিউ। টাস্ক হালনাগাদের জন্য হেড অব মার্কেটিংয়ের সাথে যোগাযোগ করুন।
        </div>
      </div>

      {/* SUMMARY HEADER */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800">
                <CalendarCheck className="h-3.5 w-3.5" />
                ৯০ দিনের কর্মপরিকল্পনা
              </span>

              {/* Current Phase Indicator */}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                <Clock className="h-3.5 w-3.5" />
                দিন {toBengaliDigits(stats?.current_day || 1)} / ৯০ (ফেজ {toBengaliDigits(stats?.current_phase_order || 1)} সক্রিয়)
              </span>

              {/* Overdue Tasks Badge */}
              {stats && stats.overdue_tasks > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                  {toBengaliDigits(stats.overdue_tasks)}টি টাস্ক বিলম্বিত
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
                  কোনো ওভারডিউ টাস্ক নেই
                </span>
              )}
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{plan.name}</h1>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span>
                  শুরুর তারিখ: <strong className="text-slate-700">{format(parseISO(plan.start_date), 'dd MMMM, yyyy')}</strong> ({toBengaliDigits(plan.start_date)})
                </span>
              </div>
            </div>
          </div>

          {/* Overall Progress Box */}
          <div className="w-full lg:w-80 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-teal-600" />
                সার্বিক অগ্রগতি (Overall Progress)
              </span>
              <span className="text-base text-teal-700">{toBengaliDigits(stats?.overall_progress || 0)}%</span>
            </div>
            <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-600 transition-all duration-500"
                style={{ width: `${stats?.overall_progress || 0}%` }}
              ></div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span>মোট টাস্ক: {toBengaliDigits(stats?.total_tasks || 0)}টি</span>
              <span>সম্পন্ন: {toBengaliDigits(stats?.completed_tasks || 0)}টি</span>
            </div>
          </div>
        </div>
      </div>

      {/* PHASE TABS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
              className={`relative flex flex-col text-left rounded-2xl p-4 transition-all border ${
                isCurrentActiveTab
                  ? 'bg-white border-teal-600 shadow-md ring-2 ring-teal-600/20'
                  : 'bg-white/70 border-slate-200 hover:bg-white hover:border-slate-300 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  phase.order_no === 1
                    ? 'bg-blue-100 text-blue-800'
                    : phase.order_no === 2
                    ? 'bg-teal-100 text-teal-800'
                    : 'bg-purple-100 text-purple-800'
                }`}>
                  দিন {toBengaliDigits(phase.day_start)}–{toBengaliDigits(phase.day_end)}
                </span>
                {isSystemCurrentPhase && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-600 animate-ping"></span>
                    চলমান ফেজ
                  </span>
                )}
              </div>

              <div className="mt-2">
                <div className="text-base font-bold text-slate-900">{phase.name_bn}</div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">{phase.name_en}</div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  মোট: <strong>{toBengaliDigits(phaseCompleted)}/{toBengaliDigits(phaseTotal)}</strong>
                  {myTasksInPhase > 0 && (
                    <span className="ml-1 text-teal-700 font-semibold">({toBengaliDigits(myTasksInPhase)}টি আপনার)</span>
                  )}
                </span>
                <span className="font-bold text-teal-700">{toBengaliDigits(phasePct)}% সম্পন্ন</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* PHASE CONTENT */}
      {activePhase && (
        <div className="space-y-6">
          {/* MILESTONE CARD (READ ONLY) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                    <Award className="h-5 w-5" />
                  </span>
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      ফেজ {toBengaliDigits(activePhase.order_no)} মাইলস্টোন
                    </span>
                    <h3 className="text-lg font-bold text-slate-900">
                      {activeMilestone?.title_bn || 'মাইলস্টোন বিবরণ'}
                    </h3>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100 text-xs sm:text-sm space-y-1.5">
                  <div>
                    <span className="font-semibold text-slate-600">প্রত্যাশিত ফলাফল:</span>{' '}
                    <span className="text-slate-800">{activeMilestone?.expected_result}</span>
                  </div>
                  {activeMilestone?.achieved_result && (
                    <div className="pt-1 border-t border-slate-200 text-teal-800">
                      <span className="font-semibold">অর্জিত অগ্রগতি:</span>{' '}
                      <span>{activeMilestone.achieved_result}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Milestone Status Badge */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-slate-500 font-medium">মূল্যায়ন স্ট্যাটাস:</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                    activeMilestone?.status === 'MET'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : activeMilestone?.status === 'PARTIAL'
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : activeMilestone?.status === 'MISSED'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {activeMilestone?.status === 'MET' && 'অর্জিত (Met)'}
                  {activeMilestone?.status === 'PARTIAL' && 'আংশিক অর্জিত (Partial)'}
                  {activeMilestone?.status === 'MISSED' && 'অনর্জিত (Missed)'}
                  {activeMilestone?.status === 'PENDING' && 'অপেক্ষমাণ (Pending)'}
                </span>
              </div>
            </div>
          </div>

          {/* TASKS LIST */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Header & Filter Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-slate-200 bg-slate-50/50">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>{activePhase.name_bn} — টাস্ক তালিকা</span>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {toBengaliDigits(displayTasks.length)}টি
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  ফেজের সকল কর্মপরিকল্পনা ও দায়িত্ব
                </p>
              </div>

              {/* Filter Button */}
              {myAssignedCountInCurrentPhase > 0 && (
                <button
                  onClick={() => setFilterOnlyMyTasks(!filterOnlyMyTasks)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                    filterOnlyMyTasks
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  {filterOnlyMyTasks ? 'সকল টাস্ক দেখুন' : `শুধু আমার দায়িত্ব (${toBengaliDigits(myAssignedCountInCurrentPhase)}টি)`}
                </button>
              )}
            </div>

            {/* Empty State */}
            {displayTasks.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                <h4 className="text-sm font-bold text-slate-700">কোনো টাস্ক পাওয়া যায়নি</h4>
                <p className="text-xs text-slate-500 mt-1">
                  {filterOnlyMyTasks
                    ? 'এই ফেজে আপনার কোনো দায়িত্বপ্রাপ্ত টাস্ক নেই।'
                    : 'এই ফেজে এখনও কোনো টাস্ক যোগ করা হয়নি।'}
                </p>
              </div>
            ) : (
              /* Tasks List */
              <div className="divide-y divide-slate-100">
                {displayTasks.map((task) => {
                  const todayStr = stats?.today || getDhakaDateString();
                  const isOverdue =
                    task.status !== 'DONE' &&
                    task.due_date &&
                    format(new Date(task.due_date), 'yyyy-MM-dd') < todayStr;

                  const isMyTask = task.owner_id === currentUser?.id;

                  return (
                    <div
                      key={task.id}
                      className={`p-5 transition-colors ${
                        isMyTask
                          ? 'bg-teal-50/40 border-l-4 border-l-teal-600'
                          : isOverdue
                          ? 'bg-rose-50/30'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Task Information */}
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Prominent Badge for Assigned Task */}
                            {isMyTask && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-teal-600 text-white px-2.5 py-0.5 text-xs font-bold shadow-xs">
                                <UserCheck className="h-3.5 w-3.5" />
                                আপনার দায়িত্ব (Assigned to You)
                              </span>
                            )}

                            {/* Read-only Status Badge */}
                            <span
                              className={`text-xs font-bold rounded-lg px-2.5 py-0.5 border ${
                                task.status === 'DONE'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : task.status === 'IN_PROGRESS'
                                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                                  : task.status === 'BLOCKED'
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              {task.status === 'DONE' && 'সম্পন্ন (Done)'}
                              {task.status === 'IN_PROGRESS' && 'চলমান (In Progress)'}
                              {task.status === 'NOT_STARTED' && 'শুরু হয়নি (Not Started)'}
                              {task.status === 'BLOCKED' && 'স্থগিত (Blocked)'}
                            </span>

                            {/* Overdue Badge */}
                            {isOverdue && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
                                <AlertTriangle className="h-3 w-3" />
                                বিলম্বিত (Overdue)
                              </span>
                            )}

                            {/* Due Date */}
                            <span className="flex items-center gap-1 text-xs text-slate-500 font-mono">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              {task.due_date ? format(new Date(task.due_date), 'dd MMM, yyyy') : 'তারিখ নেই'}
                            </span>
                          </div>

                          {/* Titles & Description */}
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 leading-snug">
                              {task.title_bn}
                            </h4>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">{task.title_en}</p>
                            {task.description && (
                              <p className="text-xs text-slate-600 mt-1">{task.description}</p>
                            )}
                          </div>

                          {/* Outcome note if present */}
                          {task.outcome_note && (
                            <div className="pt-1 text-xs text-slate-700">
                              <span className="font-semibold text-slate-500">ফলাফল নোট:</span>{' '}
                              <span className="italic bg-slate-100 px-2 py-0.5 rounded-md">
                                &ldquo;{task.outcome_note}&rdquo;
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Read-Only Stats (Owner & Progress) */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-6 shrink-0 pt-2 lg:pt-0">
                          {/* Owner Details */}
                          <div className="text-xs min-w-32">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                              দায়িত্বপ্রাপ্ত
                            </span>
                            <div className="font-semibold text-slate-800">
                              {task.owner ? task.owner.name : <span className="text-slate-400 italic">অবণ্টিত</span>}
                            </div>
                          </div>

                          {/* Progress Indicator */}
                          <div className="w-36">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                              <span>অগ্রগতি</span>
                              <span className="text-teal-700 font-bold">{toBengaliDigits(task.progress_percent)}%</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-teal-600 transition-all duration-300"
                                style={{ width: `${task.progress_percent}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
