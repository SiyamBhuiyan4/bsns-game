'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  KeyRound,
  Edit3,
  Layers,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Check,
  EyeOff,
  Search,
  Phone,
  Mail,
  X,
  Eye,
  ExternalLink,
  Clock,
  Target,
  ArrowUpRight,
  Briefcase,
  Lock,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonStatCards, SkeletonTable } from '@/components/ui/Skeleton';
import { useLanguage } from '@/components/LanguageContext';
import Avatar from '@/components/ui/Avatar';

interface SectionRef {
  id: string;
  name: string;
  post_limit?: number | null;
}

interface EmployeeItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  can_view_all_customers?: boolean;
  created_at: string;
  sections: SectionRef[];
  total_completed_links: number;
  total_leads: number;
}

export default function EmployeesPage() {
  const { t, L } = useLanguage();
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [sections, setSections] = useState<SectionRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add Employee Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addPassword, setAddPassword] = useState('');

  // Deep links from the assistant: ?q=<search>, ?add=1, ?name=<prefill>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) setSearchQuery(q);
    if (params.get('add') === '1') {
      setAddName(params.get('name') ?? '');
      setIsAddOpen(true);
    }
  }, []);
  const [addSelectedSections, setAddSelectedSections] = useState<string[]>([]);
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Edit Employee Modal
  const [editingEmp, setEditingEmp] = useState<EmployeeItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editCanViewAllCustomers, setEditCanViewAllCustomers] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Assign Sections Modal
  const [assigningEmp, setAssigningEmp] = useState<EmployeeItem | null>(null);
  const [assignSelectedSections, setAssignSelectedSections] = useState<string[]>([]);
  const [assignSectionLimits, setAssignSectionLimits] = useState<Record<string, number | ''>>({});
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // Reset Password Modal
  const [resetEmp, setResetEmp] = useState<EmployeeItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  // Employee Work Profile Modal
  const [workModalEmp, setWorkModalEmp] = useState<EmployeeItem | null>(null);
  const [workData, setWorkData] = useState<any>(null);
  const [loadingWorkData, setLoadingWorkData] = useState(false);
  const [workActiveTab, setWorkActiveTab] = useState<'TASKS' | 'POSTS' | 'LEADS'>('TASKS');

  const handleOpenWorkProfile = async (emp: EmployeeItem) => {
    setWorkModalEmp(emp);
    setLoadingWorkData(true);
    setWorkActiveTab('TASKS');
    try {
      const res = await fetch(`/api/admin/employees/${emp.id}/work`);
      if (res.ok) {
        const d = await res.json();
        setWorkData(d);
      }
    } catch {
      setErrorMessage(L('কর্মীর কাজের বিবরণ লোড করতে সমস্যা হয়েছে'));
    } finally {
      setLoadingWorkData(false);
    }
  };

  const openAssignSectionsModal = (emp: EmployeeItem) => {
    setAssigningEmp(emp);
    setAssignSelectedSections(emp.sections.map((s) => s.id));
    const initialLimits: Record<string, number | ''> = {};
    emp.sections.forEach((s) => {
      if (s.post_limit && s.post_limit > 0) {
        initialLimits[s.id] = s.post_limit;
      }
    });
    setAssignSectionLimits(initialLimits);
    setErrorMessage(null);
  };

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/employees');
      const data = await res.json();
      if (res.ok) {
        setEmployees(data.employees || []);
      } else {
        setErrorMessage(data.error || L('কর্মী তালিকা লোড করা যায়নি'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক সমস্যা'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSections = async () => {
    try {
      const res = await fetch('/api/admin/sections');
      const data = await res.json();
      if (res.ok) {
        setSections(data.sections || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchSections();
  }, [fetchEmployees]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addName,
          email: addEmail,
          phone: addPhone,
          password: addPassword,
          sectionIds: addSelectedSections,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(L('নতুন কর্মী সফলভাবে যোগ করা হয়েছে (Employee created)'));
        setIsAddOpen(false);
        setAddName('');
        setAddEmail('');
        setAddPhone('');
        setAddPassword('');
        setAddSelectedSections([]);
        fetchEmployees();
      } else {
        setErrorMessage(data.error || L('কর্মী যোগ করা যায়নি'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক ত্রুটি'));
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp) return;
    setEditSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/employees/${editingEmp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          phone: editPhone,
          email: editEmail,
          is_active: editActive,
          can_view_all_customers: editCanViewAllCustomers,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(L('কর্মী তথ্য আপডেট সফল হয়েছে'));
        setEditingEmp(null);
        fetchEmployees();
      } else {
        setErrorMessage(data.error || L('আপডেট ব্যর্থ হয়েছে'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক ত্রুটি'));
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleSaveAssignments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningEmp) return;
    setAssignSubmitting(true);
    setErrorMessage(null);

    try {
      const cleanLimits: Record<string, number | null> = {};
      assignSelectedSections.forEach((secId) => {
        const val = assignSectionLimits[secId];
        cleanLimits[secId] = typeof val === 'number' && val > 0 ? val : null;
      });

      const res = await fetch(`/api/admin/employees/${assigningEmp.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionIds: assignSelectedSections,
          limits: cleanLimits,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage(L('সেকশন অ্যাসাইনমেন্ট ও পোস্ট লিমিট সংরক্ষিত হয়েছে'));
        setAssigningEmp(null);
        fetchEmployees();
      } else {
        setErrorMessage(data.error || L('অ্যাসাইনমেন্ট ব্যর্থ হয়েছে'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক ত্রুটি'));
    } finally {
      setAssignSubmitting(false);
    }
  };

  const openReset = (emp: EmployeeItem) => {
    setResetEmp(emp);
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setResetError(null);
    setResetDone(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmp) return;
    if (newPassword.length < 6) {
      setResetError(t('emp.pw_short', 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে', 'Password must be at least 6 characters'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError(t('emp.pw_mismatch', 'দুটি পাসওয়ার্ড মেলেনি', 'The two passwords do not match'));
      return;
    }
    setResetSubmitting(true);
    setResetError(null);

    try {
      const res = await fetch(`/api/admin/employees/${resetEmp.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResetDone(true);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setResetError(data.error || L('পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে'));
      }
    } catch {
      setResetError(L('নেটওয়ার্ক ত্রুটি'));
    } finally {
      setResetSubmitting(false);
    }
  };

  const filteredEmployees = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.phone && e.phone.includes(searchQuery))
  );

  const activeCount = employees.filter((e) => e.is_active).length;
  const totalDone = employees.reduce((acc, e) => acc + e.total_completed_links, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Users className="h-5 w-5" />}
        title={t('emp.title', 'কর্মী', 'Employees')}
        subtitle={t('emp.subtitle', 'কর্মীদের প্রোফাইল, সেকশন ও পাসওয়ার্ড পরিচালনা করুন', 'Manage employee profiles, sections and passwords')}
        actions={
          <button
            onClick={() => {
              setIsAddOpen(true);
              setErrorMessage(null);
            }}
            className="btn btn-primary"
          >
            <UserPlus className="h-4 w-4" />
            {t('emp.add', 'কর্মী যোগ করুন', 'Add employee')}
          </button>
        }
      />

      {/* Notifications */}
      {errorMessage && (
        <div className="alert alert-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{L(errorMessage)}</span>
          <button onClick={() => setErrorMessage(null)} className="btn-icon -my-1 h-6 w-6" aria-label={t('common.dismiss', 'বন্ধ করুন', 'Dismiss')}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{L(successMessage)}</span>
          <button onClick={() => setSuccessMessage(null)} className="btn-icon -my-1 h-6 w-6" aria-label={t('common.dismiss', 'বন্ধ করুন', 'Dismiss')}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stats row */}
      {loading ? (
        <SkeletonStatCards count={4} label={t('common.loading', 'লোড হচ্ছে...', 'Loading...')} />
      ) : (
      <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('emp.total', 'মোট কর্মী', 'Total')} value={employees.length} icon={<Users className="h-4 w-4" />} tone="gray" />
        <StatCard label={t('emp.active', 'সক্রিয়', 'Active')} value={activeCount} icon={<CheckCircle className="h-4 w-4" />} tone="brand" />
        <StatCard label={t('emp.inactive', 'নিষ্ক্রিয়', 'Inactive')} value={employees.length - activeCount} icon={<XCircle className="h-4 w-4" />} tone="gray" />
        <StatCard label={t('emp.done_links', 'সম্পন্ন লিংক', 'Completed links')} value={totalDone} icon={<Layers className="h-4 w-4" />} tone="blue" />
      </div>
      )}

      {/* Employees Table */}
      <div className="card">
        <div className="card-header">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              aria-label={t('emp.search', 'খুঁজুন', 'Search')}
              placeholder={t('emp.search_ph', 'নাম, মোবাইল বা ইমেইল...', 'Name, phone or email...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9"
            />
          </div>
          <span className="card-subtitle">
            {filteredEmployees.length} / {employees.length}
          </span>
        </div>

        {loading ? (
          <SkeletonTable rows={6} cols={6} label={t('common.loading', 'লোড হচ্ছে...', 'Loading...')} />
        ) : filteredEmployees.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title={t('emp.empty', 'কোনো কর্মী পাওয়া যায়নি', 'No employees found')}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-pro">
              <thead>
                <tr>
                  <th>{t('emp.col_name', 'কর্মী', 'Employee')}</th>
                  <th>{t('emp.col_email', 'ইমেইল', 'Email')}</th>
                  <th>{t('emp.col_sections', 'সেকশন', 'Sections')}</th>
                  <th className="text-right">{t('emp.col_done', 'সম্পন্ন', 'Done')}</th>
                  <th>{t('emp.col_status', 'স্ট্যাটাস', 'Status')}</th>
                  <th className="text-right">
                    <span className="sr-only">{t('emp.col_actions', 'কার্যক্রম', 'Actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id}>
                    <td
                      onClick={() => handleOpenWorkProfile(emp)}
                      className="cursor-pointer group"
                      title={t('emp.click_view_work', 'কাজের বিবরণ ও ইতিহাস দেখতে ক্লিক করুন', 'Click to view employee work & history')}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={emp.name} size={36} animated={false} />
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 transition-colors group-hover:text-brand-700">
                            {emp.name}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                            <Phone className="h-3 w-3" />
                            <span className="tabular-nums">{emp.phone || '—'}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="text-sm text-slate-600">
                      <span className="block max-w-[220px] truncate" title={emp.email}>{emp.email}</span>
                    </td>

                    <td>
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {emp.sections.length === 0 ? (
                          <span className="text-xs text-slate-400">{t('emp.no_sections', 'নেই', 'None')}</span>
                        ) : (
                          emp.sections.map((sec) => (
                            <span key={sec.id} className="badge badge-gray inline-flex items-center gap-1">
                              <span>{sec.name}</span>
                              {sec.post_limit && sec.post_limit > 0 && (
                                <span className="text-slate-400 tabular-nums">
                                  ({sec.post_limit}{L("টি)")}
                                </span>
                              )}
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    <td className="text-right tabular-nums font-medium text-slate-900">{emp.total_completed_links}</td>

                    <td>
                      <div className="flex flex-col gap-1 items-start">
                        {emp.is_active ? (
                          <span className="badge badge-green">{t('emp.active', 'সক্রিয়', 'Active')}</span>
                        ) : (
                          <span className="badge badge-gray">{t('emp.inactive', 'নিষ্ক্রিয়', 'Inactive')}</span>
                        )}
                        {emp.can_view_all_customers && (
                          <span
                            className="badge badge-violet"
                            title={t('emp.has_cust_access', 'সম্পূর্ণ কাস্টমার ডেটাবেস দেখার অনুমতি রয়েছে', 'Has full customer database access')}
                          >
                            {t('emp.all_cust_badge', 'পূর্ণ কাস্টমার এক্সেস', 'Full Leads Access')}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-0.5">
                        {/* View Work & Tasks */}
                        <button
                          type="button"
                          onClick={() => handleOpenWorkProfile(emp)}
                          className="btn-icon h-8 w-8"
                          title={t('emp.view_work', 'কাজের বিবরণ ও হিস্ট্রি দেখুন', 'View work & history')}
                          aria-label={t('emp.view_work', 'কাজের বিবরণ ও হিস্ট্রি দেখুন', 'View work & history')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* Assign Sections */}
                        <button
                          onClick={() => {
                            setAssigningEmp(emp);
                            setAssignSelectedSections(emp.sections.map((s) => s.id));
                            const initialLimits: Record<string, number | ''> = {};
                            emp.sections.forEach((s) => {
                              if (s.post_limit && s.post_limit > 0) {
                                initialLimits[s.id] = s.post_limit;
                              }
                            });
                            setAssignSectionLimits(initialLimits);
                            setErrorMessage(null);
                          }}
                          className="btn-icon h-8 w-8"
                          title={t('emp.assign', 'সেকশন অ্যাসাইন', 'Assign sections')}
                          aria-label={t('emp.assign', 'সেকশন অ্যাসাইন', 'Assign sections')}
                        >
                          <Layers className="h-4 w-4" />
                        </button>

                        {/* Reset Password */}
                        <button
                          onClick={() => openReset(emp)}
                          className="btn-icon h-8 w-8"
                          title={t('emp.reset', 'পাসওয়ার্ড রিসেট', 'Reset password')}
                          aria-label={t('emp.reset', 'পাসওয়ার্ড রিসেট', 'Reset password')}
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => {
                            setEditingEmp(emp);
                            setEditName(emp.name);
                            setEditPhone(emp.phone || '');
                            setEditEmail(emp.email);
                            setEditActive(emp.is_active);
                            setEditCanViewAllCustomers(!!emp.can_view_all_customers);
                            setErrorMessage(null);
                          }}
                          className="btn-icon h-8 w-8"
                          title={t('emp.edit', 'সম্পাদনা', 'Edit')}
                          aria-label={t('emp.edit', 'সম্পাদনা', 'Edit')}
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add Employee */}
      {isAddOpen && (
        <div className="modal-backdrop">
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="add-emp-title">
            <div className="card-header">
              <h3 id="add-emp-title" className="card-title">{t('emp.add_title', 'নতুন কর্মী', 'New employee')}</h3>
            </div>

            <form onSubmit={handleAddEmployee}>
              <div className="card-body space-y-4">
                <div>
                  <label htmlFor="add_emp_name" className="label">{t('emp.f_name', 'নাম', 'Name')} *</label>
                  <input
                    id="add_emp_name"
                    type="text"
                    required
                    placeholder={L("যেমন: রাকিব হাসান")}
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    className="input"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="add_emp_email" className="label">{t('emp.f_email', 'ইমেইল', 'Email')} *</label>
                    <input
                      id="add_emp_email"
                      type="email"
                      required
                      placeholder="employee@example.com"
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      className="input"
                    />
                  </div>

                  <div>
                    <label htmlFor="add_emp_phone" className="label">{t('emp.f_phone', 'মোবাইল', 'Phone')} *</label>
                    <input
                      id="add_emp_phone"
                      type="tel"
                      required
                      placeholder="017XXXXXXXX"
                      value={addPhone}
                      onChange={(e) => setAddPhone(e.target.value)}
                      className="input tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="add_emp_pw" className="label">{t('emp.f_password', 'পাসওয়ার্ড', 'Password')} *</label>
                  <input
                    id="add_emp_pw"
                    type="password"
                    required
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    className="input"
                  />
                  <p className="hint">{t('emp.pw_hint', 'ন্যূনতম ৬ অক্ষর', 'At least 6 characters')}</p>
                </div>

                {/* Assign Sections Checkbox List */}
                <fieldset>
                  <legend className="label">{t('emp.col_sections', 'সেকশন', 'Sections')}</legend>
                  <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
                    {sections.map((sec) => (
                      <label key={sec.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={addSelectedSections.includes(sec.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAddSelectedSections([...addSelectedSections, sec.id]);
                            } else {
                              setAddSelectedSections(addSelectedSections.filter((id) => id !== sec.id));
                            }
                          }}
                          className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                        />
                        <span>{sec.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={() => setIsAddOpen(false)} className="btn btn-secondary">
                  {t('common.cancel', 'বাতিল', 'Cancel')}
                </button>
                <button type="submit" disabled={addSubmitting} className="btn btn-primary">
                  {addSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t('emp.create', 'তৈরি করুন', 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Employee */}
      {editingEmp && (
        <div className="modal-backdrop">
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="edit-emp-title">
            <div className="card-header">
              <h3 id="edit-emp-title" className="card-title">{t('emp.edit_title', 'কর্মী সম্পাদনা', 'Edit employee')}</h3>
            </div>

            <form onSubmit={handleEditEmployee}>
              <div className="card-body space-y-4">
                <div>
                  <label htmlFor="edit_emp_name" className="label">{t('emp.f_name', 'নাম', 'Name')} *</label>
                  <input
                    id="edit_emp_name"
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label htmlFor="edit_emp_phone" className="label">{t('emp.f_phone', 'মোবাইল', 'Phone')}</label>
                  <input
                    id="edit_emp_phone"
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="input tabular-nums"
                  />
                </div>

                <div>
                  <label htmlFor="edit_emp_email" className="label">{t('emp.f_email', 'ইমেইল', 'Email')} *</label>
                  <input
                    id="edit_emp_email"
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="input"
                  />
                </div>

                <label htmlFor="edit_emp_active" className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    id="edit_emp_active"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                  />
                  {t('emp.f_active', 'অ্যাকাউন্ট সক্রিয়', 'Account active')}
                </label>

                <label
                  htmlFor="edit_emp_can_view_all_customers"
                  className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 transition-colors hover:bg-slate-100/70"
                >
                  <input
                    type="checkbox"
                    id="edit_emp_can_view_all_customers"
                    checked={editCanViewAllCustomers}
                    onChange={(e) => setEditCanViewAllCustomers(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-600"
                  />
                  <div>
                    <span className="font-medium text-slate-900">
                      {t(
                        'emp.grant_customer_db_access',
                        'সম্পূর্ণ কাস্টমার ডেটাবেস দেখার অনুমতি দিন',
                        'Grant Full Customer Database Access'
                      )}
                    </span>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {t(
                        'emp.grant_customer_db_desc',
                        'অনুমোদন দিলে এই কর্মী নিজের ও অন্যান্য সকল কর্মীর যুক্ত করা কাস্টমার তালিকা দেখতে পারবেন',
                        'When granted, this employee can view all customers across the company database'
                      )}
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={() => setEditingEmp(null)} className="btn btn-secondary">
                  {t('common.cancel', 'বাতিল', 'Cancel')}
                </button>
                <button type="submit" disabled={editSubmitting} className="btn btn-primary">
                  {editSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t('common.save', 'সংরক্ষণ', 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assign Sections */}
      {assigningEmp && (
        <div className="modal-backdrop">
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="assign-emp-title">
            <div className="card-header">
              <div>
                <h3 id="assign-emp-title" className="card-title">{t('emp.assign', 'সেকশন অ্যাসাইন', 'Assign sections')}</h3>
                <p className="card-subtitle mt-0.5">
                  {assigningEmp.name} · {assigningEmp.email}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveAssignments}>
              <div className="card-body">
                <div className="mb-3 text-xs text-slate-500">
                  {t(
                    'emp.assign_info',
                    'যে যে সাব-গ্রুপে পোস্ট দিতে পারবে সেগুলো নির্বাচন করুন এবং প্রতিটি সাব-গ্রুপের জন্য বাধ্যতামূলক পোস্ট লিমিট / কোটা লিখে দিন।',
                    'Check sub-groups and set mandatory post limits/quotas per group.'
                  )}
                </div>

                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {sections.map((sec) => {
                    const isChecked = assignSelectedSections.includes(sec.id);
                    return (
                      <div
                        key={sec.id}
                        className={`rounded-lg border p-3 transition-colors ${
                          isChecked ? 'border-brand-300 bg-brand-50/40' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-800 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAssignSelectedSections([...assignSelectedSections, sec.id]);
                                } else {
                                  setAssignSelectedSections(assignSelectedSections.filter((id) => id !== sec.id));
                                  const updatedLimits = { ...assignSectionLimits };
                                  delete updatedLimits[sec.id];
                                  setAssignSectionLimits(updatedLimits);
                                }
                              }}
                              className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                            />
                            <span className="truncate">{sec.name}</span>
                          </label>

                          {isChecked && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-xs text-slate-500 font-medium">
                                {t('emp.post_limit', 'পোস্ট কোটা:', 'Quota:')}
                              </span>
                              <input
                                type="number"
                                min="1"
                                placeholder={t('emp.unlimited', 'যেমন: ৩', 'e.g. 3')}
                                value={assignSectionLimits[sec.id] ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                                  setAssignSectionLimits((prev) => ({
                                    ...prev,
                                    [sec.id]: val,
                                  }));
                                }}
                                className="input input-sm w-20 text-right tabular-nums"
                              />
                              <span className="text-xs text-slate-500">
                                {t('common.posts_unit', 'টি', 'posts')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quota Summary Calculation */}
                {assignSelectedSections.length > 0 && (
                  <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
                    <span className="text-slate-600">
                      {t('emp.total_quota', 'মোট নির্ধারিত পোস্ট কোটা:', 'Total Assigned Quota:')}
                    </span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {assignSelectedSections.reduce((sum, id) => {
                        const val = assignSectionLimits[id];
                        return sum + (typeof val === 'number' && val > 0 ? val : 0);
                      }, 0)}{' '}
                      {t('common.posts_unit', 'টি পোস্ট', 'posts')}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={() => setAssigningEmp(null)} className="btn btn-secondary">
                  {t('common.cancel', 'বাতিল', 'Cancel')}
                </button>
                <button type="submit" disabled={assignSubmitting} className="btn btn-primary">
                  {assignSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t('common.save', 'সংরক্ষণ', 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Password */}
      {resetEmp && (
        <div className="modal-backdrop">
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="reset-emp-title">
            <div className="card-header">
              <div>
                <h3 id="reset-emp-title" className="card-title">{t('emp.reset', 'পাসওয়ার্ড রিসেট', 'Reset password')}</h3>
                <p className="card-subtitle mt-0.5">
                  {resetEmp.name} · {resetEmp.email}
                </p>
              </div>
            </div>

            {resetDone ? (
              <>
                <div className="card-body">
                  <div className="alert alert-success">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {t(
                        'emp.pw_set',
                        'নতুন পাসওয়ার্ড সেট হয়েছে। আগের পাসওয়ার্ড আর কাজ করবে না। কর্মীকে নতুনটি জানিয়ে দিন।',
                        'New password set. The old one no longer works. Let the employee know the new one.'
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex justify-end border-t border-slate-100 px-5 py-4">
                  <button type="button" onClick={() => setResetEmp(null)} className="btn btn-secondary">
                    {t('common.close', 'বন্ধ করুন', 'Close')}
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleResetPassword}>
                <div className="card-body space-y-4">
                  <div>
                    <label htmlFor="reset-new-pw" className="label">
                      {t('emp.new_pw', 'নতুন পাসওয়ার্ড', 'New password')}
                    </label>
                    <div className="relative">
                      <input
                        id="reset-new-pw"
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="input pr-10"
                        autoComplete="new-password"
                        minLength={6}
                        maxLength={128}
                        required
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="btn-icon absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                        aria-label={showPassword ? t('emp.hide_pw', 'পাসওয়ার্ড লুকান', 'Hide password') : t('emp.show_pw', 'পাসওয়ার্ড দেখুন', 'Show password')}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{t('emp.pw_hint', 'কমপক্ষে ৬ অক্ষর', 'At least 6 characters')}</p>
                  </div>
                  <div>
                    <label htmlFor="reset-confirm-pw" className="label">
                      {t('emp.confirm_pw', 'পাসওয়ার্ড আবার লিখুন', 'Confirm password')}
                    </label>
                    <input
                      id="reset-confirm-pw"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input"
                      autoComplete="new-password"
                      maxLength={128}
                      required
                    />
                  </div>
                  {resetError && (
                    <div className="alert alert-error">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{resetError}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                  <button type="button" onClick={() => setResetEmp(null)} className="btn btn-secondary">
                    {t('common.cancel', 'বাতিল', 'Cancel')}
                  </button>
                  <button type="submit" disabled={resetSubmitting} className="btn btn-primary">
                    {resetSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                    {t('emp.set_pw', 'পাসওয়ার্ড সেট করুন', 'Set password')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Employee Work & Tasks Detail Modal */}
      {workModalEmp && (
        <div className="modal-backdrop">
          <div className="modal-panel flex flex-col sm:max-w-3xl" role="dialog" aria-modal="true" aria-labelledby="work-emp-title">
            {/* Header */}
            <div className="card-header flex-nowrap items-start">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={workModalEmp.name} size={40} animated={false} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 id="work-emp-title" className="truncate text-base font-semibold text-slate-900">{workModalEmp.name}</h3>
                    <span className={`badge ${workModalEmp.is_active ? 'badge-green' : 'badge-gray'}`}>
                      {workModalEmp.is_active ? t('emp.active', 'সক্রিয়', 'Active') : t('emp.inactive', 'নিষ্ক্রিয়', 'Inactive')}
                    </span>
                  </div>
                  <p className="card-subtitle mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3 text-slate-400" /> {workModalEmp.email}
                    </span>
                    {workModalEmp.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-slate-400" /> {workModalEmp.phone}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWorkModalEmp(null)}
                className="btn-icon shrink-0"
                aria-label={L('বন্ধ করুন', 'Close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              {loadingWorkData ? (
                <div role="status" aria-busy="true" className="space-y-5">
                  <span className="sr-only">
                    {t('emp.loading_work', 'কাজের বিবরণ লোড হচ্ছে...', 'Loading work profile...')}
                  </span>
                  <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="bg-white p-3.5">
                        <div aria-hidden className="skeleton h-2.5 w-20" />
                        <div aria-hidden className="skeleton mt-2 h-6 w-12" />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2.5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} aria-hidden className="skeleton h-14 w-full rounded-xl" />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Quick Stats Grid */}
                  <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
                    <div className="bg-white p-3.5">
                      <div className="text-xs text-slate-500">
                        {t('emp.today_posts', 'আজকের সম্পন্ন পোস্ট', 'Today Posts')}
                      </div>
                      <div className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">
                        {workData?.stats?.todayCompletedLinks ?? 0}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                      <div className="text-xs text-slate-500">
                        {t('emp.total_posts', 'মোট সম্পন্ন পোস্ট', 'Total Posts')}
                      </div>
                      <div className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">
                        {workData?.stats?.totalCompletedLinks ?? workModalEmp.total_completed_links}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                      <div className="text-xs text-slate-500">
                        {t('emp.total_leads', 'মোট লিড সংগ্রহ', 'Total Leads')}
                      </div>
                      <div className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">
                        {workData?.stats?.totalLeads ?? workModalEmp.total_leads}
                      </div>
                    </div>
                  </div>

                  {/* Sub-Group Post Limits Live Status Banner */}
                  {workData?.assignedSections && workData.assignedSections.length > 0 && (
                    <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        <Layers className="h-4 w-4 text-slate-400" />
                        <span>{t('emp.subgroup_quotas', 'সাব-গ্রুপভিত্তিক পোস্ট কোটা ও লিমিট স্ট্যাটাস', 'Sub-Group Post Quotas & Live Status')}</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {workData.assignedSections.map((sec: any) => (
                          <div key={sec.section_id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-800">{sec.section_name}</div>
                              <div className="text-xs text-slate-500">
                                {sec.post_limit ? L(`${t('emp.quota', 'কোটা', 'Quota')}: ${sec.post_limit}টি`) : t('emp.no_limit', 'সীমাহীন', 'No Limit')}
                              </div>
                            </div>
                            <div className="shrink-0">
                              {sec.is_limit_reached ? (
                                <span className="badge badge-red tabular-nums">
                                  <Lock className="h-3 w-3" aria-hidden /> {t('emp.limit_reached', 'কোটা পূর্ণ', 'Quota Met')} ({sec.today_completed}/{sec.post_limit})
                                </span>
                              ) : sec.post_limit ? (
                                <span className="badge badge-green tabular-nums">
                                  {sec.today_completed} / {sec.post_limit} ({t('emp.remaining', 'বাকি', 'Left')}: {sec.remaining})
                                </span>
                              ) : (
                                <span className="badge badge-gray tabular-nums">
                                  {sec.today_completed} {t('emp.done', 'টি সম্পন্ন', 'done')}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Navigation Tabs */}
                  <div className="no-scrollbar -mx-5 flex items-center gap-1 overflow-x-auto border-b border-slate-200 px-5" role="tablist">
                    <button
                      type="button"
                      onClick={() => setWorkActiveTab('TASKS')}
                      className={`-mb-px flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                        workActiveTab === 'TASKS'
                          ? 'border-brand-600 text-slate-900'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Target className="h-3.5 w-3.5" />
                      <span>{t('emp.tab_tasks', 'কাজের তালিকা ও লক্ষ্যমাত্রা', 'Assigned Jobs & Targets')}</span>
                      <span className="rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-600 tabular-nums">
                        {workData?.targets?.length ?? 0}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setWorkActiveTab('POSTS')}
                      className={`-mb-px flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                        workActiveTab === 'POSTS'
                          ? 'border-brand-600 text-slate-900'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Layers className="h-3.5 w-3.5" />
                      <span>{t('emp.tab_posts', 'পোস্টিং হিস্ট্রি (কাজগুলো)', 'Posting History')}</span>
                      <span className="rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-600 tabular-nums">
                        {workData?.recentCompletions?.length ?? 0}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setWorkActiveTab('LEADS')}
                      className={`-mb-px flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                        workActiveTab === 'LEADS'
                          ? 'border-brand-600 text-slate-900'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>{t('emp.tab_leads', 'সংগৃহীত লিডসমূহ', 'Leads')}</span>
                      <span className="rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-600 tabular-nums">
                        {workData?.recentLeads?.length ?? 0}
                      </span>
                    </button>
                  </div>

                  {/* Tab 1: Assigned Targets / Jobs */}
                  {workActiveTab === 'TASKS' && (
                    <div className="space-y-3">
                      {!workData?.targets || workData.targets.length === 0 ? (
                        <EmptyState
                          icon={<Target className="h-5 w-5" />}
                          title={t('emp.no_tasks', 'এই কর্মচারীর জন্য কোনো টার্গেট বা কাজ এখনও নির্ধারণ করা হয়নি', 'No targets or jobs assigned yet')}
                        />
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {workData.targets.map((tgt: any) => (
                            <div key={tgt.id} className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-4">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-slate-800">{tgt.metric_type}</div>
                                  {tgt.section_name && (
                                    <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                                      <Layers className="h-3 w-3 text-slate-400" />
                                      <span>{tgt.section_name}</span>
                                    </div>
                                  )}
                                </div>
                                <span className={`badge shrink-0 tabular-nums ${tgt.is_met ? 'badge-green' : 'badge-blue'}`}>
                                  {tgt.percentage}% {tgt.is_met ? t('emp.met', 'সম্পন্ন', 'Met') : ''}
                                </span>
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                  <span>{t('emp.progress', 'অগ্রগতি', 'Progress')}</span>
                                  <span className="font-medium text-slate-800 tabular-nums">
                                    {tgt.achieved_value} / {tgt.target_value}
                                  </span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className={`h-full rounded-full transition-all ${tgt.is_met ? 'bg-emerald-500' : 'bg-sky-500'}`}
                                    style={{ width: `${tgt.percentage}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 2: Recent Link Completions History */}
                  {workActiveTab === 'POSTS' && (
                    <div className="space-y-2">
                      {!workData?.recentCompletions || workData.recentCompletions.length === 0 ? (
                        <EmptyState
                          icon={<Layers className="h-5 w-5" />}
                          title={t('emp.no_completions', 'এখনও কোনো লিংক পোস্ট সম্পন্ন করা হয়নি', 'No completed link posts yet')}
                        />
                      ) : (
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white max-h-72 overflow-y-auto">
                          {workData.recentCompletions.map((comp: any) => (
                            <div key={comp.id} className="p-3 flex items-center justify-between gap-3 transition-colors hover:bg-slate-50/80">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="badge badge-gray shrink-0">
                                    {comp.section_name}
                                  </span>
                                  <span className="truncate text-sm font-medium text-slate-800">
                                    {comp.title}
                                  </span>
                                </div>
                                <a
                                  href={comp.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-brand-700 hover:underline"
                                >
                                  <span className="truncate">{comp.url}</span>
                                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                                </a>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="badge badge-green mb-1">
                                  <Check className="h-3 w-3" aria-hidden /> {t('emp.done', 'সম্পন্ন', 'Done')}
                                </span>
                                <div className="flex items-center justify-end gap-1 text-[11px] text-slate-500 tabular-nums">
                                  <Clock className="h-3 w-3" />
                                  <span>{new Date(comp.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 3: Recent Leads */}
                  {workActiveTab === 'LEADS' && (
                    <div className="space-y-2">
                      {!workData?.recentLeads || workData.recentLeads.length === 0 ? (
                        <EmptyState
                          icon={<Users className="h-5 w-5" />}
                          title={t('emp.no_leads', 'এই কর্মচারীর কোনো সংগৃহীত লিড নেই', 'No leads collected yet')}
                        />
                      ) : (
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white max-h-72 overflow-y-auto">
                          {workData.recentLeads.map((lead: any) => (
                            <div key={lead.id} className="p-3 flex items-center justify-between gap-3 transition-colors hover:bg-slate-50/80">
                              <div>
                                <div className="text-sm font-medium text-slate-800">{lead.name}</div>
                                <div className="text-xs text-slate-500"><span className="tabular-nums">{lead.phone}</span> · {lead.product_name}</div>
                              </div>
                              <span className="badge badge-blue shrink-0">{lead.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-4">
              <a
                href={`/admin/targets`}
                className="btn btn-ghost btn-sm"
              >
                <Target className="h-3.5 w-3.5" />
                <span>{t('emp.assign_target_btn', 'টার্গেট ও কাজ দিন', 'Assign Jobs & Targets')}</span>
                <ArrowUpRight className="h-3 w-3 text-slate-400" />
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const current = workModalEmp;
                    setWorkModalEmp(null);
                    if (current) openAssignSectionsModal(current);
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>{t('emp.change_sections', 'সেকশন পরিবর্তন', 'Change Sections')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWorkModalEmp(null)}
                  className="btn btn-primary btn-sm"
                >
                  {t('common.close', 'বন্ধ করুন', 'Close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
