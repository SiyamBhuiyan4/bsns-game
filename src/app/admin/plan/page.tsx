'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CalendarCheck,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Edit2,
  Trash2,
  Award,
  TrendingUp,
  X,
  FileText,
  AlertCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
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

function getErrorMessage(err: unknown, fallback: string = 'ত্রুটি ঘটেছে'): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
}

export default function AdminPlanPage() {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [stats, setStats] = useState<PlanStats | null>(null);
  const [employees, setEmployees] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPhases, setExpandedPhases] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit Plan Details State
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [planNameInput, setPlanNameInput] = useState('');
  const [startDateInput, setStartDateInput] = useState('');

  // Milestone Review Modal State
  const [evaluatingMilestone, setEvaluatingMilestone] = useState<PlanMilestone | null>(null);
  const [milestoneStatus, setMilestoneStatus] = useState<'PENDING' | 'MET' | 'PARTIAL' | 'MISSED'>('PENDING');
  const [milestoneResultNote, setMilestoneResultNote] = useState('');

  // Add Task Modal State
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [selectedPhaseIdForAdd, setSelectedPhaseIdForAdd] = useState<string>('');
  const [taskForm, setTaskForm] = useState({
    title_bn: '',
    title_en: '',
    description: '',
    owner_id: '',
    due_date: '',
    progress_percent: 0,
    status: 'NOT_STARTED' as 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED',
  });

  // Edit Task Modal State
  const [editingTask, setEditingTask] = useState<PlanTask | null>(null);

  // Inline outcome note edit state
  const [editingOutcomeId, setEditingOutcomeId] = useState<string | null>(null);
  const [outcomeDraft, setOutcomeDraft] = useState('');

  // Task delete confirm
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const togglePhaseCollapse = (orderNo: number) => {
    setExpandedPhases((prev) => ({
      ...prev,
      [orderNo]: !prev[orderNo],
    }));
  };

  const expandAllPhases = () => {
    setExpandedPhases({ 1: true, 2: true, 3: true });
  };

  const collapseAllPhases = () => {
    setExpandedPhases({ 1: false, 2: false, 3: false });
  };

  const fetchPlanData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/plan');
      if (!res.ok) {
        throw new Error('প্ল্যান ডাটা লোড করতে ব্যর্থ হয়েছে');
      }
      const data = await res.json();
      setPlan(data.plan);
      setStats(data.stats);
      setEmployees(data.employees || []);
      setPlanNameInput(data.plan.name);
      setStartDateInput(data.plan.start_date);
      if (data.stats?.current_phase_order) {
        setExpandedPhases((prev) => ({
          ...prev,
          [data.stats.current_phase_order]: true,
        }));
      }
    } catch (err: unknown) {
      showToast('error', getErrorMessage(err, 'ডাটাবেস কানেকশনে সমস্যা হয়েছে'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlanData();
  }, [fetchPlanData]);

  // Handle Plan Header Edit
  const handleUpdatePlanHeader = async () => {
    if (!plan) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/plan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: planNameInput.trim(),
          start_date: startDateInput,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'প্ল্যান তথ্য সংরক্ষণ ব্যর্থ হয়েছে');
      }
      setIsEditingPlan(false);
      showToast('success', 'প্ল্যানের নাম ও শুরুর তারিখ সফলভাবে আপডেট হয়েছে');
      fetchPlanData();
    } catch (err: unknown) {
      showToast('error', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Milestone Evaluation
  const handleSaveMilestoneEvaluation = async () => {
    if (!evaluatingMilestone) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/plan/milestones/${evaluatingMilestone.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: milestoneStatus,
          achieved_result: milestoneResultNote.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'মাইলস্টোন মূল্যায়ন সংরক্ষণ করা যায়নি');
      }
      setEvaluatingMilestone(null);
      showToast('success', 'মাইলস্টোন মূল্যায়ন সফলভাবে সংরক্ষিত হয়েছে');
      fetchPlanData();
    } catch (err: unknown) {
      showToast('error', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Quick Task Status Change
  const handleQuickStatusChange = async (taskId: string, newStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED') => {
    try {
      // Optimistic update
      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          phases: prev.phases.map((ph) => ({
            ...ph,
            tasks: ph.tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus, progress_percent: newStatus === 'DONE' ? 100 : t.progress_percent } : t)),
          })),
        };
      });

      const res = await fetch(`/api/plan/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          ...(newStatus === 'DONE' ? { progress_percent: 100 } : {}),
        }),
      });

      if (!res.ok) {
        throw new Error('স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে');
      }
      fetchPlanData();
      showToast('success', 'টাস্ক স্ট্যাটাস আপডেট হয়েছে');
    } catch (err: unknown) {
      showToast('error', getErrorMessage(err));
      fetchPlanData();
    }
  };

  // Handle Quick Owner Change
  const handleQuickOwnerChange = async (taskId: string, ownerId: string) => {
    try {
      const res = await fetch(`/api/plan/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_id: ownerId === 'UNASSIGNED' ? null : ownerId,
        }),
      });

      if (!res.ok) {
        throw new Error('দায়িত্ব পরিবর্তন ব্যর্থ হয়েছে');
      }
      fetchPlanData();
      showToast('success', 'টাস্কের দায়িত্বপ্রাপ্ত ব্যক্তি পরিবর্তন হয়েছে');
    } catch (err: unknown) {
      showToast('error', getErrorMessage(err));
    }
  };

  // Handle Quick Progress Change
  const handleQuickProgressChange = async (taskId: string, progress: number) => {
    try {
      const res = await fetch(`/api/plan/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          progress_percent: progress,
          ...(progress === 100 ? { status: 'DONE' } : {}),
        }),
      });

      if (!res.ok) {
        throw new Error('অগ্রগতি আপডেট করা যায়নি');
      }
      fetchPlanData();
    } catch (err: unknown) {
      showToast('error', getErrorMessage(err));
    }
  };

  // Handle Inline Outcome Save
  const handleSaveOutcomeNote = async (taskId: string) => {
    try {
      const res = await fetch(`/api/plan/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome_note: outcomeDraft.trim() || null,
        }),
      });

      if (!res.ok) {
        throw new Error('ফলাফল নোট সংরক্ষণ করা যায়নি');
      }
      setEditingOutcomeId(null);
      fetchPlanData();
      showToast('success', 'ফলাফল নোট সংরক্ষিত হয়েছে');
    } catch (err: unknown) {
      showToast('error', getErrorMessage(err));
    }
  };

  // Handle Add Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan || !selectedPhaseIdForAdd) return;
    if (!taskForm.title_bn.trim() || !taskForm.title_en.trim()) {
      showToast('error', 'বাংলা এবং ইংরেজি উভয় শিরোনামই আবশ্যক');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/plan/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: plan.id,
          phase_id: selectedPhaseIdForAdd,
          title_bn: taskForm.title_bn.trim(),
          title_en: taskForm.title_en.trim(),
          description: taskForm.description.trim() || null,
          owner_id: taskForm.owner_id ? taskForm.owner_id : null,
          due_date: taskForm.due_date || null,
          status: taskForm.status,
          progress_percent: Number(taskForm.progress_percent) || 0,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'নতুন টাস্ক তৈরি করা সম্ভব হয়নি');
      }

      setShowAddTaskModal(false);
      setTaskForm({
        title_bn: '',
        title_en: '',
        description: '',
        owner_id: '',
        due_date: '',
        progress_percent: 0,
        status: 'NOT_STARTED',
      });
      showToast('success', 'নতুন টাস্ক সফলভাবে তৈরি হয়েছে');
      fetchPlanData();
    } catch (err: unknown) {
      showToast('error', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Edit Task Modal Submit
  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/plan/tasks/${editingTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title_bn: editingTask.title_bn.trim(),
          title_en: editingTask.title_en.trim(),
          description: editingTask.description?.trim() || null,
          owner_id: editingTask.owner_id || null,
          due_date: editingTask.due_date ? format(new Date(editingTask.due_date), 'yyyy-MM-dd') : null,
          status: editingTask.status,
          progress_percent: Number(editingTask.progress_percent) || 0,
          outcome_note: editingTask.outcome_note?.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'টাস্ক হালনাগাদ করা যায়নি');
      }

      setEditingTask(null);
      showToast('success', 'টাস্ক সফলভাবে আপডেট করা হয়েছে');
      fetchPlanData();
    } catch (err: unknown) {
      showToast('error', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Task
  const handleDeleteTask = async () => {
    if (!deletingTaskId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/plan/tasks/${deletingTaskId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'টাস্ক মুছে ফেলতে ব্যর্থ হয়েছে');
      }
      setDeletingTaskId(null);
      showToast('success', 'টাস্ক মুছে ফেলা হয়েছে');
      fetchPlanData();
    } catch (err: unknown) {
      showToast('error', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-9 w-9 animate-spin text-emerald-600" />
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
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          <RefreshCw className="h-4 w-4" /> পুনরায় চেষ্টা করুন
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-900 text-emerald-50 border border-emerald-700'
              : 'bg-rose-900 text-rose-50 border border-rose-700'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* SUMMARY HEADER */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                <CalendarCheck className="h-3.5 w-3.5" />
                স্টেপ ৯: ৯০ দিনের মাস্টার প্ল্যান
              </span>

              {/* Current Phase Indicator Badge */}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                <Clock className="h-3.5 w-3.5" />
                দিন {toBengaliDigits(stats?.current_day || 1)} / ৯০ (ফেজ {toBengaliDigits(stats?.current_phase_order || 1)} সক্রিয়)
              </span>

              {/* Overdue Tasks Badge */}
              {stats && stats.overdue_tasks > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 animate-pulse">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                  {toBengaliDigits(stats.overdue_tasks)}টি টাস্ক বিলম্বিত (Overdue)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  কোনো ওভারডিউ টাস্ক নেই
                </span>
              )}
            </div>

            {/* Plan Title & Start Date */}
            {!isEditingPlan ? (
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{plan.name}</h1>
                  <button
                    onClick={() => setIsEditingPlan(true)}
                    className="p-1 rounded text-slate-400 hover:text-emerald-700 hover:bg-slate-100 transition-colors"
                    title="প্ল্যান শিরোনাম ও শুরু তারিখ পরিবর্তন করুন"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    শুরুর তারিখ: <strong className="text-slate-700">{format(parseISO(plan.start_date), 'dd MMMM, yyyy')}</strong> ({toBengaliDigits(plan.start_date)})
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">প্ল্যানের নাম</label>
                    <input
                      type="text"
                      value={planNameInput}
                      onChange={(e) => setPlanNameInput(e.target.value)}
                      className="w-full text-sm rounded-lg border border-slate-300 px-3 py-1.5 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">শুরুর তারিখ (Start Date)</label>
                    <input
                      type="date"
                      value={startDateInput}
                      onChange={(e) => setStartDateInput(e.target.value)}
                      className="w-full text-sm rounded-lg border border-slate-300 px-3 py-1.5 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => setIsEditingPlan(false)}
                    className="px-3 py-1 text-xs rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 font-medium"
                  >
                    বাতিল
                  </button>
                  <button
                    disabled={submitting}
                    onClick={handleUpdatePlanHeader}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-semibold disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    সংরক্ষণ করুন
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Overall Progress Bar Box */}
          <div className="w-full lg:w-80 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                সার্বিক অগ্রগতি (Overall Progress)
              </span>
              <span className="text-base text-emerald-700">{toBengaliDigits(stats?.overall_progress || 0)}%</span>
            </div>
            <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-500"
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

      {/* 3-PHASE ACCORDION CONTROLS & HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            ৩টি পর্যায়ভিত্তিক কর্মপরিকল্পনা (90-Day 3-Phase Plan)
          </h2>
          <p className="text-xs text-slate-500">
            প্রতিটি ফেজের ড্রপডাউন/অ্যাকর্ডিয়ন ক্লিক করে সংশ্লিষ্ট মাইলস্টোন ও টাস্কগুলো দেখুন বা সংকুচিত করুন
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAllPhases}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
          >
            সবগুলো খুলুন (Expand All)
          </button>
          <button
            type="button"
            onClick={collapseAllPhases}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
          >
            সবগুলো বন্ধ করুন (Collapse All)
          </button>
        </div>
      </div>

      {/* 3-PHASE COLLAPSIBLE ACCORDION */}
      <div className="space-y-4">
        {plan.phases.map((phase) => {
          const isExpanded = !!expandedPhases[phase.order_no];
          const isSystemCurrentPhase = stats?.current_phase_order === phase.order_no;
          const phaseTasks = phase.tasks || [];
          const phaseCompleted = phaseTasks.filter((t) => t.status === 'DONE').length;
          const phaseTotal = phaseTasks.length;
          const phasePct = phaseTotal > 0 ? Math.round((phaseTasks.reduce((s, t) => s + t.progress_percent, 0) / phaseTotal)) : 0;
          const phaseMilestone = phase.milestones?.[0];

          return (
            <div
              key={phase.id}
              className={`rounded-2xl border transition-all overflow-hidden ${
                isSystemCurrentPhase
                  ? 'border-emerald-300 bg-white shadow-md'
                  : 'border-slate-200 bg-white shadow-sm'
              }`}
            >
              {/* ACCORDION HEADER (COLLAPSIBLE BUTTON) */}
              <button
                type="button"
                onClick={() => togglePhaseCollapse(phase.order_no)}
                className={`w-full flex flex-col md:flex-row md:items-center justify-between p-5 text-left transition-colors gap-4 ${
                  isExpanded ? 'bg-slate-50/80 border-b border-slate-200' : 'bg-white hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-start md:items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-white shadow-sm ${
                      phase.order_no === 1
                        ? 'bg-blue-600'
                        : phase.order_no === 2
                        ? 'bg-teal-600'
                        : 'bg-purple-600'
                    }`}
                  >
                    {toBengaliDigits(phase.order_no)}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                          phase.order_no === 1
                            ? 'bg-blue-100 text-blue-800'
                            : phase.order_no === 2
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        ফেজ {toBengaliDigits(phase.order_no)}: দিন {toBengaliDigits(phase.day_start)}–{toBengaliDigits(phase.day_end)}
                      </span>

                      {isSystemCurrentPhase && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-ping"></span>
                          চলমান ফেজ
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900 mt-1">{phase.name_bn}</h3>
                    <p className="text-xs text-slate-500 font-mono">{phase.name_en}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end">
                  {/* Progress info */}
                  <div className="text-right">
                    <div className="text-xs font-semibold text-slate-600">
                      টাস্ক: <strong className="text-slate-800">{toBengaliDigits(phaseCompleted)}/{toBengaliDigits(phaseTotal)}</strong>
                      <span className="ml-2 font-bold text-emerald-700">{toBengaliDigits(phasePct)}%</span>
                    </div>
                    <div className="mt-1.5 h-2 w-28 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-300"
                        style={{ width: `${phasePct}%` }}
                      />
                    </div>
                  </div>

                  {/* Accordion Chevron Icon */}
                  <div className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
              </button>

              {/* ACCORDION BODY (COLLAPSIBLE CONTENT) */}
              {isExpanded && (
                <div className="p-5 space-y-6">
                  {/* MILESTONE CARD */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                            <Award className="h-5 w-5" />
                          </span>
                          <div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                              ফেজ {toBengaliDigits(phase.order_no)} মাইলস্টোন
                            </span>
                            <h4 className="text-base font-bold text-slate-900">
                              {phaseMilestone?.title_bn || 'মাইলস্টোন বিবরণ'}
                            </h4>
                          </div>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100 text-xs sm:text-sm space-y-1.5">
                          <div>
                            <span className="font-semibold text-slate-600">প্রত্যাশিত ফলাফল (Expected Result):</span>{' '}
                            <span className="text-slate-800">{phaseMilestone?.expected_result}</span>
                          </div>
                          {phaseMilestone?.achieved_result && (
                            <div className="pt-1 border-t border-slate-200 text-emerald-800">
                              <span className="font-semibold">অর্জিত অগ্রগতি (Achieved):</span>{' '}
                              <span>{phaseMilestone.achieved_result}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Milestone Review Controls */}
                      <div className="flex flex-col items-start md:items-end gap-2.5 shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-medium">মূল্যায়ন স্ট্যাটাস:</span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                              phaseMilestone?.status === 'MET'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : phaseMilestone?.status === 'PARTIAL'
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : phaseMilestone?.status === 'MISSED'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {phaseMilestone?.status === 'MET' && 'অর্জিত (Met)'}
                            {phaseMilestone?.status === 'PARTIAL' && 'আংশিক অর্জিত (Partial)'}
                            {phaseMilestone?.status === 'MISSED' && 'অনর্জিত (Missed)'}
                            {phaseMilestone?.status === 'PENDING' && 'অপেক্ষমাণ (Pending)'}
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            if (phaseMilestone) {
                              setEvaluatingMilestone(phaseMilestone);
                              setMilestoneStatus(phaseMilestone.status);
                              setMilestoneResultNote(phaseMilestone.achieved_result || '');
                            }
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 text-xs font-bold shadow-sm transition-colors"
                        >
                          <Award className="h-4 w-4" />
                          মাইলস্টোন মূল্যায়ন করুন
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* TASKS LIST SECTION */}
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    {/* Table Header / Action Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-slate-200 bg-slate-50/50">
                      <div>
                        <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <span>{phase.name_bn} — টাস্ক তালিকা</span>
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                            {toBengaliDigits(phaseTasks.length)}টি
                          </span>
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          ফেজের সকল কর্মপরিকল্পনা, অগ্রগতি ও দায়িত্বপ্রাপ্ত সদস্যদের তালিকা
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedPhaseIdForAdd(phase.id);
                          setShowAddTaskModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                        নতুন টাস্ক যোগ করুন
                      </button>
                    </div>

                    {/* Empty State */}
                    {phaseTasks.length === 0 ? (
                      <div className="p-12 text-center">
                        <FileText className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                        <h4 className="text-sm font-bold text-slate-700">এই ফেজে এখনও কোনো টাস্ক যোগ করা হয়নি</h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                          উপরের &ldquo;নতুন টাস্ক যোগ করুন&rdquo; বাটনে ক্লিক করে এই ফেজের প্রথম কর্মপরিকল্পনাটি যুক্ত করুন।
                        </p>
                      </div>
                    ) : (
                      /* Interactive Tasks Table / Card List */
                      <div className="divide-y divide-slate-100 overflow-x-auto">
                        {phaseTasks.map((task) => {
                          const todayStr = stats?.today || getDhakaDateString();
                          const dueDateDhaka = task.due_date ? getDhakaDateString(new Date(task.due_date)) : null;
                          const isOverdue =
                            task.status !== 'DONE' &&
                            dueDateDhaka !== null &&
                            dueDateDhaka < todayStr;

                          const isEditingOutcome = editingOutcomeId === task.id;

                          return (
                            <div
                              key={task.id}
                              className={`p-5 transition-colors hover:bg-slate-50/70 ${
                                isOverdue ? 'bg-rose-50/40' : ''
                              }`}
                            >
                              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                {/* Task Details */}
                                <div className="space-y-1.5 flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {/* Status Quick Dropdown */}
                                    <select
                                      value={task.status}
                                      onChange={(e) =>
                                        handleQuickStatusChange(task.id, e.target.value as 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED')
                                      }
                                      className={`text-xs font-bold rounded-lg px-2.5 py-1 border transition-colors cursor-pointer focus:outline-none ${
                                        task.status === 'DONE'
                                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                          : task.status === 'IN_PROGRESS'
                                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                                          : task.status === 'BLOCKED'
                                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                                          : 'bg-slate-100 text-slate-700 border-slate-300'
                                      }`}
                                    >
                                      <option value="NOT_STARTED">শুরু হয়নি (Not Started)</option>
                                      <option value="IN_PROGRESS">চলমান (In Progress)</option>
                                      <option value="DONE">সম্পন্ন (Done)</option>
                                      <option value="BLOCKED">স্থগিত (Blocked)</option>
                                    </select>

                                    {/* Overdue Warning Badge */}
                                    {isOverdue && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
                                        <AlertTriangle className="h-3 w-3" />
                                        বিলম্বিত (Overdue)
                                      </span>
                                    )}

                                    {/* Due Date Indicator */}
                                    <span className="flex items-center gap-1 text-xs text-slate-500 font-mono">
                                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                      {task.due_date ? format(new Date(task.due_date), 'dd MMM, yyyy') : 'তারিখ নেই'}
                                    </span>
                                  </div>

                                  {/* Titles */}
                                  <div>
                                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                                      {task.title_bn}
                                    </h4>
                                    <p className="text-xs text-slate-500 font-mono mt-0.5">{task.title_en}</p>
                                    {task.description && (
                                      <p className="text-xs text-slate-600 mt-1">{task.description}</p>
                                    )}
                                  </div>

                                  {/* Outcome Note Section */}
                                  <div className="pt-1">
                                    {!isEditingOutcome ? (
                                      <div className="flex items-center gap-2 text-xs">
                                        <span className="font-semibold text-slate-500">ফলাফল নোট:</span>
                                        {task.outcome_note ? (
                                          <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md italic">
                                            &ldquo;{task.outcome_note}&rdquo;
                                          </span>
                                        ) : (
                                          <span className="text-slate-400 italic">কোনো নোট নেই</span>
                                        )}
                                        <button
                                          onClick={() => {
                                            setEditingOutcomeId(task.id);
                                            setOutcomeDraft(task.outcome_note || '');
                                          }}
                                          className="text-[11px] text-emerald-600 hover:text-emerald-700 hover:underline font-medium"
                                        >
                                          {task.outcome_note ? 'সম্পাদনা' : 'নোট যোগ করুন'}
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 mt-1">
                                        <input
                                          type="text"
                                          placeholder="কাজের অর্জিত ফলাফল বা বিবরণ লিখুন..."
                                          value={outcomeDraft}
                                          onChange={(e) => setOutcomeDraft(e.target.value)}
                                          className="text-xs rounded-lg border border-slate-300 px-2.5 py-1 w-full max-w-md focus:border-emerald-500 focus:outline-none"
                                        />
                                        <button
                                          onClick={() => handleSaveOutcomeNote(task.id)}
                                          className="px-2.5 py-1 text-xs bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700"
                                        >
                                          সেভ
                                        </button>
                                        <button
                                          onClick={() => setEditingOutcomeId(null)}
                                          className="px-2 py-1 text-xs border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100"
                                        >
                                          বাতিল
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Interactive Controls Column */}
                                <div className="flex flex-wrap lg:flex-nowrap items-center gap-4 shrink-0 pt-2 lg:pt-0">
                                  {/* Owner Dropdown */}
                                  <div className="w-44">
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                                      দায়িত্বপ্রাপ্ত সদস্য
                                    </label>
                                    <select
                                      value={task.owner_id || 'UNASSIGNED'}
                                      onChange={(e) => handleQuickOwnerChange(task.id, e.target.value)}
                                      className="w-full text-xs rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 focus:border-emerald-500 focus:outline-none"
                                    >
                                      <option value="UNASSIGNED">-- অবণ্টিত (Unassigned) --</option>
                                      {employees.map((emp) => (
                                        <option key={emp.id} value={emp.id}>
                                          {emp.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* Progress Slider/Percentage Input */}
                                  <div className="w-36">
                                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-0.5">
                                      <span>অগ্রগতি</span>
                                      <span className="text-emerald-700 font-bold">{toBengaliDigits(task.progress_percent)}%</span>
                                    </div>
                                    <input
                                      type="range"
                                      min="0"
                                      max="100"
                                      step="5"
                                      value={task.progress_percent}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setPlan((prev) => {
                                          if (!prev) return prev;
                                          return {
                                            ...prev,
                                            phases: prev.phases.map((ph) => ({
                                              ...ph,
                                              tasks: ph.tasks.map((t) => (t.id === task.id ? { ...t, progress_percent: val, ...(val === 100 ? { status: 'DONE' } : {}) } : t)),
                                            })),
                                          };
                                        });
                                      }}
                                      onMouseUp={(e) =>
                                        handleQuickProgressChange(task.id, Number((e.target as HTMLInputElement).value))
                                      }
                                      onTouchEnd={(e) =>
                                        handleQuickProgressChange(task.id, Number((e.target as HTMLInputElement).value))
                                      }
                                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                    />
                                  </div>

                                  {/* Edit & Delete Action Buttons */}
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => setEditingTask(task)}
                                      className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors"
                                      title="টাস্ক সম্পাদনা করুন"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => setDeletingTaskId(task.id)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                      title="টাস্ক মুছুন"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
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
        })}
      </div>

      {/* MILESTONE EVALUATION MODAL */}
      {evaluatingMilestone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">মাইলস্টোন মূল্যায়ন</h3>
                  <p className="text-xs text-slate-500">{evaluatingMilestone.title_bn}</p>
                </div>
              </div>
              <button
                onClick={() => setEvaluatingMilestone(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                <span className="font-semibold text-slate-600">প্রত্যাশিত মানদণ্ড:</span>
                <p className="text-slate-800 mt-1">{evaluatingMilestone.expected_result}</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  মূল্যায়ন ফলাফল (Milestone Status)
                </label>
                <select
                  value={milestoneStatus}
                  onChange={(e) => setMilestoneStatus(e.target.value as 'PENDING' | 'MET' | 'PARTIAL' | 'MISSED')}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-slate-800 font-medium focus:border-amber-500 focus:outline-none"
                >
                  <option value="PENDING">অপেক্ষমাণ (PENDING) — এখনও মূল্যায়ন হয়নি</option>
                  <option value="MET">অর্জিত (MET) — প্রত্যাশা অনুযায়ী সম্পূর্ণ অর্জিত</option>
                  <option value="PARTIAL">আংশিক অর্জিত (PARTIAL) — লক্ষ্যমাত্রার কিছু অংশ পূর্ণ</option>
                  <option value="MISSED">অনর্জিত (MISSED) — লক্ষ্য অর্জনে ব্যর্থ</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  অর্জিত ফলাফলের বিশদ মন্তব্য (Achieved Result Note)
                </label>
                <textarea
                  rows={3}
                  value={milestoneResultNote}
                  onChange={(e) => setMilestoneResultNote(e.target.value)}
                  placeholder="যেমন: সকল অডিট সম্পন্ন হয়েছে এবং প্রথম ১৫ দিনে ৭০টি লিড এসেছে..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-slate-800 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setEvaluatingMilestone(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 rounded-xl border border-slate-300 hover:bg-slate-50"
              >
                বাতিল
              </button>
              <button
                disabled={submitting}
                onClick={handleSaveMilestoneEvaluation}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-sm disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                মূল্যায়ন নিশ্চিত করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD TASK MODAL */}
      {showAddTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="h-5 w-5 text-emerald-600" />
                নতুন কর্মপরিকল্পনা (টাস্ক) যোগ করুন
              </h3>
              <button
                onClick={() => setShowAddTaskModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  বাংলা শিরোনাম <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: ফেসবুক গ্রুপে কন্টেন্ট শেয়ারিং ক্যাম্পেইন"
                  value={taskForm.title_bn}
                  onChange={(e) => setTaskForm({ ...taskForm, title_bn: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ইংরেজি শিরোনাম (Title EN) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Facebook Group Content Campaign"
                  value={taskForm.title_en}
                  onChange={(e) => setTaskForm({ ...taskForm, title_en: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">টাস্ক বিবরণ (ঐচ্ছিক)</label>
                <textarea
                  rows={2}
                  placeholder="কাজের বিস্তারিত বিবরণ বা উদ্দেশ্য..."
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">দায়িত্বপ্রাপ্ত কর্মী</label>
                  <select
                    value={taskForm.owner_id}
                    onChange={(e) => setTaskForm({ ...taskForm, owner_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">-- অবণ্টিত (Unassigned) --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">সমাপ্তির তারিখ (Due Date)</label>
                  <input
                    type="date"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">প্রাথমিক স্ট্যাটাস</label>
                  <select
                    value={taskForm.status}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value as 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED' })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="NOT_STARTED">শুরু হয়নি (NOT_STARTED)</option>
                    <option value="IN_PROGRESS">চলমান (IN_PROGRESS)</option>
                    <option value="DONE">সম্পন্ন (DONE)</option>
                    <option value="BLOCKED">স্থগিত (BLOCKED)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    অগ্রগতি % ({taskForm.progress_percent}%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={taskForm.progress_percent}
                    onChange={(e) => setTaskForm({ ...taskForm, progress_percent: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddTaskModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 rounded-xl border border-slate-300 hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  টাস্ক সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TASK MODAL */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-emerald-600" />
                টাস্ক সম্পাদনা করুন
              </h3>
              <button
                onClick={() => setEditingTask(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateTask} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">বাংলা শিরোনাম</label>
                <input
                  type="text"
                  required
                  value={editingTask.title_bn}
                  onChange={(e) => setEditingTask({ ...editingTask, title_bn: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ইংরেজি শিরোনাম</label>
                <input
                  type="text"
                  required
                  value={editingTask.title_en}
                  onChange={(e) => setEditingTask({ ...editingTask, title_en: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">বিবরণ</label>
                <textarea
                  rows={2}
                  value={editingTask.description || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">দায়িত্বপ্রাপ্ত কর্মী</label>
                  <select
                    value={editingTask.owner_id || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, owner_id: e.target.value || null })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">-- অবণ্টিত (Unassigned) --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">সমাপ্তির তারিখ</label>
                  <input
                    type="date"
                    value={editingTask.due_date ? format(new Date(editingTask.due_date), 'yyyy-MM-dd') : ''}
                    onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value || null })}
                    className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">স্ট্যাটাস</label>
                  <select
                    value={editingTask.status}
                    onChange={(e) => {
                      const st = e.target.value as 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';
                      setEditingTask({
                        ...editingTask,
                        status: st,
                        progress_percent: st === 'DONE' ? 100 : editingTask.progress_percent,
                      });
                    }}
                    className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="NOT_STARTED">শুরু হয়নি (NOT_STARTED)</option>
                    <option value="IN_PROGRESS">চলমান (IN_PROGRESS)</option>
                    <option value="DONE">সম্পন্ন (DONE)</option>
                    <option value="BLOCKED">স্থগিত (BLOCKED)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    অগ্রগতি % ({editingTask.progress_percent}%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editingTask.progress_percent}
                    onChange={(e) =>
                      setEditingTask({ ...editingTask, progress_percent: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ফলাফল নোট</label>
                <input
                  type="text"
                  value={editingTask.outcome_note || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, outcome_note: e.target.value })}
                  placeholder="কাজের ফলাফল..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 rounded-xl border border-slate-300 hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  পরিবর্তন সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deletingTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">টাস্ক মুছে ফেলতে চান?</h3>
              <p className="text-xs text-slate-500 mt-1">
                এই কর্মপরিকল্পনাটি ডাটাবেস থেকে স্থায়ীভাবে মুছে যাবে। এটি আর ফিরিয়ে আনা যাবে না।
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeletingTaskId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 rounded-xl border border-slate-300 hover:bg-slate-50"
              >
                বাতিল
              </button>
              <button
                disabled={submitting}
                onClick={handleDeleteTask}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                হ্যাঁ, মুছে ফেলুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
