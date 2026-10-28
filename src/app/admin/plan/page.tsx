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
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
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

function getErrorMessage(err: unknown, fallback: string = 'ত্রুটি ঘটেছে'): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
}

export default function AdminPlanPage() {
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
    return title.replace(/(\d|[\u09E6-\u09EF])\s*[–—-]\s*(\d|[\u09E6-\u09EF])/g, '$1 – $2');
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

  // Milestone Review & Edit Modal State
  const [evaluatingMilestone, setEvaluatingMilestone] = useState<PlanMilestone | null>(null);
  const [milestoneTitleBn, setMilestoneTitleBn] = useState('');
  const [milestoneExpectedResult, setMilestoneExpectedResult] = useState('');
  const [milestoneStatus, setMilestoneStatus] = useState<'PENDING' | 'MET' | 'PARTIAL' | 'MISSED'>('PENDING');
  const [milestoneResultNote, setMilestoneResultNote] = useState('');

  // Phase Edit & Add Modal State
  const [editingPhase, setEditingPhase] = useState<PlanPhase | null>(null);
  const [showAddPhaseModal, setShowAddPhaseModal] = useState(false);
  const [phaseForm, setPhaseForm] = useState({
    name_bn: '',
    name_en: '',
    day_start: 1,
    day_end: 30,
  });
  const [deletingPhaseId, setDeletingPhaseId] = useState<string | null>(null);

  // Add Task Modal State
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [selectedPhaseIdForAdd, setSelectedPhaseIdForAdd] = useState<string>('');
  
  // Deep link from the assistant: ?add=1 opens the add task form.
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('add') === '1') {
      setShowAddTaskModal(true);
    }
  }, []);

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
    const allExpanded: Record<number, boolean> = {};
    plan?.phases.forEach((p) => {
      allExpanded[p.order_no] = true;
    });
    setExpandedPhases(allExpanded);
  };

  const collapseAllPhases = () => {
    const allCollapsed: Record<number, boolean> = {};
    plan?.phases.forEach((p) => {
      allCollapsed[p.order_no] = false;
    });
    setExpandedPhases(allCollapsed);
  };

  const fetchPlanData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/plan');
      if (!res.ok) {
        throw new Error(L('প্ল্যান ডাটা লোড করতে ব্যর্থ হয়েছে'));
      }
      const data = await res.json();
      setPlan(data.plan);
      setStats(data.stats);
      setEmployees(data.employees || []);
      setPlanNameInput(data.plan?.name || '');
      setStartDateInput(data.plan?.start_date || '');
      if (data.stats?.current_phase_order) {
        setExpandedPhases((prev) => ({
          ...prev,
          [data.stats.current_phase_order]: true,
        }));
      }
    } catch (err: unknown) {
      showToast('error', getErrorMessage(err, L('ডাটাবেস কানেকশনে সমস্যা হয়েছে')));
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
        throw new Error(errorData.error || L('প্ল্যান তথ্য সংরক্ষণ ব্যর্থ হয়েছে'));
      }
      setIsEditingPlan(false);
      showToast('success', L('প্ল্যানের নাম ও শুরুর তারিখ সফলভাবে আপডেট হয়েছে'));
      fetchPlanData();
    } catch (err: unknown) {
      showToast('error', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Milestone Evaluation & Edit
  const handleSaveMilestoneEvaluation = async () => {
    if (!evaluatingMilestone) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/plan/milestones/${evaluatingMilestone.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title_bn: milestoneTitleBn.trim() || evaluatingMilestone.title_bn,
          expected_result: milestoneExpectedResult.trim() || evaluatingMilestone.expected_result,
          status: milestoneStatus,
          achieved_result: milestoneResultNote.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || L('মাইলস্টোন মূল্যায়ন সংরক্ষণ করা যায়নি'));
      }
      setEvaluatingMilestone(null);
      showToast('success', L('মাইলস্টোন ও মূল্যায়ন সফলভাবে সংরক্ষিত হয়েছে'));
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
        throw new Error(L('স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে'));
      }
      fetchPlanData();
      showToast('success', L('টাস্ক স্ট্যাটাস আপডেট হয়েছে'));
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
        throw new Error(L('দায়িত্ব পরিবর্তন ব্যর্থ হয়েছে'));
      }
      fetchPlanData();
      showToast('success', L('টাস্কের দায়িত্বপ্রাপ্ত ব্যক্তি পরিবর্তন হয়েছে'));
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
        throw new Error(L('অগ্রগতি আপডেট করা যায়নি'));
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
        throw new Error(L('ফলাফল নোট সংরক্ষণ করা যায়নি'));
      }
      setEditingOutcomeId(null);
      fetchPlanData();
      showToast('success', L('ফলাফল নোট সংরক্ষিত হয়েছে'));
    } catch (err: unknown) {
      showToast('error', getErrorMessage(err));
    }
  };

  // Handle Add Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan || !selectedPhaseIdForAdd) return;
    if (!taskForm.title_bn.trim() || !taskForm.title_en.trim()) {
      showToast('error', L('বাংলা এবং ইংরেজি উভয় শিরোনামই আবশ্যক'));
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
        throw new Error(err.error || L('নতুন টাস্ক তৈরি করা সম্ভব হয়নি'));
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
      showToast('success', L('নতুন টাস্ক সফলভাবে তৈরি হয়েছে'));
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
        throw new Error(err.error || L('টাস্ক হালনাগাদ করা যায়নি'));
      }

      setEditingTask(null);
      showToast('success', L('টাস্ক সফলভাবে আপডেট করা হয়েছে'));
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
        throw new Error(err.error || L('টাস্ক মুছে ফেলতে ব্যর্থ হয়েছে'));
      }
      setDeletingTaskId(null);
      showToast('success', L('টাস্ক মুছে ফেলা হয়েছে'));
      fetchPlanData();
    } catch (err: unknown) {
      showToast('error', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Update Phase
  const handleUpdatePhase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPhase) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/plan/phases/${editingPhase.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name_bn: editingPhase.name_bn.trim(),
          name_en: editingPhase.name_en.trim(),
          day_start: Number(editingPhase.day_start),
          day_end: Number(editingPhase.day_end),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || L('ফেজ আপডেট ব্যর্থ হয়েছে'));
      }
      setEditingPhase(null);
      showToast('success', L('ফেজ তথ্য সফলভাবে আপডেট হয়েছে'));
      fetchPlanData();
    } catch (err: unknown) {
      showToast('error', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Create Phase
  const handleCreatePhase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/plan/phases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: plan.id,
          name_bn: phaseForm.name_bn.trim(),
          name_en: phaseForm.name_en.trim(),
          day_start: Number(phaseForm.day_start),
          day_end: Number(phaseForm.day_end),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || L('নতুন ফেজ তৈরি করা যায়নি'));
      }
      setShowAddPhaseModal(false);
      setPhaseForm({ name_bn: '', name_en: '', day_start: 1, day_end: 30 });
      showToast('success', L('নতুন ফেজ সফলভাবে তৈরি হয়েছে'));
      fetchPlanData();
    } catch (err: unknown) {
      showToast('error', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Phase
  const handleDeletePhase = async () => {
    if (!deletingPhaseId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/plan/phases/${deletingPhaseId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || L('ফেজ মুছে ফেলা সম্ভব হয়নি'));
      }
      setDeletingPhaseId(null);
      showToast('success', L('ফেজ সফলভাবে মুছে ফেলা হয়েছে'));
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
      <option value="NOT_STARTED">{L("শুরু হয়নি")}</option>
      <option value="IN_PROGRESS">{L("চলমান")}</option>
      <option value="DONE">{L("সম্পন্ন")}</option>
      <option value="BLOCKED">{L("আটকে আছে")}</option>
    </>
  );

  const milestoneBadge = (status?: PlanMilestone['status']) => {
    switch (status) {
      case 'MET':
        return <span className="badge badge-green">{L("অর্জিত")}</span>;
      case 'PARTIAL':
        return <span className="badge badge-blue">{L("আংশিক")}</span>;
      case 'MISSED':
        return <span className="badge badge-red">{L("অনর্জিত")}</span>;
      case 'PENDING':
        return <span className="badge badge-amber">{L("অপেক্ষমাণ")}</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-busy="true">
        <span className="sr-only">{L("লোড হচ্ছে...")}</span>
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-3.5 w-72" />
          </div>
        </div>
        <SkeletonStatCards count={4} />
        <div className="card space-y-3 p-5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="card">
        <EmptyState
          icon={<AlertCircle className="h-5 w-5" />}
          title={L("প্ল্যান ডাটা পাওয়া যায়নি")}
          description={L("সার্ভারের সাথে সংযোগ হয়নি। আবার চেষ্টা করুন।")}
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
              <Plus className="h-4 w-4" /> {L("কর্মপরিকল্পনা তৈরি করুন (Create Action Plan)")}
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
          className={`alert fixed right-4 top-4 z-[60] max-w-[calc(100vw-2rem)] shadow-[var(--shadow-pop)] sm:max-w-sm ${
            toastMessage.type === 'success' ? 'alert-success' : 'alert-error'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
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
              : L(`${fmtNum(totalPlanDays)} দিনের প্ল্যান · শুরু: ${formatDisplayDate(plan.start_date, 'bn')}`)}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddPhaseModal(true)}
              className="btn btn-primary btn-sm gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{L('নতুন ফেজ যোগ করুন', 'Add Phase')}</span>
            </button>
            <button type="button" onClick={expandAllPhases} className="btn btn-secondary btn-sm">
              <ChevronDown className="h-3.5 w-3.5" />
              {L('সব খুলুন', 'Expand All')}
            </button>
            <button type="button" onClick={collapseAllPhases} className="btn btn-secondary btn-sm">
              <ChevronUp className="h-3.5 w-3.5" />
              {L('সব বন্ধ', 'Collapse All')}
            </button>
          </div>
        }
      />

      {isEditingPlan && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">{L("প্ল্যানের তথ্য সম্পাদনা")}</h2>
          </div>
          <div className="card-body grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="plan-name">{L("প্ল্যানের নাম")}</label>
              <input
                id="plan-name"
                type="text"
                value={planNameInput}
                onChange={(e) => setPlanNameInput(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="plan-start">{L("শুরুর তারিখ")}</label>
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

      {/* STATS OVERVIEW */}
      <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={L('চলমান দিন', 'Current Day')}
          value={isEn ? `${stats?.current_day || 1} / ${totalPlanDays}` : `${fmtNum(stats?.current_day || 1)} / ${fmtNum(totalPlanDays)}`}
          note={isEn ? `Phase ${stats?.current_phase_order || 1} active` : L(`ফেজ ${fmtNum(stats?.current_phase_order || 1)} সক্রিয়`)}
          icon={<Clock className="h-4 w-4" />}
          tone="gray"
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
          tone="gray"
        />
        <StatCard
          label={L('বিলম্বিত টাস্ক', 'Overdue Tasks')}
          value={fmtNum(stats?.overdue_tasks || 0)}
          note={stats && stats.overdue_tasks > 0 ? L('দ্রুত ব্যবস্থা নিন', 'Requires action') : L('কোনো বিলম্ব নেই', 'None overdue')}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={stats && stats.overdue_tasks > 0 ? 'red' : 'gray'}
        />
      </div>

      {/* PHASES LIST */}
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
              <div
                onClick={() => togglePhaseCollapse(phase.order_no)}
                className={`flex w-full flex-col gap-4 px-5 py-4 text-left transition-colors md:flex-row md:items-center md:justify-between cursor-pointer ${
                  isExpanded ? 'border-b border-slate-100' : 'hover:bg-slate-50/60'
                }`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-700">
                    {fmtNum(phase.order_no)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-semibold text-slate-900 leading-snug">
                        {formatPhaseTitle(isEn ? (phase.name_en || phase.name_bn) : phase.name_bn)}
                      </h3>
                      {isSystemCurrentPhase && <span className="badge badge-green">{L('চলমান', 'Current')}</span>}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPhase(phase);
                        }}
                        className="btn-icon h-7 w-7 text-slate-400"
                        title={L('ফেজের নাম ও দিন সম্পাদনা করুন', 'Edit phase details')}
                        aria-label={L('ফেজের নাম ও দিন সম্পাদনা করুন', 'Edit phase details')}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {isEn
                        ? `Days ${phase.day_start} – ${phase.day_end}`
                        : L(`দিন ${fmtNum(phase.day_start)} – ${fmtNum(phase.day_end)}`)}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-4 md:justify-end">
                  <div className="text-right">
                    <div className="text-xs tabular-nums text-slate-500">
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
              </div>

              {isExpanded && (
                <div className="divide-y divide-slate-100">
                  {/* Milestone & Phase Goal */}
                  <div className="flex flex-col gap-4 bg-slate-50/50 px-5 py-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Award className="h-4 w-4 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-700">{L('মাইলস্টোন ও গাইডলাইন', 'Milestone & Guidelines')}</span>
                        {milestoneBadge(phaseMilestone?.status)}
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900">
                        {phaseMilestone?.title_bn || L('মাইলস্টোন', 'Milestone')}
                      </h4>
                      <p className="text-sm text-slate-600">
                        <span className="text-slate-500 font-medium">{L('প্রত্যাশিত:', 'Expected:')} </span>
                        {phaseMilestone?.expected_result}
                      </p>
                      {phaseMilestone?.achieved_result && (
                        <p className="text-sm text-slate-700">
                          <span className="text-slate-500 font-medium">{L('অর্জিত:', 'Achieved:')} </span>
                          {phaseMilestone.achieved_result}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (phaseMilestone) {
                          setEvaluatingMilestone(phaseMilestone);
                          setMilestoneTitleBn(phaseMilestone.title_bn || '');
                          setMilestoneExpectedResult(phaseMilestone.expected_result || '');
                          setMilestoneStatus(phaseMilestone.status);
                          setMilestoneResultNote(phaseMilestone.achieved_result || '');
                        }
                      }}
                      className="btn btn-secondary btn-sm gap-1.5 shrink-0"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>{L('সম্পাদনা ও মূল্যায়ন', 'Edit & Evaluate')}</span>
                    </button>
                  </div>

                  {/* Tasks header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-white">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      {L('টাস্ক তালিকা', 'Task List')}
                      <span className="badge badge-gray tabular-nums">{fmtNum(phaseTasks.length)}</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPhaseIdForAdd(phase.id);
                        setShowAddTaskModal(true);
                      }}
                      className="btn btn-primary btn-sm gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{L('নতুন টাস্ক', 'New Task')}</span>
                    </button>
                  </div>

                  {phaseTasks.length === 0 ? (
                    <EmptyState
                      icon={<FileText className="h-5 w-5" />}
                      title={L('এই ফেজে কোনো টাস্ক নেই', 'No tasks in this phase')}
                      description={L('“নতুন টাস্ক” বাটনে ক্লিক করে টাস্ক যোগ করুন।', 'Click "New Task" to add tasks to this phase.')}
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
                                <label className="sr-only" htmlFor={`task-status-${task.id}`}>{L("স্ট্যাটাস")}</label>
                                <select
                                  id={`task-status-${task.id}`}
                                  value={task.status}
                                  onChange={(e) => handleQuickStatusChange(task.id, e.target.value as TaskStatus)}
                                  className={`cursor-pointer rounded-lg border px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
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
                                    {L('বিলম্বিত', 'Overdue')}
                                  </span>
                                )}

                                <span className="flex items-center gap-1 text-xs text-slate-500">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {task.due_date ? format(new Date(task.due_date), 'dd MMM yyyy') : L('তারিখ নেই', 'No date')}
                                </span>
                              </div>

                              {/* Task Title (Clickable for instant edit) */}
                              <div
                                onClick={() => setEditingTask(task)}
                                className="cursor-pointer group flex items-start gap-1.5"
                                title={L('সম্পাদনা করতে ক্লিক করুন', 'Click to edit task')}
                              >
                                <div>
                                  <h5 className="flex items-center gap-1.5 text-sm font-semibold leading-snug text-slate-900 group-hover:text-brand-700">
                                    {isEn ? task.title_en || task.title_bn : task.title_bn}
                                    <Edit2 className="h-3 w-3 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
                                  </h5>
                                  {task.description && (
                                    <p className="mt-1 text-sm text-slate-600">{task.description}</p>
                                  )}
                                </div>
                              </div>

                              {/* Outcome Note */}
                              {!isEditingOutcome ? (
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="text-slate-500 font-medium">{L('ফলাফল:', 'Outcome:')}</span>
                                  {task.outcome_note ? (
                                    <span className="text-slate-700">{task.outcome_note}</span>
                                  ) : (
                                    <span className="text-slate-400">{L('নেই', 'None')}</span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingOutcomeId(task.id);
                                      setOutcomeDraft(task.outcome_note || '');
                                    }}
                                    className="font-semibold text-brand-700 hover:underline"
                                  >
                                    {task.outcome_note ? L('সম্পাদনা', 'Edit') : L('নোট যোগ করুন', 'Add note')}
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                  <label className="sr-only" htmlFor={`outcome-${task.id}`}>{L("ফলাফল নোট")}</label>
                                  <input
                                    id={`outcome-${task.id}`}
                                    type="text"
                                    placeholder={L('অর্জিত ফলাফল লিখুন...', 'Enter achieved outcome...')}
                                    value={outcomeDraft}
                                    onChange={(e) => setOutcomeDraft(e.target.value)}
                                    className="input input-sm max-w-md flex-1"
                                  />
                                  <button onClick={() => handleSaveOutcomeNote(task.id)} className="btn btn-primary btn-sm">
                                    {L('সংরক্ষণ', 'Save')}
                                  </button>
                                  <button onClick={() => setEditingOutcomeId(null)} className="btn btn-ghost btn-sm">
                                    {L('বাতিল', 'Cancel')}
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-end gap-4 lg:flex-nowrap">
                              {/* Assigned Marketer */}
                              <div className="w-44">
                                <label className="label" htmlFor={`task-owner-${task.id}`}>
                                  {L('দায়িত্বপ্রাপ্ত', 'Assigned To')}
                                </label>
                                <select
                                  id={`task-owner-${task.id}`}
                                  value={task.owner_id || 'UNASSIGNED'}
                                  onChange={(e) => handleQuickOwnerChange(task.id, e.target.value)}
                                  className="input input-sm"
                                >
                                  <option value="UNASSIGNED">{L('অবণ্টিত', 'Unassigned')}</option>
                                  {employees.map((emp) => (
                                    <option key={emp.id} value={emp.id}>
                                      {emp.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Progress Slider */}
                              <div className="w-36">
                                <div className="label flex items-center justify-between">
                                  <label htmlFor={`task-progress-${task.id}`}>{L('অগ্রগতি', 'Progress')}</label>
                                  <span className="tabular-nums font-semibold text-slate-900">{fmtNum(task.progress_percent)}%</span>
                                </div>
                                <div className="range-push" style={{ ['--fill' as string]: `${task.progress_percent}%` }}>
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
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingTask(task)}
                                  className="btn-icon"
                                  title={L('টাস্ক সম্পাদনা', 'Edit task')}
                                  aria-label={L('টাস্ক সম্পাদনা', 'Edit task')}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingTaskId(task.id)}
                                  className="btn-icon hover:bg-rose-50 hover:text-rose-600"
                                  title={L('টাস্ক মুছুন', 'Delete task')}
                                  aria-label={L('টাস্ক মুছুন', 'Delete task')}
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

      {/* MILESTONE REVIEW & EDIT MODAL */}
      {evaluatingMilestone && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <div className="card-header">
              <div className="min-w-0">
                <h3 className="card-title">{L('মাইলস্টোন ও গাইডলাইন সম্পাদনা', 'Milestone & Guidelines')}</h3>
                <p className="card-subtitle truncate">{evaluatingMilestone.title_bn}</p>
              </div>
              <button onClick={() => setEvaluatingMilestone(null)} className="btn-icon" aria-label={L("বন্ধ করুন")}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="card-body space-y-4 text-sm">
              <div>
                <label className="label" htmlFor="ms-title">{L('মাইলস্টোনের নাম (বাংলা)', 'Milestone Title')}</label>
                <input
                  id="ms-title"
                  type="text"
                  value={milestoneTitleBn}
                  onChange={(e) => setMilestoneTitleBn(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="label" htmlFor="ms-expected">{L('প্রত্যাশিত ফলাফল ও কর্মপরিকল্পনার গাইডলাইন', 'Expected Goal & Guidance')}</label>
                <textarea
                  id="ms-expected"
                  rows={3}
                  value={milestoneExpectedResult}
                  onChange={(e) => setMilestoneExpectedResult(e.target.value)}
                  className="input"
                  placeholder={L('বর্তমান ব্যবসার বেসলাইন, অগ্রাধিকারভিত্তিক পণ্যের তালিকা...', 'Guidelines for this phase...')}
                />
              </div>

              <div>
                <label className="label" htmlFor="ms-status">{L('মূল্যায়ন স্ট্যাটাস', 'Evaluation Status')}</label>
                <select
                  id="ms-status"
                  value={milestoneStatus}
                  onChange={(e) => setMilestoneStatus(e.target.value as 'PENDING' | 'MET' | 'PARTIAL' | 'MISSED')}
                  className="input font-semibold"
                >
                  <option value="PENDING">{L('অপেক্ষমাণ — এখনও মূল্যায়ন হয়নি', 'Pending — Not evaluated yet')}</option>
                  <option value="MET">{L('অর্জিত — সম্পূর্ণ অর্জিত', 'Met — Fully achieved')}</option>
                  <option value="PARTIAL">{L('আংশিক — কিছু অংশ পূর্ণ', 'Partial — Partially met')}</option>
                  <option value="MISSED">{L('অনর্জিত — লক্ষ্য পূরণ হয়নি', 'Missed — Target not met')}</option>
                </select>
              </div>

              <div>
                <label className="label" htmlFor="ms-note">{L('অর্জিত ফলাফল ও অগ্রগতি নোট', 'Achieved Results & Notes')}</label>
                <textarea
                  id="ms-note"
                  rows={3}
                  value={milestoneResultNote}
                  onChange={(e) => setMilestoneResultNote(e.target.value)}
                  placeholder={L('যেমন: সকল অডিট সম্পন্ন, পণ্যের তথ্য ও ডাটাবেস পর্যালোচিত...', 'e.g. Audits done, database cleaned...')}
                  className="input"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button onClick={() => setEvaluatingMilestone(null)} className="btn btn-secondary">
                {L('বাতিল', 'Cancel')}
              </button>
              <button disabled={submitting} onClick={handleSaveMilestoneEvaluation} className="btn btn-primary">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {L('সংরক্ষণ করুন', 'Save')}
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
              <h3 className="card-title">{L('নতুন টাস্ক তৈরি করুন', 'Create New Task')}</h3>
              <button onClick={() => setShowAddTaskModal(false)} className="btn-icon" aria-label={L("বন্ধ করুন")}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask}>
              <div className="card-body space-y-4">
                <div>
                  <label className="label" htmlFor="add-title-bn">{L('শিরোনাম (বাংলা)', 'Title (Bangla)')} *</label>
                  <input
                    id="add-title-bn"
                    type="text"
                    required
                    placeholder={L("যেমন: নতুন লিড সংগ্রহ ও ফলো-আপ")}
                    value={taskForm.title_bn}
                    onChange={(e) => setTaskForm({ ...taskForm, title_bn: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="add-title-en">{L('Title (English)', 'Title (English)')} *</label>
                  <input
                    id="add-title-en"
                    type="text"
                    required
                    placeholder="e.g. Lead collection and outreach"
                    value={taskForm.title_en}
                    onChange={(e) => setTaskForm({ ...taskForm, title_en: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="add-desc">{L('কাজের বিবরণ ও নির্দেশনা (ঐচ্ছিক)', 'Description & Guidance')}</label>
                  <textarea
                    id="add-desc"
                    rows={2}
                    placeholder={L("কাজের বিস্তারিত বিবরণ ও করণীয়...")}
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    className="input"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="add-owner">{L('দায়িত্বপ্রাপ্ত কর্মকর্তা', 'Assigned To')}</label>
                    <select
                      id="add-owner"
                      value={taskForm.owner_id}
                      onChange={(e) => setTaskForm({ ...taskForm, owner_id: e.target.value })}
                      className="input"
                    >
                      <option value="">{L('অবণ্টিত', 'Unassigned')}</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="add-due">{L('শেষ তারিখ (Due Date)', 'Due Date')}</label>
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
                    <label className="label" htmlFor="add-status">{L('স্ট্যাটাস', 'Status')}</label>
                    <select
                      id="add-status"
                      value={taskForm.status}
                      onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value as TaskStatus })}
                      className="input font-semibold"
                    >
                      {statusOptions}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="add-progress">{L('অগ্রগতি (%)', 'Progress (%)')}</label>
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
                  {L('বাতিল', 'Cancel')}
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {L('টাস্ক যোগ করুন', 'Add Task')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TASK MODAL (All Fields Control) */}
      {editingTask && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <div className="card-header">
              <h3 className="card-title">{L('টাস্ক সম্পাদনা ও নিয়ন্ত্রণ', 'Edit Task & Controls')}</h3>
              <button onClick={() => setEditingTask(null)} className="btn-icon" aria-label={L("বন্ধ করুন")}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateTask}>
              <div className="card-body space-y-4">
                <div>
                  <label className="label" htmlFor="edit-title-bn">{L('শিরোনাম (বাংলা)', 'Title (Bangla)')} *</label>
                  <input
                    id="edit-title-bn"
                    type="text"
                    required
                    value={editingTask.title_bn}
                    onChange={(e) => setEditingTask({ ...editingTask, title_bn: e.target.value })}
                    className="input font-semibold"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="edit-title-en">{L('Title (English)', 'Title (English)')} *</label>
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
                  <label className="label" htmlFor="edit-desc">{L('কাজের বিবরণ ও নির্দেশনা', 'Description & Guidance')}</label>
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
                    <label className="label" htmlFor="edit-owner">{L('দায়িত্বপ্রাপ্ত কর্মকর্তা', 'Assigned To')}</label>
                    <select
                      id="edit-owner"
                      value={editingTask.owner_id || ''}
                      onChange={(e) => setEditingTask({ ...editingTask, owner_id: e.target.value || null })}
                      className="input font-semibold"
                    >
                      <option value="">{L('অবণ্টিত', 'Unassigned')}</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="edit-due">{L('শেষ তারিখ (Due Date)', 'Due Date')}</label>
                    <input
                      id="edit-due"
                      type="date"
                      value={editingTask.due_date ? format(new Date(editingTask.due_date), 'yyyy-MM-dd') : ''}
                      onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value || null })}
                      className="input font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="edit-status">{L('স্ট্যাটাস', 'Status')}</label>
                    <select
                      id="edit-status"
                      value={editingTask.status}
                      onChange={(e) => {
                        const nextSt = e.target.value as TaskStatus;
                        setEditingTask({
                          ...editingTask,
                          status: nextSt,
                          progress_percent: nextSt === 'DONE' ? 100 : editingTask.progress_percent,
                        });
                      }}
                      className="input font-semibold"
                    >
                      {statusOptions}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="edit-progress">{L('অগ্রগতি (%)', 'Progress (%)')}</label>
                    <input
                      id="edit-progress"
                      type="number"
                      min="0"
                      max="100"
                      value={editingTask.progress_percent}
                      onChange={(e) => {
                        const p = Number(e.target.value);
                        setEditingTask({
                          ...editingTask,
                          progress_percent: p,
                          status: p === 100 ? 'DONE' : editingTask.status,
                        });
                      }}
                      className="input font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="edit-outcome">{L('ফলাফল নোট (Outcome / Result)', 'Outcome Note')}</label>
                  <input
                    id="edit-outcome"
                    type="text"
                    value={editingTask.outcome_note || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, outcome_note: e.target.value })}
                    placeholder={L('অর্জিত ফলাফল বা আপডেট লিখুন...', 'Enter achieved outcome...')}
                    className="input"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={() => setEditingTask(null)} className="btn btn-secondary">
                  {L('বাতিল', 'Cancel')}
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {L('সংরক্ষণ করুন', 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PHASE MODAL */}
      {editingPhase && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <div className="card-header">
              <h3 className="card-title">{L('ফেজ সম্পাদনা', 'Edit Phase')}</h3>
              <button onClick={() => setEditingPhase(null)} className="btn-icon" aria-label={L("বন্ধ করুন")}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdatePhase}>
              <div className="card-body space-y-4">
                <div>
                  <label className="label">{L('ফেজের নাম (বাংলা)', 'Phase Name (Bangla)')} *</label>
                  <input
                    type="text"
                    required
                    value={editingPhase.name_bn}
                    onChange={(e) => setEditingPhase({ ...editingPhase, name_bn: e.target.value })}
                    className="input font-semibold"
                  />
                </div>

                <div>
                  <label className="label">{L('Phase Name (English)', 'Phase Name (English)')} *</label>
                  <input
                    type="text"
                    required
                    value={editingPhase.name_en}
                    onChange={(e) => setEditingPhase({ ...editingPhase, name_en: e.target.value })}
                    className="input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">{L('শুরুর দিন (Day Start)', 'Day Start')} *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={editingPhase.day_start}
                      onChange={(e) => setEditingPhase({ ...editingPhase, day_start: Number(e.target.value) })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">{L('শেষ দিন (Day End)', 'Day End')} *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={editingPhase.day_end}
                      onChange={(e) => setEditingPhase({ ...editingPhase, day_end: Number(e.target.value) })}
                      className="input"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
                {plan.phases.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDeletingPhaseId(editingPhase.id);
                      setEditingPhase(null);
                    }}
                    className="btn btn-danger btn-sm"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{L('ফেজ মুছুন', 'Delete Phase')}</span>
                  </button>
                ) : <div />}

                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingPhase(null)} className="btn btn-secondary">
                    {L('বাতিল', 'Cancel')}
                  </button>
                  <button type="submit" disabled={submitting} className="btn btn-primary">
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {L('সংরক্ষণ করুন', 'Save')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD PHASE MODAL */}
      {showAddPhaseModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <div className="card-header">
              <h3 className="card-title">{L('নতুন ফেজ যোগ করুন', 'Add New Phase')}</h3>
              <button onClick={() => setShowAddPhaseModal(false)} className="btn-icon" aria-label={L("বন্ধ করুন")}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePhase}>
              <div className="card-body space-y-4">
                <div>
                  <label className="label">{L('ফেজের নাম (বাংলা)', 'Phase Name (Bangla)')} *</label>
                  <input
                    type="text"
                    required
                    placeholder={L("যেমন: স্কেলিং ও অটোমেশন")}
                    value={phaseForm.name_bn}
                    onChange={(e) => setPhaseForm({ ...phaseForm, name_bn: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">{L('Phase Name (English)', 'Phase Name (English)')} *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Scaling & Automation"
                    value={phaseForm.name_en}
                    onChange={(e) => setPhaseForm({ ...phaseForm, name_en: e.target.value })}
                    className="input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">{L('শুরুর দিন (Day Start)', 'Day Start')} *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={phaseForm.day_start}
                      onChange={(e) => setPhaseForm({ ...phaseForm, day_start: Number(e.target.value) })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">{L('শেষ দিন (Day End)', 'Day End')} *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={phaseForm.day_end}
                      onChange={(e) => setPhaseForm({ ...phaseForm, day_end: Number(e.target.value) })}
                      className="input"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={() => setShowAddPhaseModal(false)} className="btn btn-secondary">
                  {L('বাতিল', 'Cancel')}
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {L('ফেজ তৈরি করুন', 'Create Phase')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE TASK CONFIRM MODAL */}
      {deletingTaskId && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel sm:max-w-sm">
            <div className="card-body space-y-3 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="card-title">{L('টাস্ক মুছে ফেলবেন?', 'Delete Task?')}</h3>
              <p className="text-sm text-slate-500">{L('এটি স্থায়ীভাবে মুছে যাবে, ফিরিয়ে আনা যাবে না।', 'This action cannot be undone.')}</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button onClick={() => setDeletingTaskId(null)} className="btn btn-secondary">
                {L('বাতিল', 'Cancel')}
              </button>
              <button disabled={submitting} onClick={handleDeleteTask} className="btn btn-danger">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {L('মুছে ফেলুন', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE PHASE CONFIRM MODAL */}
      {deletingPhaseId && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel sm:max-w-sm">
            <div className="card-body space-y-3 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="card-title">{L('ফেজ মুছে ফেলবেন?', 'Delete Phase?')}</h3>
              <p className="text-sm text-slate-500">{L('এই ফেজের সকল টাস্ক ও মাইলস্টোন মুছে যাবে।', 'All tasks and milestones in this phase will be permanently deleted.')}</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button onClick={() => setDeletingPhaseId(null)} className="btn btn-secondary">
                {L('বাতিল', 'Cancel')}
              </button>
              <button disabled={submitting} onClick={handleDeletePhase} className="btn btn-danger">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {L('ফেজ মুছুন', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
