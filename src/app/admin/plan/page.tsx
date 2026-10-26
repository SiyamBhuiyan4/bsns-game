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
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toBengaliDigits, getDhakaDateString, formatDisplayDate } from '@/lib/date';
import { format, parseISO } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
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

function getErrorMessage(err: unknown, fallback: string = 'ত্রুটি ঘটেছে'): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
}

export default function AdminPlanPage() {
  const { lang } = useLanguage();
  const isEn = lang === 'en';
  const L = (bn: string, en: string) => (isEn ? en : bn);
  const fmtNum = (val: number | string | undefined | null) => {
    if (val === undefined || val === null) return '';
    return isEn ? String(val) : toBengaliDigits(val);
  };
  const getCleanPlanTitle = (name: string) => {
    if (!name) return isEn ? 'Marketing Action Plan' : 'মার্কেটিং কর্মপরিকল্পনা';
    const match = name.match(/^(.*?)\s*\((.*?)\)$/);
    if (match) {
      return isEn ? match[2].trim() : match[1].trim();
    }
    return name;
  };
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

  type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';

  const statusOptions = (
    <>
      <option value="NOT_STARTED">শুরু হয়নি</option>
      <option value="IN_PROGRESS">চলমান</option>
      <option value="DONE">সম্পন্ন</option>
      <option value="BLOCKED">আটকে আছে</option>
    </>
  );

  const milestoneBadge = (status?: PlanMilestone['status']) => {
    switch (status) {
      case 'MET':
        return <span className="badge badge-green">অর্জিত</span>;
      case 'PARTIAL':
        return <span className="badge badge-blue">আংশিক</span>;
      case 'MISSED':
        return <span className="badge badge-red">অনর্জিত</span>;
      case 'PENDING':
        return <span className="badge badge-amber">অপেক্ষমাণ</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
        <p className="text-sm text-slate-500">লোড হচ্ছে...</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="card">
        <EmptyState
          icon={<AlertCircle className="h-5 w-5" />}
          title="প্ল্যান ডাটা পাওয়া যায়নি"
          description="সার্ভারের সাথে সংযোগ হয়নি। আবার চেষ্টা করুন।"
          action={
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  await fetch('/api/plan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name: 'বিস্তারিত মার্কেটিং কর্মপরিকল্পনা (Marketing Action Plan)',
                    }),
                  });
                  fetchPlanData();
                } catch {
                  fetchPlanData();
                }
              }}
              className="btn btn-primary"
            >
              <Plus className="h-4 w-4" /> কর্মপরিকল্পনা তৈরি করুন (Create Action Plan)
            </button>
          }
        />
      </div>
    );
  }

  const totalPlanDays = plan?.phases.reduce((max, p) => Math.max(max, p.day_end), 90) || 90;

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div
          role="status"
          className={`alert fixed right-4 top-4 z-[60] max-w-sm shadow-lg ${
            toastMessage.type === 'success' ? 'alert-success' : 'alert-error'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      <PageHeader
        icon={<CalendarCheck className="h-5 w-5" />}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {getCleanPlanTitle(plan.name)}
            {!isEditingPlan && (
              <button
                onClick={() => setIsEditingPlan(true)}
                className="btn-icon"
                title={L('নাম ও শুরুর তারিখ পরিবর্তন', 'Edit name & start date')}
                aria-label={L('নাম ও শুরুর তারিখ পরিবর্তন', 'Edit name & start date')}
              >
                <Edit2 className="h-4 w-4" />
              </button>
            )}
          </span>
        }
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            {isEn
              ? `${totalPlanDays} Days Plan · Start: ${formatDisplayDate(plan.start_date, 'en')}`
              : `${fmtNum(totalPlanDays)} দিনের প্ল্যান · শুরু: ${formatDisplayDate(plan.start_date, 'bn')}`}
          </span>
        }
        actions={
          <>
            <button type="button" onClick={expandAllPhases} className="btn btn-secondary btn-sm">
              <ChevronDown className="h-3.5 w-3.5" />
              {L('সব খুলুন', 'Expand All')}
            </button>
            <button type="button" onClick={collapseAllPhases} className="btn btn-secondary btn-sm">
              <ChevronUp className="h-3.5 w-3.5" />
              {L('সব বন্ধ', 'Collapse All')}
            </button>
          </>
        }
      />

      {isEditingPlan && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">প্ল্যানের তথ্য</h2>
          </div>
          <div className="card-body grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="plan-name">প্ল্যানের নাম</label>
              <input
                id="plan-name"
                type="text"
                value={planNameInput}
                onChange={(e) => setPlanNameInput(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="plan-start">শুরুর তারিখ</label>
              <input
                id="plan-start"
                type="date"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
                className="input"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
            <button onClick={() => setIsEditingPlan(false)} className="btn btn-secondary btn-sm">
              {L('বাতিল', 'Cancel')}
            </button>
            <button disabled={submitting} onClick={handleUpdatePlanHeader} className="btn btn-primary btn-sm">
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {L('সংরক্ষণ করুন', 'Save')}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={L('চলমান দিন', 'Current Day')}
          value={isEn ? `${stats?.current_day || 1} / ${totalPlanDays}` : `${fmtNum(stats?.current_day || 1)} / ${fmtNum(totalPlanDays)}`}
          note={isEn ? `Phase ${stats?.current_phase_order || 1} active` : `ফেজ ${fmtNum(stats?.current_phase_order || 1)} সক্রিয়`}
          icon={<Clock className="h-4 w-4" />}
          tone="blue"
        />
        <StatCard
          label={L('সার্বিক অগ্রগতি', 'Overall Progress')}
          value={`${fmtNum(stats?.overall_progress || 0)}%`}
          note={
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-600 transition-all duration-500"
                style={{ width: `${stats?.overall_progress || 0}%` }}
              />
            </div>
          }
          icon={<TrendingUp className="h-4 w-4" />}
          tone="brand"
        />
        <StatCard
          label={L('সম্পন্ন টাস্ক', 'Completed Tasks')}
          value={isEn ? `${stats?.completed_tasks || 0} / ${stats?.total_tasks || 0}` : `${fmtNum(stats?.completed_tasks || 0)} / ${fmtNum(stats?.total_tasks || 0)}`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="violet"
        />
        <StatCard
          label={L('বিলম্বিত টাস্ক', 'Overdue Tasks')}
          value={fmtNum(stats?.overdue_tasks || 0)}
          note={stats && stats.overdue_tasks > 0 ? L('দ্রুত ব্যবস্থা নিন', 'Requires action') : L('কোনো বিলম্ব নেই', 'None overdue')}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={stats && stats.overdue_tasks > 0 ? 'red' : 'gray'}
        />
      </div>

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
              className={`card overflow-hidden ${isSystemCurrentPhase ? 'ring-1 ring-brand-500/40' : ''}`}
            >
              <button
                type="button"
                onClick={() => togglePhaseCollapse(phase.order_no)}
                aria-expanded={isExpanded}
                className={`flex w-full flex-col gap-4 px-5 py-4 text-left transition-colors md:flex-row md:items-center md:justify-between ${
                  isExpanded ? 'border-b border-slate-100' : 'hover:bg-slate-50/60'
                }`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-700">
                    {fmtNum(phase.order_no)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-semibold text-slate-900">
                        {isEn ? (phase.name_en || phase.name_bn) : phase.name_bn}
                      </h3>
                      {isSystemCurrentPhase && <span className="badge badge-green">{L('চলমান', 'Current')}</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {isEn
                        ? `Days ${phase.day_start}–${phase.day_end}`
                        : `দিন ${fmtNum(phase.day_start)}–${fmtNum(phase.day_end)}`}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-4 md:justify-end">
                  <div className="text-right">
                    <div className="text-xs text-slate-500">
                      {L('টাস্ক', 'Tasks')} {fmtNum(phaseCompleted)}/{fmtNum(phaseTotal)}
                      <span className="ml-2 font-semibold text-slate-900">{fmtNum(phasePct)}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand-600 transition-all duration-300"
                        style={{ width: `${phasePct}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-slate-400">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="divide-y divide-slate-100">
                  {/* Milestone */}
                  <div className="flex flex-col gap-4 bg-slate-50/50 px-5 py-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Award className="h-4 w-4 text-slate-400" />
                        <span className="text-xs font-medium text-slate-500">{L('মাইলস্টোন', 'Milestone')}</span>
                        {milestoneBadge(phaseMilestone?.status)}
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900">
                        {phaseMilestone?.title_bn || L('মাইলস্টোন', 'Milestone')}
                      </h4>
                      <p className="text-sm text-slate-600">
                        <span className="text-slate-500">{L('প্রত্যাশিত:', 'Expected:')} </span>
                        {phaseMilestone?.expected_result}
                      </p>
                      {phaseMilestone?.achieved_result && (
                        <p className="text-sm text-slate-700">
                          <span className="text-slate-500">{L('অর্জিত:', 'Achieved:')} </span>
                          {phaseMilestone.achieved_result}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (phaseMilestone) {
                          setEvaluatingMilestone(phaseMilestone);
                          setMilestoneStatus(phaseMilestone.status);
                          setMilestoneResultNote(phaseMilestone.achieved_result || '');
                        }
                      }}
                      className="btn btn-secondary btn-sm shrink-0"
                    >
                      <Award className="h-3.5 w-3.5" />
                      মূল্যায়ন করুন
                    </button>
                  </div>

                  {/* Tasks header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      টাস্ক
                      <span className="badge badge-gray">{toBengaliDigits(phaseTasks.length)}</span>
                    </h4>
                    <button
                      onClick={() => {
                        setSelectedPhaseIdForAdd(phase.id);
                        setShowAddTaskModal(true);
                      }}
                      className="btn btn-primary btn-sm"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      নতুন টাস্ক
                    </button>
                  </div>

                  {phaseTasks.length === 0 ? (
                    <EmptyState
                      icon={<FileText className="h-5 w-5" />}
                      title="এই ফেজে কোনো টাস্ক নেই"
                      description="“নতুন টাস্ক” বাটনে ক্লিক করে প্রথম টাস্ক যোগ করুন।"
                    />
                  ) : (
                    phaseTasks.map((task) => {
                      const todayStr = stats?.today || getDhakaDateString();
                      const dueDateDhaka = task.due_date ? getDhakaDateString(new Date(task.due_date)) : null;
                      const isOverdue =
                        task.status !== 'DONE' &&
                        dueDateDhaka !== null &&
                        dueDateDhaka < todayStr;

                      const isEditingOutcome = editingOutcomeId === task.id;

                      return (
                        <div key={task.id} className="px-5 py-4 transition-colors hover:bg-slate-50/60">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="sr-only" htmlFor={`task-status-${task.id}`}>স্ট্যাটাস</label>
                                <select
                                  id={`task-status-${task.id}`}
                                  value={task.status}
                                  onChange={(e) => handleQuickStatusChange(task.id, e.target.value as TaskStatus)}
                                  className={`cursor-pointer rounded-md border px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
                                    task.status === 'DONE'
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                      : task.status === 'IN_PROGRESS'
                                      ? 'border-sky-200 bg-sky-50 text-sky-700'
                                      : task.status === 'BLOCKED'
                                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                                      : 'border-slate-200 bg-slate-50 text-slate-600'
                                  }`}
                                >
                                  {statusOptions}
                                </select>

                                {isOverdue && (
                                  <span className="badge badge-red">
                                    <AlertTriangle className="h-3 w-3" />
                                    বিলম্বিত
                                  </span>
                                )}

                                <span className="flex items-center gap-1 text-xs text-slate-500">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {task.due_date ? format(new Date(task.due_date), 'dd MMM yyyy') : 'তারিখ নেই'}
                                </span>
                              </div>

                              <div>
                                <h5 className="text-sm font-medium leading-snug text-slate-900">{task.title_bn}</h5>
                                <p className="mt-0.5 text-xs text-slate-500">{task.title_en}</p>
                                {task.description && (
                                  <p className="mt-1 text-sm text-slate-600">{task.description}</p>
                                )}
                              </div>

                              {!isEditingOutcome ? (
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="text-slate-500">ফলাফল:</span>
                                  {task.outcome_note ? (
                                    <span className="text-slate-700">{task.outcome_note}</span>
                                  ) : (
                                    <span className="text-slate-400">নেই</span>
                                  )}
                                  <button
                                    onClick={() => {
                                      setEditingOutcomeId(task.id);
                                      setOutcomeDraft(task.outcome_note || '');
                                    }}
                                    className="font-medium text-brand-700 hover:underline"
                                  >
                                    {task.outcome_note ? 'সম্পাদনা' : 'নোট যোগ করুন'}
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                  <label className="sr-only" htmlFor={`outcome-${task.id}`}>ফলাফল নোট</label>
                                  <input
                                    id={`outcome-${task.id}`}
                                    type="text"
                                    placeholder="অর্জিত ফলাফল লিখুন..."
                                    value={outcomeDraft}
                                    onChange={(e) => setOutcomeDraft(e.target.value)}
                                    className="input max-w-md flex-1 py-1.5"
                                  />
                                  <button onClick={() => handleSaveOutcomeNote(task.id)} className="btn btn-primary btn-sm">
                                    সংরক্ষণ
                                  </button>
                                  <button onClick={() => setEditingOutcomeId(null)} className="btn btn-ghost btn-sm">
                                    বাতিল
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-end gap-4 lg:flex-nowrap">
                              <div className="w-44">
                                <label className="label" htmlFor={`task-owner-${task.id}`}>দায়িত্বপ্রাপ্ত</label>
                                <select
                                  id={`task-owner-${task.id}`}
                                  value={task.owner_id || 'UNASSIGNED'}
                                  onChange={(e) => handleQuickOwnerChange(task.id, e.target.value)}
                                  className="input py-1.5 text-xs"
                                >
                                  <option value="UNASSIGNED">অবণ্টিত</option>
                                  {employees.map((emp) => (
                                    <option key={emp.id} value={emp.id}>
                                      {emp.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="w-36">
                                <div className="label flex items-center justify-between">
                                  <label htmlFor={`task-progress-${task.id}`}>অগ্রগতি</label>
                                  <span className="tabular-nums text-slate-900">{toBengaliDigits(task.progress_percent)}%</span>
                                </div>
                                <input
                                  id={`task-progress-${task.id}`}
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
                                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-brand-600"
                                />
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setEditingTask(task)}
                                  className="btn-icon"
                                  title="টাস্ক সম্পাদনা"
                                  aria-label="টাস্ক সম্পাদনা"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setDeletingTaskId(task.id)}
                                  className="btn-icon hover:bg-rose-50 hover:text-rose-600"
                                  title="টাস্ক মুছুন"
                                  aria-label="টাস্ক মুছুন"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MILESTONE EVALUATION MODAL */}
      {evaluatingMilestone && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <div className="card-header">
              <div className="min-w-0">
                <h3 className="card-title">মাইলস্টোন মূল্যায়ন</h3>
                <p className="card-subtitle truncate">{evaluatingMilestone.title_bn}</p>
              </div>
              <button onClick={() => setEvaluatingMilestone(null)} className="btn-icon" aria-label="বন্ধ করুন">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="card-body space-y-4 text-sm">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="text-xs font-medium text-slate-500">প্রত্যাশিত ফলাফল</span>
                <p className="mt-1 text-slate-800">{evaluatingMilestone.expected_result}</p>
              </div>

              <div>
                <label className="label" htmlFor="ms-status">মূল্যায়ন</label>
                <select
                  id="ms-status"
                  value={milestoneStatus}
                  onChange={(e) => setMilestoneStatus(e.target.value as 'PENDING' | 'MET' | 'PARTIAL' | 'MISSED')}
                  className="input"
                >
                  <option value="PENDING">অপেক্ষমাণ — এখনও মূল্যায়ন হয়নি</option>
                  <option value="MET">অর্জিত — সম্পূর্ণ অর্জিত</option>
                  <option value="PARTIAL">আংশিক — কিছু অংশ পূর্ণ</option>
                  <option value="MISSED">অনর্জিত — লক্ষ্য পূরণ হয়নি</option>
                </select>
              </div>

              <div>
                <label className="label" htmlFor="ms-note">অর্জিত ফলাফল</label>
                <textarea
                  id="ms-note"
                  rows={3}
                  value={milestoneResultNote}
                  onChange={(e) => setMilestoneResultNote(e.target.value)}
                  placeholder="যেমন: সকল অডিট সম্পন্ন, প্রথম ১৫ দিনে ৭০টি লিড..."
                  className="input"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button onClick={() => setEvaluatingMilestone(null)} className="btn btn-secondary">
                বাতিল
              </button>
              <button disabled={submitting} onClick={handleSaveMilestoneEvaluation} className="btn btn-primary">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                সংরক্ষণ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD TASK MODAL */}
      {showAddTaskModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <div className="card-header">
              <h3 className="card-title">নতুন টাস্ক</h3>
              <button onClick={() => setShowAddTaskModal(false)} className="btn-icon" aria-label="বন্ধ করুন">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask}>
              <div className="card-body space-y-4">
                <div>
                  <label className="label" htmlFor="add-title-bn">
                    শিরোনাম (বাংলা) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="add-title-bn"
                    type="text"
                    required
                    placeholder="যেমন: ফেসবুক গ্রুপে কন্টেন্ট ক্যাম্পেইন"
                    value={taskForm.title_bn}
                    onChange={(e) => setTaskForm({ ...taskForm, title_bn: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="add-title-en">
                    Title (English) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="add-title-en"
                    type="text"
                    required
                    placeholder="e.g. Facebook Group Content Campaign"
                    value={taskForm.title_en}
                    onChange={(e) => setTaskForm({ ...taskForm, title_en: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="add-desc">বিবরণ (ঐচ্ছিক)</label>
                  <textarea
                    id="add-desc"
                    rows={2}
                    placeholder="কাজের বিবরণ বা উদ্দেশ্য..."
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    className="input"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="add-owner">দায়িত্বপ্রাপ্ত</label>
                    <select
                      id="add-owner"
                      value={taskForm.owner_id}
                      onChange={(e) => setTaskForm({ ...taskForm, owner_id: e.target.value })}
                      className="input"
                    >
                      <option value="">অবণ্টিত</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="add-due">শেষ তারিখ</label>
                    <input
                      id="add-due"
                      type="date"
                      value={taskForm.due_date}
                      onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="add-status">স্ট্যাটাস</label>
                    <select
                      id="add-status"
                      value={taskForm.status}
                      onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value as TaskStatus })}
                      className="input"
                    >
                      {statusOptions}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="add-progress">অগ্রগতি (%)</label>
                    <input
                      id="add-progress"
                      type="number"
                      min="0"
                      max="100"
                      value={taskForm.progress_percent}
                      onChange={(e) => setTaskForm({ ...taskForm, progress_percent: Number(e.target.value) })}
                      className="input"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={() => setShowAddTaskModal(false)} className="btn btn-secondary">
                  বাতিল
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  টাস্ক যোগ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TASK MODAL */}
      {editingTask && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <div className="card-header">
              <h3 className="card-title">টাস্ক সম্পাদনা</h3>
              <button onClick={() => setEditingTask(null)} className="btn-icon" aria-label="বন্ধ করুন">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateTask}>
              <div className="card-body space-y-4">
                <div>
                  <label className="label" htmlFor="edit-title-bn">শিরোনাম (বাংলা)</label>
                  <input
                    id="edit-title-bn"
                    type="text"
                    required
                    value={editingTask.title_bn}
                    onChange={(e) => setEditingTask({ ...editingTask, title_bn: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="edit-title-en">Title (English)</label>
                  <input
                    id="edit-title-en"
                    type="text"
                    required
                    value={editingTask.title_en}
                    onChange={(e) => setEditingTask({ ...editingTask, title_en: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="edit-desc">বিবরণ</label>
                  <textarea
                    id="edit-desc"
                    rows={2}
                    value={editingTask.description || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                    className="input"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="edit-owner">দায়িত্বপ্রাপ্ত</label>
                    <select
                      id="edit-owner"
                      value={editingTask.owner_id || ''}
                      onChange={(e) => setEditingTask({ ...editingTask, owner_id: e.target.value || null })}
                      className="input"
                    >
                      <option value="">অবণ্টিত</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="edit-due">শেষ তারিখ</label>
                    <input
                      id="edit-due"
                      type="date"
                      value={editingTask.due_date ? format(new Date(editingTask.due_date), 'yyyy-MM-dd') : ''}
                      onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value || null })}
                      className="input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="edit-status">স্ট্যাটাস</label>
                    <select
                      id="edit-status"
                      value={editingTask.status}
                      onChange={(e) => {
                        const st = e.target.value as TaskStatus;
                        setEditingTask({
                          ...editingTask,
                          status: st,
                          progress_percent: st === 'DONE' ? 100 : editingTask.progress_percent,
                        });
                      }}
                      className="input"
                    >
                      {statusOptions}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="edit-progress">অগ্রগতি (%)</label>
                    <input
                      id="edit-progress"
                      type="number"
                      min="0"
                      max="100"
                      value={editingTask.progress_percent}
                      onChange={(e) =>
                        setEditingTask({ ...editingTask, progress_percent: Number(e.target.value) })
                      }
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="edit-outcome">ফলাফল নোট</label>
                  <input
                    id="edit-outcome"
                    type="text"
                    value={editingTask.outcome_note || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, outcome_note: e.target.value })}
                    placeholder="কাজের ফলাফল..."
                    className="input"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={() => setEditingTask(null)} className="btn btn-secondary">
                  বাতিল
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  সংরক্ষণ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deletingTaskId && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel sm:max-w-sm">
            <div className="card-body space-y-3 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="card-title">টাস্ক মুছে ফেলবেন?</h3>
              <p className="text-sm text-slate-500">এটি স্থায়ীভাবে মুছে যাবে, ফিরিয়ে আনা যাবে না।</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button onClick={() => setDeletingTaskId(null)} className="btn btn-secondary">
                বাতিল
              </button>
              <button disabled={submitting} onClick={handleDeleteTask} className="btn btn-danger">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                মুছে ফেলুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
