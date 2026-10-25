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
  const L = (bn: string, en: string) => (lang === 'en' ? en : bn);

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
  const [form, setForm] = useState({
    employee_id: '',
    section_id: '',
    metric_type: 'POSTS_DONE',
    target_value: '',
    period_type: 'DAILY',
    period_start: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
  });

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
        if (d.employees?.length > 0 && !form.employee_id) {
          setForm((prev) => ({ ...prev, employee_id: d.employees[0].id }));
        }
      }
      if (sRes.ok) {
        const d = await sRes.json();
        setSections(d.sections || []);
        if (d.sections?.length > 0 && !form.section_id) {
          setForm((prev) => ({ ...prev, section_id: d.sections[0].id }));
        }
      }
    } catch {
      setErrorMsg(L('ডাটা লোড করতে সমস্যা হয়েছে', 'Failed to load data'));
    } finally {
      setLoading(false);
    }
  }, [L, form.employee_id, form.section_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingTarget(null);
    setForm({
      employee_id: employees[0]?.id || '',
      section_id: sections[0]?.id || '',
      metric_type: 'POSTS_DONE',
      target_value: '50',
      period_type: 'DAILY',
      period_start: new Date().toISOString().slice(0, 10),
    });
    setErrorMsg('');
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (t: SectionTarget) => {
    setEditingTarget(t);
    setForm({
      employee_id: t.employee_id || t.employee?.id || '',
      section_id: t.section_id || sections[0]?.id || '',
      metric_type: t.metric_type,
      target_value: String(t.target_value),
      period_type: t.period_type,
      period_start: t.period_start ? t.period_start.slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
    setErrorMsg('');
    setShowModal(true);
  };

  // Save Target (Add or Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.target_value || Number(form.target_value) <= 0) {
      setErrorMsg(L('সঠিক টার্গেট সংখ্যা দিন', 'Enter a valid target quantity'));
      return;
    }
    if (!form.section_id && sections.length > 0) {
      setErrorMsg(L('গ্রুপ বা সেকশন নির্বাচন করুন', 'Select a group section'));
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      if (editingTarget) {
        // Update
        const res = await fetch(`/api/targets/${editingTarget.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_value: Number(form.target_value),
            employee_id: form.employee_id || null,
            period_start: form.period_start || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update target');
        setSuccessMsg(L('টার্গেট সফলভাবে আপডেট করা হয়েছে', 'Target updated successfully'));
      } else {
        // Create
        const res = await fetch('/api/targets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section_id: form.section_id || sections[0]?.id,
            employee_id: form.employee_id || null,
            metric_type: form.metric_type,
            target_value: Number(form.target_value),
            period_type: form.period_type,
            period_start: form.period_start || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to assign target');
        setSuccessMsg(L('কর্মচারীর টার্গেট সফলভাবে নির্ধারণ করা হয়েছে', 'Target assigned successfully'));
      }

      setShowModal(false);
      fetchData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || L('টার্গেট সংরক্ষণ ব্যর্থ হয়েছে', 'Failed to save target'));
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
                    <tr key={t.id}>
                      {/* Employee Column */}
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-xs">
                            {emp?.name ? emp.name.slice(0, 1).toUpperCase() : 'E'}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">
                              {emp?.name || L('সাধারণ / গ্রুপ লক্ষ্য', 'Unassigned / Team')}
                            </div>
                            <div className="text-xs text-slate-400">{emp?.email || t.section?.name}</div>
                          </div>
                        </div>
                      </td>

                      {/* Task & Group Section */}
                      <td>
                        <div className="font-medium text-slate-800">{L(cfg.bn, cfg.en)}</div>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Layers className="h-3 w-3 text-slate-400" />
                          <span>{t.section?.name || L('সব গ্রুপ', 'All Groups')}</span>
                        </div>
                      </td>

                      {/* Period Badge */}
                      <td>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                          <Calendar className="h-3 w-3 text-slate-500" />
                          {t.period_type === 'DAILY'
                            ? L('দৈনিক (প্রতিদিন)', 'Daily')
                            : t.period_type === 'WEEKLY'
                            ? L('সাপ্তাহিক', 'Weekly')
                            : L('মাসিক', 'Monthly')}
                        </span>
                      </td>

                      {/* Target Value */}
                      <td className="text-right font-mono font-bold text-slate-900">
                        {cfg.isCurrency
                          ? formatMoney(targetNum)
                          : `${formatNum(targetNum)} ${L(cfg.unitBn, cfg.unitEn)}`}
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
          <div className="modal-panel max-w-lg">
            <div className="card-header">
              <div>
                <h3 className="card-title">
                  {editingTarget
                    ? L('টার্গেট সম্পাদনা করুন', 'Edit Employee Target')
                    : L('কর্মচারীকে নতুন টার্গেট নির্ধারণ করুন', 'Assign Target to Employee')}
                </h3>
                <p className="card-subtitle">
                  {L(
                    'কর্মচারী নির্বাচন করে কাজের সংখ্যা ও সময়কাল নির্ধারণ করুন',
                    'Select employee, choose task metric and set target quota'
                  )}
                </p>
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

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {errorMsg && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
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
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
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
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {L('যেকোনো বিদ্যমান কর্মচারীকে নির্বাচন করুন', 'Target will be assigned specifically to this employee')}
                </span>
              </div>

              {/* 2. Select Task / Metric Type */}
              <div>
                <label className="label">
                  {L('কাজের ধরন (Task / Metric) *', 'Task / Metric *')}
                </label>
                <select
                  value={form.metric_type}
                  onChange={(e) => setForm({ ...form, metric_type: e.target.value })}
                  className="input"
                  required
                >
                  {Object.entries(METRIC_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>
                      {L(cfg.bn, cfg.en)}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Group Section Selection */}
              <div>
                <label className="label">
                  {L('গ্রুপ বা সেকশন (Group Section) *', 'Group Section *')}
                </label>
                <select
                  value={form.section_id}
                  onChange={(e) => setForm({ ...form, section_id: e.target.value })}
                  className="input"
                  required
                >
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Target Value & Period in 2 columns */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">
                    {L('টার্গেট সংখ্যা (Quota) *', 'Target Quantity *')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.target_value}
                    onChange={(e) => setForm({ ...form, target_value: e.target.value })}
                    className="input font-mono"
                    placeholder="e.g. 50"
                    required
                  />
                </div>
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
              </div>

              {/* Date / Month Picker */}
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

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 mt-6">
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
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editingTarget
                    ? L('আপডেট সংরক্ষণ করুন', 'Save Changes')
                    : L('টার্গেট নিশ্চিত করুন', 'Assign Target')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
