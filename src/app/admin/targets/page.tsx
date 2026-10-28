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
  Info,
  CheckSquare,
  Square,
  Filter,
  ChevronDown,
  Search,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonStatCards, SkeletonTable } from '@/components/ui/Skeleton';

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



export default function AdminTargetsPage() {
  const { lang, formatNum, formatMoney, L } = useLanguage();
  const METRIC_CONFIG: Record<
    string,
    { bn: string; en: string; unitBn: string; unitEn: string; isCurrency: boolean }
  > = {
    POSTS_DONE: {
      bn: L('গ্রুপ পোস্ট / লিংক সম্পন্ন'),
      en: 'Group Links / Posts Done',
      unitBn: L('টি'),
      unitEn: 'links',
      isCurrency: false,
    },
    NEW_LEADS: {
      bn: L('নতুন লিড সংগ্রহ'),
      en: 'New Leads Collected',
      unitBn: L('টি'),
      unitEn: 'leads',
      isCurrency: false,
    },
    CONFIRMED_ORDERS: {
      bn: L('কনফার্মড অর্ডার'),
      en: 'Confirmed Orders',
      unitBn: L('টি'),
      unitEn: 'orders',
      isCurrency: false,
    },
    SALES_AMOUNT: {
      bn: L('মোট বিক্রয়'),
      en: 'Total Sales',
      unitBn: L('৳'),
      unitEn: 'BDT',
      isCurrency: true,
    },
    NEW_CLIENTS: {
      bn: L('নতুন ক্রেতা'),
      en: 'New Clients',
      unitBn: L('জন'),
      unitEn: 'clients',
      isCurrency: false,
    },
    FOLLOWUPS_DONE: {
      bn: L('ইনবক্স ফলো-আপ'),
      en: 'Inbox Follow-ups',
      unitBn: L('টি'),
      unitEn: 'follow-ups',
      isCurrency: false,
    },
    PROFIT_AMOUNT: {
      bn: L('মোট মুনাফা'),
      en: 'Total Profit',
      unitBn: L('৳'),
      unitEn: 'BDT',
      isCurrency: true,
    },
  };

  const [targets, setTargets] = useState<SectionTarget[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterEmployee, setFilterEmployee] = useState('ALL');
  const [filterPeriod, setFilterPeriod] = useState('ALL');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [isMetricDropdownOpen, setIsMetricDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleMetricFilter = (metricKey: string) => {
    if (metricKey === 'ALL') {
      setSelectedMetrics([]);
    } else {
      setSelectedMetrics((prev) =>
        prev.includes(metricKey) ? prev.filter((k) => k !== metricKey) : [...prev, metricKey]
      );
    }
  };

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
      setErrorMsg(L('ডাটা লোড করতে সমস্যা হয়েছে'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Fast background refresher for targets only (avoids re-fetching employees and sections)
  const fetchTargetsOnly = useCallback(async () => {
    try {
      const res = await fetch('/api/targets');
      if (res.ok) {
        const d = await res.json();
        setTargets(d.targets || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Helper to merge identical jobs (same metric and same section) by summing target quantities (e.g. 2 + 3 = 5)
  const mergeJobsList = useCallback(
    (list: JobFormItem[]): { mergedList: JobFormItem[]; mergedAny: boolean; mergedSummary: string } => {
      const map = new Map<string, JobFormItem>();
      let mergedAny = false;
      let mergedSummary = '';

      for (const item of list) {
        const secKey = item.metric_type === 'POSTS_DONE' ? (item.section_id || '') : '';
        const key = `${item.metric_type}__${secKey}`;

        if (map.has(key)) {
          const prev = map.get(key)!;
          const val1 = Number(prev.target_value) || 0;
          const val2 = Number(item.target_value) || 0;
          const sum = val1 + val2;
          prev.target_value = String(sum);
          if (!prev.id && item.id) prev.id = item.id;
          mergedAny = true;

          const cfg = METRIC_CONFIG[item.metric_type];
          const sec = sections.find((s) => s.id === item.section_id);
          const taskLabel = cfg ? (lang === 'en' ? cfg.en : cfg.bn) : item.metric_type;
          const secLabel = sec?.name ? ` [${sec.name}]` : '';
          mergedSummary = `${taskLabel}${secLabel}: ${val1} + ${val2} = ${sum}`;
        } else {
          map.set(key, { ...item });
        }
      }

      return { mergedList: Array.from(map.values()), mergedAny, mergedSummary };
    },
    [sections, lang]
  );

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

    // Find all targets of this same employee with the same period
    const empTargets = targets.filter(
      (other) =>
        (other.employee_id || other.employee?.id) === empId &&
        other.period_type === t.period_type
    );

    const rawList =
      empTargets.length > 0
        ? empTargets.map((item) => ({
            id: item.id,
            metric_type: item.metric_type,
            section_id: item.section_id || '',
            target_value: String(item.target_value),
          }))
        : [
            {
              id: t.id,
              metric_type: t.metric_type,
              section_id: t.section_id || '',
              target_value: String(t.target_value),
            },
          ];

    // Automatically auto-merge any existing duplicate targets (e.g. 2 + 3 = 5)
    const { mergedList } = mergeJobsList(rawList);
    setJobs(mergedList);
    setErrorMsg('');
    setShowModal(true);
  };

  // Add Another Job (picks next unused metric/section to avoid duplicate by default)
  const handleAddJob = () => {
    const usedKeys = new Set(
      jobs.map((j) => `${j.metric_type}__${j.metric_type === 'POSTS_DONE' ? (j.section_id || '') : ''}`)
    );

    let candidateMetric = 'CONFIRMED_ORDERS';
    let candidateSection = '';

    // Check if there is another section for POSTS_DONE not yet used
    const unusedSection = sections.find((s) => !usedKeys.has(`POSTS_DONE__${s.id}`));
    if (unusedSection && !usedKeys.has(`POSTS_DONE__${unusedSection.id}`)) {
      candidateMetric = 'POSTS_DONE';
      candidateSection = unusedSection.id;
    } else {
      for (const m of Object.keys(METRIC_CONFIG)) {
        if (m !== 'POSTS_DONE' && !usedKeys.has(`${m}__`)) {
          candidateMetric = m;
          break;
        }
      }
    }

    setJobs((prev) => [
      ...prev,
      {
        metric_type: candidateMetric,
        section_id: candidateSection,
        target_value: candidateMetric === 'SALES_AMOUNT' ? '10000' : '5',
      },
    ]);
  };

  // Remove Job
  const handleRemoveJob = (index: number) => {
    if (jobs.length <= 1) return;
    setJobs((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Update specific field in a job item (with auto-merge on duplicate metric/section)
  const handleUpdateJob = (index: number, field: keyof JobFormItem, value: string) => {
    const updatedList = jobs.map((job, idx) => {
      if (idx !== index) return job;
      const updated = { ...job, [field]: value };
      if (field === 'metric_type' && value === 'POSTS_DONE' && !updated.section_id) {
        updated.section_id = sections[0]?.id || '';
      }
      return updated;
    });

    // If changing metric or section, auto-merge if duplicate occurs (e.g. 2 + 3 = 5)
    if (field === 'metric_type' || field === 'section_id') {
      const { mergedList, mergedAny, mergedSummary } = mergeJobsList(updatedList);
      if (mergedAny) {
        setJobs(mergedList);
        setSuccessMsg(
          L(
            `একই কাজের ধরন থাকায় কাজ দুটি স্বয়ংক্রিয়ভাবে মার্জ হয়ে গেছে (${mergedSummary})`,
            `Duplicate jobs were automatically merged into one (${mergedSummary})`
          )
        );
        setTimeout(() => setSuccessMsg(''), 4000);
        return;
      }
    }

    setJobs(updatedList);
  };

  // Load employee's existing jobs (with auto-merge)
  const handleLoadEmployeeExistingJobs = (empId: string) => {
    if (!empId) return;
    const empTargets = targets.filter(
      (t) => (t.employee_id || t.employee?.id) === empId && t.period_type === form.period_type
    );
    if (empTargets.length > 0) {
      const rawList = empTargets.map((item) => ({
        id: item.id,
        metric_type: item.metric_type,
        section_id: item.section_id || '',
        target_value: String(item.target_value),
      }));
      const { mergedList, mergedAny, mergedSummary } = mergeJobsList(rawList);
      setJobs(mergedList);
      if (mergedAny) {
        setSuccessMsg(
          L(
            `বিদ্যমান ডুপ্লিকেট কাজগুলো মার্জ করা হয়েছে (${mergedSummary})`,
            `Existing duplicate jobs were merged (${mergedSummary})`
          )
        );
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    }
  };

  // Save Target (Add or Update Multiple Jobs, with auto-merge)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee_id) {
      setErrorMsg(L('অনুগ্রহ করে একজন কর্মচারী নির্বাচন করুন', 'Please select an employee'));
      return;
    }

    // Run auto-merge before submitting so duplicates are always merged
    const { mergedList } = mergeJobsList(jobs);
    if (!mergedList || mergedList.length === 0) {
      setErrorMsg(L('কমপক্ষে একটি কাজ যোগ করুন', 'Please add at least one job'));
      return;
    }

    for (let i = 0; i < mergedList.length; i++) {
      const j = mergedList[i];
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
          jobs: mergedList.map((j) => ({
            id: j.id,
            metric_type: j.metric_type,
            section_id: j.metric_type === 'POSTS_DONE' ? (j.section_id || null) : null,
            target_value: Number(j.target_value),
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save targets');

      // Optimistically close modal immediately
      setShowModal(false);
      setSubmitting(false);

      setSuccessMsg(
        L(
          `কর্মচারীর ${mergedList.length}টি কাজ সফলভাবে সংরক্ষণ করা হয়েছে`,
          `Successfully saved ${mergedList.length} jobs/targets for employee`
        )
      );

      fetchTargetsOnly();
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
        fetchTargetsOnly();
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
      if (selectedMetrics.length > 0 && !selectedMetrics.includes(t.metric_type)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const empName = t.employee?.name?.toLowerCase() || '';
        const empEmail = t.employee?.email?.toLowerCase() || '';
        const secName = t.section?.name?.toLowerCase() || '';
        const metricBn = METRIC_CONFIG[t.metric_type]?.bn?.toLowerCase() || '';
        const metricEn = METRIC_CONFIG[t.metric_type]?.en?.toLowerCase() || '';
        if (
          !empName.includes(q) &&
          !empEmail.includes(q) &&
          !secName.includes(q) &&
          !metricBn.includes(q) &&
          !metricEn.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [targets, filterEmployee, filterPeriod, selectedMetrics, searchQuery]);

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
        <div className="alert alert-success" role="status">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Notification */}
      {errorMsg && !showModal && (
        <div className="alert alert-error" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Stats Summary Cards */}
      {loading ? (
        <SkeletonStatCards count={4} label={L('টার্গেট তালিকা লোড হচ্ছে...', 'Loading targets...')} />
      ) : (
      <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Target className="h-4 w-4" />}
          label={L('মোট টার্গেট', 'Total Targets')}
          value={formatNum(stats.total)}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          tone="gray"
          label={L('টার্গেটপ্রাপ্ত কর্মী', 'Targeted Employees')}
          value={formatNum(stats.uniqueEmployees)}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          tone="gray"
          label={L('গড় পূরণ হার', 'Avg Achievement')}
          value={`${formatNum(stats.avgRate)}%`}
        />
        <StatCard
          icon={<Award className="h-4 w-4" />}
          label={L('লক্ষ্য পূরণ সম্পন্ন', 'Targets Met')}
          value={formatNum(stats.metCount)}
        />
      </div>
      )}

      {/* Advanced Multi-Option Filter Toolbar */}
      <div className="card space-y-4 p-4 sm:p-5">
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-12">
          {/* Search Box */}
          <div className="sm:col-span-4">
            <label className="label">
              {L('খুঁজুন (Search)', 'Search Employee / Section')}
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={L('কর্মী, গ্রুপ বা কাজের নাম...', 'Employee, group or task name...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-9 pr-8"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={L('খোঁজা মুছুন', 'Clear search')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Employee Filter */}
          <div className="sm:col-span-3">
            <label className="label">
              {L('কর্মচারী দিয়ে ফিল্টার', 'Filter by Employee')}
            </label>
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="input"
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
          <div className="sm:col-span-2">
            <label className="label">
              {L('সময়কাল', 'Period')}
            </label>
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="input"
            >
              <option value="ALL">{L('সব সময়কাল', 'All Periods')}</option>
              <option value="DAILY">{L('দৈনিক (Daily)', 'Daily')}</option>
              <option value="WEEKLY">{L('সাপ্তাহিক (Weekly)', 'Weekly')}</option>
              <option value="MONTHLY">{L('মাসিক (Monthly)', 'Monthly')}</option>
            </select>
          </div>

          {/* Advanced Multi-Select Task / Metric Filter */}
          <div className="sm:col-span-3 relative">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label mb-0">
                {L('কাজের ধরন (Multiple Options)', 'Tasks / Metrics (Multi-Select)')}
              </label>
              {selectedMetrics.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedMetrics([])}
                  className="text-[11px] font-medium text-brand-700 hover:text-brand-800"
                >
                  {L('ক্লিয়ার', 'Reset')}
                </button>
              )}
            </div>

            {/* Dropdown Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMetricDropdownOpen((prev) => !prev)}
              aria-haspopup="listbox"
              aria-expanded={isMetricDropdownOpen}
              className={`input flex cursor-pointer items-center justify-between text-left ${
                selectedMetrics.length > 0 ? 'border-brand-500 font-medium' : 'hover:bg-slate-50'
              }`}
            >
              <span className="truncate">
                {selectedMetrics.length === 0
                  ? L('সব কাজ (All Tasks)', 'All Tasks')
                  : L(`${selectedMetrics.length}টি কাজ নির্বাচিত`, `${selectedMetrics.length} Tasks Selected`)}
              </span>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                {selectedMetrics.length > 0 && (
                  <span className="inline-flex h-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold tabular-nums text-white">
                    {selectedMetrics.length}
                  </span>
                )}
                <ChevronDown
                  className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${
                    isMetricDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>

            {/* Multi-Select Dropdown Popover */}
            {isMetricDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setIsMetricDropdownOpen(false)}
                />
                <div className="animate-scale-in absolute right-0 top-full z-30 mt-1.5 w-full max-w-[calc(100vw-2rem)] space-y-0.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[var(--shadow-pop)] sm:w-72">
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100 mb-1">
                    <span className="text-xs font-semibold text-slate-700">
                      {L('এক বা একাধিক কাজ বেছে নিন', 'Select One or Multiple')}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleMetricFilter('ALL')}
                      className="text-[11px] text-slate-500 hover:text-slate-800"
                    >
                      {L('সব সিলেক্ট', 'Select All')}
                    </button>
                  </div>

                  {/* All Tasks Option */}
                  <div
                    onClick={() => toggleMetricFilter('ALL')}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      selectedMetrics.length === 0
                        ? 'bg-brand-50 font-medium text-brand-800'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {selectedMetrics.length === 0 ? (
                      <CheckSquare className="h-4 w-4 shrink-0 text-brand-600" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-400 shrink-0" />
                    )}
                    <span>{L('সব কাজ (All Tasks)', 'All Tasks')}</span>
                  </div>

                  {/* Individual Metric Options with Checkboxes */}
                  {Object.entries(METRIC_CONFIG).map(([key, cfg]) => {
                    const isChecked = selectedMetrics.includes(key);
                    const count = targets.filter((t) => t.metric_type === key).length;

                    return (
                      <div
                        key={key}
                        onClick={() => toggleMetricFilter(key)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-brand-50 font-medium text-brand-800'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 shrink-0 text-brand-600" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-400 shrink-0" />
                          )}
                          <span className="truncate">{L(cfg.bn, cfg.en)}</span>
                        </div>
                        <span className="ml-2 shrink-0 text-[11px] tabular-nums text-slate-400">
                          ({count})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Quick-Filter Pills/Chips (Interactive Multi-Select Row) */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
          <span className="mr-1 flex items-center gap-1 text-xs font-medium text-slate-500">
            <Filter className="h-3 w-3" />
            {L('দ্রুত বাছাই:', 'Quick Filter:')}
          </span>

          {/* All Chip */}
          <button
            type="button"
            onClick={() => toggleMetricFilter('ALL')}
            aria-pressed={selectedMetrics.length === 0}
            className={`press cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium tabular-nums transition-colors ${
              selectedMetrics.length === 0
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {L('সব কাজ', 'All')} ({targets.length})
          </button>

          {/* Chips for Each Metric */}
          {Object.entries(METRIC_CONFIG).map(([key, cfg]) => {
            const isSelected = selectedMetrics.includes(key);
            const count = targets.filter((t) => t.metric_type === key).length;

            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleMetricFilter(key)}
                aria-pressed={isSelected}
                className={`press inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-600/30'
                    : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{L(cfg.bn, cfg.en)}</span>
                <span
                  className={`text-[11px] tabular-nums ${
                    isSelected ? 'text-brand-700' : 'text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Targets Table / List */}
      <div className="card overflow-hidden">
        {loading ? (
          <SkeletonTable rows={6} cols={6} label={L('টার্গেট তালিকা লোড হচ্ছে...', 'Loading targets...')} />
        ) : filteredTargets.length === 0 ? (
          <EmptyState
            icon={<Target className="h-5 w-5" />}
            title={L('কোনো টার্গেট নির্ধারণ করা হয়নি', 'No targets found')}
            description={L(
              'কর্মচারীদের কাজের টার্গেট দিতে উপরের "নতুন টার্গেট দিন" বাটনে চাপুন।',
              'Click "Assign Target" above to assign work targets to your employees.'
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
            <table className="table-pro min-w-[960px]">
              <thead>
                <tr>
                  <th>{L('কর্মচারী (Employee)', 'Employee')}</th>
                  <th>{L('কাজের ধরন ও গ্রুপ', 'Task & Group')}</th>
                  <th>{L('সময়কাল', 'Period')}</th>
                  <th className="text-right">{L('টার্গেট লক্ষ্য', 'Target Value')}</th>
                  <th className="w-56">{L('চলমান অগ্রগতি (Progress)', 'Live Progress')}</th>
                  <th>{L('স্ট্যাটাস', 'Status')}</th>
                  <th className="text-right"><span className="sr-only">{L('অ্যাকশন', 'Actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredTargets.map((t) => {
                  const emp = t.employee || employees.find((e) => e.id === t.employee_id);
                  const cfg = METRIC_CONFIG[t.metric_type] || {
                    bn: t.metric_type,
                    en: t.metric_type,
                    unitBn: L('টি'),
                    unitEn: 'units',
                    isCurrency: false,
                  };
                  const targetNum = Number(t.target_value) || 0;
                  const achievedNum = Number(t.achieved_value) || 0;
                  const percentage = targetNum > 0 ? Math.min(Math.round((achievedNum / targetNum) * 100), 100) : 0;
                  const isMet = achievedNum >= targetNum && targetNum > 0;

                  return (
                    <tr key={t.id}>
                      {/* Employee Column */}
                      <td onClick={() => handleOpenEdit(t)} className="cursor-pointer" title={L('টার্গেট পরিবর্তন করতে ক্লিক করুন', 'Click to edit target')}>
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                            {emp?.name ? emp.name.slice(0, 1).toUpperCase() : 'E'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 hover:text-brand-700">
                              {emp?.name || L('সাধারণ / গ্রুপ লক্ষ্য', 'Unassigned / General')}
                            </div>
                            <div className="text-xs text-slate-500">{emp?.email || t.section?.name}</div>
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
                          <div className="text-xs text-slate-500">
                            {L('সাধারণ লক্ষ্য', 'General Target')}
                          </div>
                        )}
                      </td>

                      {/* Period Badge */}
                      <td onClick={() => handleOpenEdit(t)} className="cursor-pointer">
                        <span className="badge badge-gray whitespace-nowrap">
                          <Calendar className="h-3 w-3" />
                          {t.period_type === 'DAILY'
                            ? L('দৈনিক (প্রতিদিন)', 'Daily')
                            : t.period_type === 'WEEKLY'
                            ? L('সাপ্তাহিক', 'Weekly')
                            : L('মাসিক', 'Monthly')}
                        </span>
                      </td>

                      {/* Target Value (Click to edit) */}
                      <td className="text-right font-semibold tabular-nums text-slate-900">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(t)}
                          className="-mr-2 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 transition-colors hover:bg-slate-100"
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
                          <div className="flex items-center justify-between gap-2 text-xs font-medium tabular-nums">
                            <span className="text-slate-600">
                              {cfg.isCurrency ? formatMoney(achievedNum) : formatNum(achievedNum)} /{' '}
                              {cfg.isCurrency ? formatMoney(targetNum) : formatNum(targetNum)}
                            </span>
                            <span
                              className={`font-semibold ${
                                isMet
                                  ? 'text-emerald-700'
                                  : percentage >= 50
                                  ? 'text-slate-900'
                                  : 'text-amber-700'
                              }`}
                            >
                              {formatNum(percentage)}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isMet
                                  ? 'bg-emerald-500'
                                  : percentage >= 50
                                  ? 'bg-brand-500'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="whitespace-nowrap">
                        {isMet ? (
                          <span className="badge badge-green">
                            <Check className="h-3 w-3" />
                            {L('পূরণ হয়েছে', 'Target Met')}
                          </span>
                        ) : percentage > 0 ? (
                          <span className="badge badge-blue">
                            <TrendingUp className="h-3 w-3" />
                            {L('চলমান', 'In Progress')}
                          </span>
                        ) : (
                          <span className="badge badge-gray">
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
                            className="btn-icon h-8 w-8"
                            title={L('সম্পাদনা', 'Edit target')}
                            aria-label={L('সম্পাদনা', 'Edit target')}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(t.id)}
                            className="btn-icon h-8 w-8 hover:bg-rose-50 hover:text-rose-600"
                            title={L('মুছুন', 'Delete target')}
                            aria-label={L('মুছুন', 'Delete target')}
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
          <div className="modal-panel flex flex-col overflow-hidden sm:max-w-2xl" role="dialog" aria-modal="true" aria-labelledby="target-modal-title">
            <div className="card-header shrink-0 flex-nowrap items-start">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-600/10">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 id="target-modal-title" className="card-title">
                    {editingTarget
                      ? L('কর্মচারীর কাজ ও টার্গেট সম্পাদনা করুন', 'Edit Employee Jobs & Targets')
                      : L('কর্মচারীকে এক বা একাধিক কাজ নির্ধারণ করুন', 'Assign Jobs & Targets to Employee')}
                  </h3>
                  <p className="card-subtitle mt-0.5">
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
                className="btn-icon shrink-0"
                aria-label={L('বন্ধ করুন', 'Close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto px-5 pt-5">
              {errorMsg && (
                <div className="alert alert-error" role="alert">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* 1. Select Existing Employee */}
              <div>
                <label className="label">
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
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
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
                      className="cursor-pointer font-medium text-brand-700 hover:text-brand-800 hover:underline"
                    >
                      {L('বিদ্যমান কাজগুলো লোড করুন', 'Load Existing Jobs')}
                    </button>
                  </div>
                )}
              </div>

              {/* 2. Target Period & Date in 2 columns */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">
                    {L('সময়কাল (Period) *', 'Period *')}
                  </label>
                  <select
                    value={form.period_type}
                    onChange={(e) => setForm({ ...form, period_type: e.target.value })}
                    className="input"
                  >
                    <option value="DAILY">{L('প্রতিদিন (Daily)', 'Daily')}</option>
                    <option value="WEEKLY">{L('সাপ্তাহিক (Weekly)', 'Weekly')}</option>
                    <option value="MONTHLY">{L('মাসিক (Monthly)', 'Monthly')}</option>
                  </select>
                </div>

                <div>
                  <label className="label">
                    {form.period_type === 'DAILY'
                      ? L('কার্যকর তারিখ (Date)', 'Effective Date')
                      : L('শুরুর তারিখ / মাস (Start Date / Month)', 'Start Date / Month')}
                  </label>
                  <input
                    type="date"
                    value={form.period_start}
                    onChange={(e) => setForm({ ...form, period_start: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              {/* 3. Assigned Jobs List (Multiple Jobs) */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <ListPlus className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-900">
                      {L('কাজের তালিকা ও লক্ষ্যমাত্রা (Jobs & Quotas)', 'Jobs & Quotas')}
                    </span>
                    <span className="badge badge-gray tabular-nums">
                      {jobs.length} {L('টি কাজ', 'Jobs')}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {L('একত্রে একাধিক কাজ যোগ করতে পারেন', 'Add multiple jobs for this employee')}
                  </span>
                </div>

                {/* Job Cards */}
                <div className="space-y-3">
                  {jobs.map((job, idx) => {
                    const cfg = METRIC_CONFIG[job.metric_type] || {
                      bn: job.metric_type,
                      en: job.metric_type,
                      unitBn: L('টি'),
                      unitEn: 'units',
                      isCurrency: false,
                    };

                    return (
                      <div
                        key={idx}
                        className="relative space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition-colors hover:border-slate-300"
                      >
                        {/* Job Item Header */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold tabular-nums text-slate-600 ring-1 ring-inset ring-slate-200">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-medium text-slate-900">
                              {L(`কাজ #${idx + 1}`, `Job #${idx + 1}`)}: {L(cfg.bn, cfg.en)}
                            </span>
                            {job.id && (
                              <span className="badge badge-blue">
                                {L('বিদ্যমান', 'Existing')}
                              </span>
                            )}
                          </div>

                          {jobs.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveJob(idx)}
                              className="btn-icon h-8 w-8 shrink-0 hover:bg-rose-50 hover:text-rose-600"
                              title={L('এই কাজটি মুছুন', 'Remove this job')}
                              aria-label={L('এই কাজটি মুছুন', 'Remove this job')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        {/* Job Item Inputs */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                          {/* Task / Metric Dropdown */}
                          <div className={job.metric_type === 'POSTS_DONE' ? 'sm:col-span-5' : 'sm:col-span-8'}>
                            <label className="label">
                              {L('কাজের ধরন (Task / Metric) *', 'Task / Metric *')}
                            </label>
                            <select
                              value={job.metric_type}
                              onChange={(e) => handleUpdateJob(idx, 'metric_type', e.target.value)}
                              className="input"
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
                              <label className="label">
                                {L('গ্রুপ / সাব-গ্রুপ (Section)', 'Group Section')}
                              </label>
                              <select
                                value={job.section_id}
                                onChange={(e) => handleUpdateJob(idx, 'section_id', e.target.value)}
                                className="input"
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
                            <label className="label">
                              {L('টার্গেট সংখ্যা (Quota) *', 'Target Quota *')}
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={job.target_value}
                                onChange={(e) => handleUpdateJob(idx, 'target_value', e.target.value)}
                                className="input pr-12 tabular-nums"
                                placeholder="5"
                                required
                              />
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
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
                  className="btn w-full border border-dashed border-slate-300 bg-white text-slate-700 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-800"
                >
                  <Plus className="h-4 w-4" />
                  <span>{L('+ আরও একটি কাজ যোগ করুন', '+ Add Another Job / Task')}</span>
                </button>

                {/* Multiple Jobs & Auto-Merge Pro-Tip */}
                <div className="alert alert-info text-xs">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-1">
                    <div className="font-medium">
                      {L('স্বয়ংক্রিয় মার্জ সক্রিয় (Auto-Merge Active):', 'Automatic Merge Active:')}
                    </div>
                    <div>
                      {L(
                        'একই কাজের ধরন ও সেকশন বারবার দিলে তা ডুপ্লিকেট হবে না, স্বয়ংক্রিয়ভাবে একটি কাজে মার্জ হয়ে কোটা যোগ হয়ে যাবে (যেমন: মাশরুম গ্রুপ ২ ও ৩ দিলে একসাথে ৫ হয়ে যাবে)।',
                        'Selecting duplicate job & group section will automatically merge them into one and sum their quotas (e.g. 2 and 3 merge into 5).'
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 -mx-5 flex items-center justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  {L('বাতিল', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
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
