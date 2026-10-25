'use client';

import { useLanguage } from '@/components/LanguageContext';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Target,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Loader2,
  X,
  Users,
  Layers,
  Calendar,
  Check,
  Award,
  Briefcase,
  ListPlus,
  Sparkles,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';

interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  is_active: boolean;
}

interface Section {
  id: string;
  name: string;
}

interface SectionTarget {
  id: string;
  section_id: string;
  employee_id?: string | null;
  metric_type: string;
  target_value: number;
  achieved_value?: number;
  period_type: string;
  period_start: string | null;
  period_end: string | null;
  section: { id: string; name: string };
  creator: { id: string; name: string; email: string };
  employee?: { id: string; name: string; email: string } | null;
  created_at: string;
}

const METRIC_CONFIG: Record<
  string,
  { bn: string; en: string; unitBn: string; unitEn: string; isCurrency: boolean }
> = {
  POSTS_DONE: {
    bn: 'গ্রুপ পোস্ট / লিংক সম্পন্ন',
    en: 'Group Links / Posts Done',
    unitBn: 'টি',
    unitEn: 'links',
    isCurrency: false,
  },
  NEW_LEADS: {
    bn: 'নতুন লিড সংগ্রহ',
    en: 'New Leads Collected',
    unitBn: 'টি',
    unitEn: 'leads',
    isCurrency: false,
  },
  CONFIRMED_ORDERS: {
    bn: 'কনফার্মড অর্ডার',
    en: 'Confirmed Orders',
    unitBn: 'টি',
    unitEn: 'orders',
    isCurrency: false,
  },
  SALES_AMOUNT: {
    bn: 'মোট বিক্রয়',
    en: 'Total Sales',
    unitBn: '৳',
    unitEn: 'BDT',
    isCurrency: true,
  },
  NEW_CLIENTS: {
    bn: 'নতুন ক্রেতা',
    en: 'New Clients',
    unitBn: 'জন',
    unitEn: 'clients',
    isCurrency: false,
  },
  FOLLOWUPS_DONE: {
    bn: 'ইনবক্স ফলো-আপ',
    en: 'Inbox Follow-ups',
    unitBn: 'টি',
    unitEn: 'follow-ups',
    isCurrency: false,
  },
  PROFIT_AMOUNT: {
    bn: 'মোট মুনাফা',
    en: 'Total Profit',
    unitBn: '৳',
    unitEn: 'BDT',
    isCurrency: true,
  },
};

export default function AdminTargetsPage() {
  const { lang, formatNum, formatMoney } = useLanguage();
  const L = useCallback((bn: string, en: string) => (lang === 'en' ? en : bn), [lang]);

  const [targets, setTargets] = useState<SectionTarget[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterEmployee, setFilterEmployee] = useState('ALL');
  const [filterPeriod, setFilterPeriod] = useState('ALL');
  const [filterMetric, setFilterMetric] = useState('ALL');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingTarget, setEditingTarget] = useState<SectionTarget | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  interface JobFormItem {
    id?: string;
    metric_type: string;
    section_id: string;
    target_value: string;
  }

  const [form, setForm] = useState({
    employee_id: '',
    period_type: 'DAILY',
    period_start: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
  });

  const [jobs, setJobs] = useState<JobFormItem[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tRes, eRes, sRes] = await Promise.all([
        fetch('/api/targets'),
        fetch('/api/admin/employees'),
        fetch('/api/admin/sections'),
      ]);

      if (tRes.ok) {
        const d = await tRes.json();
        setTargets(d.targets || []);
      }
      if (eRes.ok) {
        const d = await eRes.json();
        setEmployees(d.employees || []);
      }
      if (sRes.ok) {
        const d = await sRes.json();
        setSections(d.sections || []);
      }
    } catch {
      setErrorMsg('ডাটা লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingTarget(null);
    const initialEmpId = employees[0]?.id || '';
    setForm({
      employee_id: initialEmpId,
      period_type: 'DAILY',
      period_start: new Date().toISOString().slice(0, 10),
    });
    setJobs([
      {
        metric_type: 'POSTS_DONE',
        section_id: sections[0]?.id || '',
        target_value: '5',
      },
    ]);
    setErrorMsg('');
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (t: SectionTarget) => {
    setEditingTarget(t);
    const empId = t.employee_id || t.employee?.id || '';
    setForm({
      employee_id: empId,
      period_type: t.period_type,
      period_start: t.period_start ? t.period_start.slice(0, 10) : new Date().toISOString().slice(0, 10),
    });

    // Find all targets of this same employee with the same period so admin sees all their jobs
    const empTargets = targets.filter(
      (other) =>
        (other.employee_id || other.employee?.id) === empId &&
        other.period_type === t.period_type
    );

    if (empTargets.length > 0) {
      setJobs(
        empTargets.map((item) => ({
          id: item.id,
          metric_type: item.metric_type,
          section_id: item.section_id || '',
          target_value: String(item.target_value),
        }))
      );
    } else {
      setJobs([
        {
          id: t.id,
          metric_type: t.metric_type,
          section_id: t.section_id || '',
          target_value: String(t.target_value),
        },
      ]);
    }

    setErrorMsg('');
    setShowModal(true);
  };

  // Add Another Job
  const handleAddJob = () => {
    const existingMetrics = jobs.map((j) => j.metric_type);
    const metricKeys = Object.keys(METRIC_CONFIG);
    const nextMetric = metricKeys.find((m) => !existingMetrics.includes(m)) || 'CONFIRMED_ORDERS';
    setJobs((prev) => [
      ...prev,
      {
        metric_type: nextMetric,
        section_id: nextMetric === 'POSTS_DONE' ? (sections[0]?.id || '') : '',
        target_value: nextMetric === 'SALES_AMOUNT' ? '10000' : '5',
      },
    ]);
  };

  // Remove Job
  const handleRemoveJob = (index: number) => {
    if (jobs.length <= 1) return;
    setJobs((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Update specific field in a job item
  const handleUpdateJob = (index: number, field: keyof JobFormItem, value: string) => {
    setJobs((prev) =>
      prev.map((job, idx) => {
        if (idx !== index) return job;
        const updated = { ...job, [field]: value };
        if (field === 'metric_type' && value === 'POSTS_DONE' && !updated.section_id) {
          updated.section_id = sections[0]?.id || '';
        }
        return updated;
      })
    );
  };

  // Load employee's existing jobs
  const handleLoadEmployeeExistingJobs = (empId: string) => {
    if (!empId) return;
    const empTargets = targets.filter(
      (t) => (t.employee_id || t.employee?.id) === empId && t.period_type === form.period_type
    );
    if (empTargets.length > 0) {
      setJobs(
        empTargets.map((item) => ({
          id: item.id,
          metric_type: item.metric_type,
          section_id: item.section_id || '',
          target_value: String(item.target_value),
        }))
      );
    }
  };

  // Save Target (Add or Update Multiple Jobs)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee_id) {
      setErrorMsg(L('অনুগ্রহ করে একজন কর্মচারী নির্বাচন করুন', 'Please select an employee'));
      return;
    }
    if (!jobs || jobs.length === 0) {
      setErrorMsg(L('কমপক্ষে একটি কাজ যোগ করুন', 'Please add at least one job'));
      return;
    }

    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i];
      if (!j.target_value || Number(j.target_value) <= 0) {
        setErrorMsg(L(`কাজ #${i + 1}-এর জন্য সঠিক সংখ্যা দিন`, `Please enter a valid target for Job #${i + 1}`));
        return;
      }
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: form.employee_id,
          period_type: form.period_type,
          period_start: form.period_start || null,
          jobs: jobs.map((j) => ({
            id: j.id,
            metric_type: j.metric_type,
            section_id: j.metric_type === 'POSTS_DONE' ? (j.section_id || null) : null,
            target_value: Number(j.target_value),
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save targets');

      setSuccessMsg(
        L(
          `কর্মচারীর ${jobs.length}টি কাজ সফলভাবে সংরক্ষণ করা হয়েছে`,
          `Successfully saved ${jobs.length} jobs/targets for employee`
        )
      );

      setShowModal(false);
      fetchData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || L('টার্গেট সংরক্ষণ ব্যর্থ হয়েছে', 'Failed to save targets'));
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Target
  const handleDelete = async (id: string) => {
    if (!confirm(L('আপনি কি নিশ্চিত যে এই টার্গেটটি মুছে ফেলতে চান?', 'Are you sure you want to delete this target?'))) {
      return;
    }
    try {
      const res = await fetch(`/api/targets/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccessMsg(L('টার্গেট মুছে ফেলা হয়েছে', 'Target deleted successfully'));
        fetchData();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to delete target');
      }
    } catch {
      alert('Network error');
    }
  };

  // Filtered targets
  const filteredTargets = useMemo(() => {
    return targets.filter((t) => {
      if (filterEmployee !== 'ALL') {
        const empId = t.employee_id || t.employee?.id;
        if (empId !== filterEmployee) return false;
      }
      if (filterPeriod !== 'ALL' && t.period_type !== filterPeriod) return false;
      if (filterMetric !== 'ALL' && t.metric_type !== filterMetric) return false;
      return true;
    });
  }, [targets, filterEmployee, filterPeriod, filterMetric]);

  // Statistics
  const stats = useMemo(() => {
    const total = targets.length;
    const uniqueEmployees = new Set(targets.map((t) => t.employee_id || t.employee?.id).filter(Boolean)).size;
    let metCount = 0;
    let totalProgressSum = 0;

    for (const t of targets) {
      const targetVal = Number(t.target_value) || 1;
      const achieved = Number(t.achieved_value) || 0;
      const progress = Math.min((achieved / targetVal) * 100, 100);
      totalProgressSum += progress;
      if (achieved >= targetVal) metCount += 1;
    }

    const avgRate = total > 0 ? Math.round(totalProgressSum / total) : 0;
    return { total, uniqueEmployees, metCount, avgRate };
  }, [targets]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Target className="h-5 w-5" />}
        title={L('টার্গেট বণ্টন · Employee Targets', 'Employee Targets & Progress')}
        subtitle={L(
          'বিদ্যমান কর্মচারীদের নির্বাচন করে কার কী পরিমাণ কাজের লক্ষ্য তা নির্ধারণ ও ট্র্যাক করুন',
          'Select employees, assign specific task quantities and track completion progress live'
        )}
        actions={
          <button
            type="button"
            onClick={handleOpenAdd}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" />
            {L('নতুন টার্গেট দিন', 'Assign Target')}
          </button>
        }
      />

      {/* Success Notification */}
      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Notification */}
      {errorMsg && !showModal && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Target className="h-5 w-5 text-emerald-600" />}
          label={L('মোট টার্গেট', 'Total Targets')}
          value={formatNum(stats.total)}
        />
        <StatCard
          icon={<Users className="h-5 w-5 text-blue-600" />}
          label={L('টার্গেটপ্রাপ্ত কর্মী', 'Targeted Employees')}
          value={formatNum(stats.uniqueEmployees)}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-indigo-600" />}
          label={L('গড় পূরণ হার', 'Avg Achievement')}
          value={`${formatNum(stats.avgRate)}%`}
        />
        <StatCard
          icon={<Award className="h-5 w-5 text-emerald-600" />}
          label={L('লক্ষ্য পূরণ সম্পন্ন', 'Targets Met')}
          value={formatNum(stats.metCount)}
        />
      </div>

      {/* Filter Toolbar */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Employee Filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              {L('কর্মচারী দিয়ে ফিল্টার', 'Filter by Employee')}
            </label>
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none"
            >
              <option value="ALL">{L('সব কর্মচারী (All Employees)', 'All Employees')}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.email})
                </option>
              ))}
            </select>
          </div>

          {/* Period Filter */}
          <div className="w-40">
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              {L('সময়কাল', 'Period')}
            </label>
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none"
            >
              <option value="ALL">{L('সব সময়কাল', 'All Periods')}</option>
              <option value="DAILY">{L('দৈনিক (Daily)', 'Daily')}</option>
              <option value="WEEKLY">{L('সাপ্তাহিক (Weekly)', 'Weekly')}</option>
              <option value="MONTHLY">{L('মাসিক (Monthly)', 'Monthly')}</option>
            </select>
          </div>

          {/* Metric Filter */}
          <div className="w-56">
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              {L('কাজের ধরন', 'Task / Metric')}
            </label>
            <select
              value={filterMetric}
              onChange={(e) => setFilterMetric(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none"
            >
              <option value="ALL">{L('সব কাজ (All Tasks)', 'All Tasks')}</option>
              {Object.entries(METRIC_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {L(cfg.bn, cfg.en)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Targets Table / List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
            {L('টার্গেট তালিকা লোড হচ্ছে...', 'Loading targets...')}
          </div>
        ) : filteredTargets.length === 0 ? (
          <EmptyState
            icon={<Target className="h-6 w-6 text-slate-400" />}
            title={L('কোনো টার্গেট নির্ধারণ করা হয়নি', 'No targets found')}
            description={L(
              'কর্মচারীদের কাজের টার্গেট দিতে উপরের "নতুন টার্গেট দিন" বাটনে চাপুন।',
              'Click "Assign Target" above to assign work targets to your team.'
            )}
            action={
              <button
                type="button"
                onClick={handleOpenAdd}
                className="btn btn-primary"
              >
                <Plus className="h-4 w-4" />
                {L('টার্গেট যোগ করুন', 'Assign Target')}
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-pro">
              <thead>
                <tr>
                  <th>{L('কর্মচারী (Employee)', 'Employee')}</th>
                  <th>{L('কাজের ধরন ও গ্রুপ', 'Task & Group')}</th>
                  <th>{L('সময়কাল', 'Period')}</th>
                  <th className="text-right">{L('টার্গেট লক্ষ্য', 'Target Value')}</th>
                  <th className="w-56">{L('চলমান অগ্রগতি (Progress)', 'Live Progress')}</th>
                  <th className="text-center">{L('স্ট্যাটাস', 'Status')}</th>
                  <th className="text-right">{L('অ্যাকশন', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredTargets.map((t) => {
                  const emp = t.employee || employees.find((e) => e.id === t.employee_id);
                  const cfg = METRIC_CONFIG[t.metric_type] || {
                    bn: t.metric_type,
                    en: t.metric_type,
                    unitBn: 'টি',
                    unitEn: 'units',
                    isCurrency: false,
                  };
                  const targetNum = Number(t.target_value) || 0;
                  const achievedNum = Number(t.achieved_value) || 0;
                  const percentage = targetNum > 0 ? Math.min(Math.round((achievedNum / targetNum) * 100), 100) : 0;
                  const isMet = achievedNum >= targetNum && targetNum > 0;

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Employee Column */}
                      <td onClick={() => handleOpenEdit(t)} className="cursor-pointer" title={L('টার্গেট পরিবর্তন করতে ক্লিক করুন', 'Click to edit target')}>
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-xs">
                            {emp?.name ? emp.name.slice(0, 1).toUpperCase() : 'E'}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 hover:text-brand-700">
                              {emp?.name || L('সাধারণ / গ্রুপ লক্ষ্য', 'Unassigned / Team')}
                            </div>
                            <div className="text-xs text-slate-400">{emp?.email || t.section?.name}</div>
                          </div>
                        </div>
                      </td>

                      {/* Task & Group Section */}
                      <td onClick={() => handleOpenEdit(t)} className="cursor-pointer" title={L('টার্গেট পরিবর্তন করতে ক্লিক করুন', 'Click to edit target')}>
                        <div className="font-medium text-slate-800">{L(cfg.bn, cfg.en)}</div>
                        {t.metric_type === 'POSTS_DONE' ? (
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Layers className="h-3 w-3 text-slate-400" />
                            <span>{t.section?.name || L('সব গ্রুপ', 'All Groups')}</span>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400">
                            {L('সাধারণ লক্ষ্য', 'General Target')}
                          </div>
                        )}
                      </td>

                      {/* Period Badge */}
                      <td onClick={() => handleOpenEdit(t)} className="cursor-pointer">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                          <Calendar className="h-3 w-3 text-slate-500" />
                          {t.period_type === 'DAILY'
                            ? L('দৈনিক (প্রতিদিন)', 'Daily')
                            : t.period_type === 'WEEKLY'
                            ? L('সাপ্তাহিক', 'Weekly')
                            : L('মাসিক', 'Monthly')}
                        </span>
                      </td>

                      {/* Target Value (Click to edit) */}
                      <td className="text-right font-mono font-bold text-slate-900">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(t)}
                          className="cursor-pointer font-bold px-2 py-1 rounded hover:bg-slate-200/60 transition-colors inline-flex items-center gap-1"
                          title={L('টার্গেট পরিবর্তন করতে ক্লিক করুন', 'Click to edit target')}
                        >
                          <span>
                            {cfg.isCurrency
                              ? formatMoney(targetNum)
                              : `${formatNum(targetNum)} ${L(cfg.unitBn, cfg.unitEn)}`}
                          </span>
                          <Edit2 className="h-3 w-3 text-slate-400" />
                        </button>
                      </td>

                      {/* Progress Bar & Counter */}
                      <td>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span className="text-slate-600 font-mono">
                              {cfg.isCurrency ? formatMoney(achievedNum) : formatNum(achievedNum)} /{' '}
                              {cfg.isCurrency ? formatMoney(targetNum) : formatNum(targetNum)}
                            </span>
                            <span
                              className={`font-bold ${
                                isMet
                                  ? 'text-emerald-600'
                                  : percentage >= 50
                                  ? 'text-blue-600'
                                  : 'text-amber-600'
                              }`}
                            >
                              {formatNum(percentage)}%
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 rounded-full ${
                                isMet
                                  ? 'bg-emerald-500'
                                  : percentage >= 50
                                  ? 'bg-blue-500'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="text-center">
                        {isMet ? (
                          <span className="badge badge-green inline-flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            {L('পূরণ হয়েছে', 'Target Met')}
                          </span>
                        ) : percentage > 0 ? (
                          <span className="badge badge-blue inline-flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {L('চলমান', 'In Progress')}
                          </span>
                        ) : (
                          <span className="badge badge-gray inline-flex items-center gap-1">
                            {L('শুরু হয়নি', 'Not Started')}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(t)}
                            className="btn-icon"
                            title={L('সম্পাদনা', 'Edit target')}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(t.id)}
                            className="btn-icon text-rose-600 hover:bg-rose-50"
                            title={L('মুছুন', 'Delete target')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign / Edit Target Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-2xl max-h-[92vh] flex flex-col p-0">
            <div className="card-header p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="card-title text-base sm:text-lg">
                    {editingTarget
                      ? L('কর্মচারীর কাজ ও টার্গেট সম্পাদনা করুন', 'Edit Employee Jobs & Targets')
                      : L('কর্মচারীকে এক বা একাধিক কাজ নির্ধারণ করুন', 'Assign Jobs & Targets to Employee')}
                  </h3>
                  <p className="card-subtitle text-xs">
                    {L(
                      'কর্মচারী নির্বাচন করে একসাথে এক বা একাধিক কাজের ধরন ও লক্ষ্যমাত্রা নির্ধারণ করুন',
                      'Select employee and assign multiple jobs & target quotas together'
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn-icon"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
              {errorMsg && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* 1. Select Existing Employee */}
              <div>
                <label className="label font-semibold">
                  {L('কর্মচারী নির্বাচন করুন (Employee) *', 'Select Employee *')}
                </label>
                <select
                  value={form.employee_id}
                  onChange={(e) => {
                    const nextEmpId = e.target.value;
                    setForm({ ...form, employee_id: nextEmpId });
                  }}
                  className="input"
                  required
                >
                  <option value="">{L('-- বিদ্যমান কর্মচারী নির্বাচন করুন --', '-- Select Existing Employee --')}</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.email})
                    </option>
                  ))}
                </select>

                {form.employee_id && (
                  <div className="flex items-center justify-between mt-1.5 px-0.5 text-xs text-slate-500">
                    <span>
                      {L(
                        `এই কর্মচারীর বর্তমানে ${
                          targets.filter(
                            (t) => (t.employee_id || t.employee?.id) === form.employee_id && t.period_type === form.period_type
                          ).length
                        }টি কাজ নির্ধারিত আছে`,
                        `Currently has ${
                          targets.filter(
                            (t) => (t.employee_id || t.employee?.id) === form.employee_id && t.period_type === form.period_type
                          ).length
                        } assigned jobs`
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleLoadEmployeeExistingJobs(form.employee_id)}
                      className="text-emerald-700 hover:text-emerald-800 font-semibold underline cursor-pointer"
                    >
                      {L('বিদ্যমান কাজগুলো লোড করুন', 'Load Existing Jobs')}
                    </button>
                  </div>
                )}
              </div>

              {/* 2. Target Period & Date in 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <div>
                  <label className="label font-semibold">
                    {L('সময়কাল (Period) *', 'Period *')}
                  </label>
                  <select
                    value={form.period_type}
                    onChange={(e) => setForm({ ...form, period_type: e.target.value })}
                    className="input bg-white"
                  >
                    <option value="DAILY">{L('প্রতিদিন (Daily)', 'Daily')}</option>
                    <option value="WEEKLY">{L('সাপ্তাহিক (Weekly)', 'Weekly')}</option>
                    <option value="MONTHLY">{L('মাসিক (Monthly)', 'Monthly')}</option>
                  </select>
                </div>

                <div>
                  <label className="label font-semibold">
                    {form.period_type === 'DAILY'
                      ? L('কার্যকর তারিখ (Date)', 'Effective Date')
                      : L('শুরুর তারিখ / মাস (Start Date / Month)', 'Start Date / Month')}
                  </label>
                  <input
                    type="date"
                    value={form.period_start}
                    onChange={(e) => setForm({ ...form, period_start: e.target.value })}
                    className="input bg-white"
                  />
                </div>
              </div>

              {/* 3. Assigned Jobs List (Multiple Jobs) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <div className="flex items-center gap-2">
                    <ListPlus className="h-4 w-4 text-emerald-600" />
                    <span className="font-bold text-slate-800 text-sm">
                      {L('কাজের তালিকা ও লক্ষ্যমাত্রা (Jobs & Quotas)', 'Jobs & Quotas')}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      {jobs.length} {L('টি কাজ', 'Jobs')}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {L('একত্রে একাধিক কাজ যোগ করতে পারেন', 'Add multiple jobs for this employee')}
                  </span>
                </div>

                {/* Job Cards */}
                <div className="space-y-3">
                  {jobs.map((job, idx) => {
                    const cfg = METRIC_CONFIG[job.metric_type] || {
                      bn: job.metric_type,
                      en: job.metric_type,
                      unitBn: 'টি',
                      unitEn: 'units',
                      isCurrency: false,
                    };

                    return (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 relative hover:border-slate-300 transition-colors shadow-sm"
                      >
                        {/* Job Item Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-200 text-slate-700 font-bold text-xs">
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-slate-800 text-xs sm:text-sm">
                              {L(`কাজ #${idx + 1}`, `Job #${idx + 1}`)}: {L(cfg.bn, cfg.en)}
                            </span>
                            {job.id && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                                {L('বিদ্যমান', 'Existing')}
                              </span>
                            )}
                          </div>

                          {jobs.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveJob(idx)}
                              className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                              title={L('এই কাজটি মুছুন', 'Remove this job')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        {/* Job Item Inputs */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                          {/* Task / Metric Dropdown */}
                          <div className={job.metric_type === 'POSTS_DONE' ? 'sm:col-span-5' : 'sm:col-span-8'}>
                            <label className="text-[11px] font-medium text-slate-600 block mb-1">
                              {L('কাজের ধরন (Task / Metric) *', 'Task / Metric *')}
                            </label>
                            <select
                              value={job.metric_type}
                              onChange={(e) => handleUpdateJob(idx, 'metric_type', e.target.value)}
                              className="input bg-white text-xs sm:text-sm"
                              required
                            >
                              {Object.entries(METRIC_CONFIG).map(([key, mcfg]) => (
                                <option key={key} value={key}>
                                  {L(mcfg.bn, mcfg.en)}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Group Section (if POSTS_DONE) */}
                          {job.metric_type === 'POSTS_DONE' && (
                            <div className="sm:col-span-4">
                              <label className="text-[11px] font-medium text-slate-600 block mb-1">
                                {L('গ্রুপ / সাব-গ্রুপ (Section)', 'Group Section')}
                              </label>
                              <select
                                value={job.section_id}
                                onChange={(e) => handleUpdateJob(idx, 'section_id', e.target.value)}
                                className="input bg-white text-xs sm:text-sm"
                              >
                                <option value="">{L('-- সব গ্রুপ (All) --', '-- All Groups --')}</option>
                                {sections.map((sec) => (
                                  <option key={sec.id} value={sec.id}>
                                    {sec.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Target Value Input */}
                          <div className={job.metric_type === 'POSTS_DONE' ? 'sm:col-span-3' : 'sm:col-span-4'}>
                            <label className="text-[11px] font-medium text-slate-600 block mb-1">
                              {L('টার্গেট সংখ্যা (Quota) *', 'Target Quota *')}
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={job.target_value}
                                onChange={(e) => handleUpdateJob(idx, 'target_value', e.target.value)}
                                className="input bg-white font-mono text-xs sm:text-sm pr-10"
                                placeholder="5"
                                required
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                                {L(cfg.unitBn, cfg.unitEn)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Another Job Button */}
                <button
                  type="button"
                  onClick={handleAddJob}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50 text-emerald-700 font-semibold text-xs sm:text-sm transition-all shadow-sm cursor-pointer mt-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>{L('+ আরও একটি কাজ যোগ করুন', '+ Add Another Job / Task')}</span>
                </button>

                {/* Multiple Jobs Pro-Tip */}
                <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-3 text-xs text-emerald-900 flex items-start gap-2.5 mt-2">
                  <Sparkles className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    {L(
                      'টিপস: আপনি একই কর্মচারীকে একসাথে একাধিক কাজ দিতে পারেন (যেমন: মাশরুম গ্রুপ ৩টি, এগ্রো গ্রুপ ২টি, কনফার্মড অর্ডার ১০টি এবং লিড ৮টি)। কর্মচারীর অ্যাকাউন্টে সবগুলো কাজ আলাদাভাবে ট্র্যাক হবে।',
                      'Tip: You can assign multiple jobs to the employee simultaneously (e.g. 3 Mushroom posts, 2 Agro posts, 10 Confirmed Orders, and 8 Leads). All jobs will be tracked individually.'
                    )}
                  </span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary cursor-pointer"
                >
                  {L('বাতিল', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary cursor-pointer flex items-center gap-1.5"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  <span>
                    {editingTarget
                      ? L(`আপডেট সংরক্ষণ করুন (${jobs.length}টি কাজ)`, `Save Changes (${jobs.length} Jobs)`)
                      : L(`সবগুলো কাজ নিশ্চিত করুন (${jobs.length}টি কাজ)`, `Assign All Jobs (${jobs.length} Jobs)`)}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
