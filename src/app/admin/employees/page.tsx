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
  Copy,
  Check,
  Search,
  Phone,
  Mail,
  X,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import { useLanguage } from '@/components/LanguageContext';

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
  created_at: string;
  sections: SectionRef[];
  total_completed_links: number;
  total_leads: number;
}

export default function EmployeesPage() {
  const { t } = useLanguage();
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
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Assign Sections Modal
  const [assigningEmp, setAssigningEmp] = useState<EmployeeItem | null>(null);
  const [assignSelectedSections, setAssignSelectedSections] = useState<string[]>([]);
  const [assignSectionLimits, setAssignSectionLimits] = useState<Record<string, number | ''>>({});
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // Reset Password Modal
  const [resetEmp, setResetEmp] = useState<EmployeeItem | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/employees');
      const data = await res.json();
      if (res.ok) {
        setEmployees(data.employees || []);
      } else {
        setErrorMessage(data.error || 'কর্মী তালিকা লোড করা যায়নি');
      }
    } catch {
      setErrorMessage('নেটওয়ার্ক সমস্যা');
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
        setSuccessMessage('নতুন কর্মী সফলভাবে যোগ করা হয়েছে (Employee created)');
        setIsAddOpen(false);
        setAddName('');
        setAddEmail('');
        setAddPhone('');
        setAddPassword('');
        setAddSelectedSections([]);
        fetchEmployees();
      } else {
        setErrorMessage(data.error || 'কর্মী যোগ করা যায়নি');
      }
    } catch {
      setErrorMessage('নেটওয়ার্ক ত্রুটি');
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
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage('কর্মী তথ্য আপডেট সফল হয়েছে');
        setEditingEmp(null);
        fetchEmployees();
      } else {
        setErrorMessage(data.error || 'আপডেট ব্যর্থ হয়েছে');
      }
    } catch {
      setErrorMessage('নেটওয়ার্ক ত্রুটি');
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
        setSuccessMessage('সেকশন অ্যাসাইনমেন্ট ও পোস্ট লিমিট সংরক্ষিত হয়েছে');
        setAssigningEmp(null);
        fetchEmployees();
      } else {
        setErrorMessage(data.error || 'অ্যাসাইনমেন্ট ব্যর্থ হয়েছে');
      }
    } catch {
      setErrorMessage('নেটওয়ার্ক ত্রুটি');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmp) return;
    setResetSubmitting(true);
    setTempPassword(null);

    try {
      const res = await fetch(`/api/admin/employees/${resetEmp.id}/reset-password`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setTempPassword(data.temporaryPassword);
      } else {
        setErrorMessage(data.error || 'পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে');
      }
    } catch {
      setErrorMessage('নেটওয়ার্ক ত্রুটি');
    } finally {
      setResetSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        title={t('emp.title', 'টিম', 'Team')}
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
          <span className="flex-1">{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="btn-icon -my-1 h-6 w-6" aria-label={t('common.dismiss', 'বন্ধ করুন', 'Dismiss')}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="btn-icon -my-1 h-6 w-6" aria-label={t('common.dismiss', 'বন্ধ করুন', 'Dismiss')}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('emp.total', 'মোট কর্মী', 'Total')} value={employees.length} icon={<Users className="h-4 w-4" />} tone="gray" />
        <StatCard label={t('emp.active', 'সক্রিয়', 'Active')} value={activeCount} icon={<CheckCircle className="h-4 w-4" />} tone="brand" />
        <StatCard label={t('emp.inactive', 'নিষ্ক্রিয়', 'Inactive')} value={employees.length - activeCount} icon={<XCircle className="h-4 w-4" />} tone="gray" />
        <StatCard label={t('emp.done_links', 'সম্পন্ন লিংক', 'Completed links')} value={totalDone} icon={<Layers className="h-4 w-4" />} tone="blue" />
      </div>

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
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('common.loading', 'লোড হচ্ছে...', 'Loading...')}
          </div>
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
                    <td>
                      <div className="font-medium text-slate-900">{emp.name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                        <Phone className="h-3 w-3" />
                        <span className="tabular-nums">{emp.phone || '—'}</span>
                      </div>
                    </td>

                    <td className="text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3 text-slate-400" />
                        <span>{emp.email}</span>
                      </div>
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
                                <span className="font-bold text-brand-700">
                                  ({sec.post_limit}টি)
                                </span>
                              )}
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    <td className="text-right tabular-nums font-medium text-slate-900">{emp.total_completed_links}</td>

                    <td>
                      {emp.is_active ? (
                        <span className="badge badge-green">{t('emp.active', 'সক্রিয়', 'Active')}</span>
                      ) : (
                        <span className="badge badge-gray">{t('emp.inactive', 'নিষ্ক্রিয়', 'Inactive')}</span>
                      )}
                    </td>

                    <td className="whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-0.5">
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
                          className="btn-icon"
                          title={t('emp.assign', 'সেকশন অ্যাসাইন', 'Assign sections')}
                          aria-label={t('emp.assign', 'সেকশন অ্যাসাইন', 'Assign sections')}
                        >
                          <Layers className="h-4 w-4" />
                        </button>

                        {/* Reset Password */}
                        <button
                          onClick={() => {
                            setResetEmp(emp);
                            setTempPassword(null);
                            setErrorMessage(null);
                          }}
                          className="btn-icon"
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
                            setErrorMessage(null);
                          }}
                          className="btn-icon"
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
                    placeholder="যেমন: রাকিব হাসান"
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
                                className="input py-1 px-2 text-xs w-24 text-center font-bold text-slate-800"
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
                  <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">
                      {t('emp.total_quota', 'মোট নির্ধারিত পোস্ট কোটা:', 'Total Assigned Quota:')}
                    </span>
                    <span className="font-bold text-brand-700">
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

            {tempPassword ? (
              <>
                <div className="card-body space-y-3">
                  <label className="label">{t('emp.temp_pw', 'সাময়িক পাসওয়ার্ড', 'Temporary password')}</label>
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="font-mono text-base font-semibold text-slate-900 break-all">{tempPassword}</span>
                    <button onClick={() => copyToClipboard(tempPassword)} className="btn btn-secondary btn-sm">
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? t('common.copied', 'কপি হয়েছে', 'Copied') : t('common.copy', 'কপি', 'Copy')}
                    </button>
                  </div>
                  <div className="alert alert-warning">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{t('emp.temp_pw_note', 'এটি একবারই দেখানো হবে। কর্মীকে পৌঁছে দিন।', 'Shown only once. Share it with the employee.')}</span>
                  </div>
                </div>

                <div className="flex justify-end border-t border-slate-100 px-5 py-4">
                  <button
                    onClick={() => {
                      setResetEmp(null);
                      setTempPassword(null);
                    }}
                    className="btn btn-secondary"
                  >
                    {t('common.close', 'বন্ধ করুন', 'Close')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="card-body">
                  <p className="text-sm text-slate-600">
                    {t(
                      'emp.reset_desc',
                      'একটি নতুন সাময়িক পাসওয়ার্ড তৈরি হবে এবং আগের পাসওয়ার্ড বাতিল হবে।',
                      'A new temporary password will be generated and the old one will stop working.'
                    )}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                  <button type="button" onClick={() => setResetEmp(null)} className="btn btn-secondary">
                    {t('common.cancel', 'বাতিল', 'Cancel')}
                  </button>
                  <button type="button" onClick={handleResetPassword} disabled={resetSubmitting} className="btn btn-primary">
                    {resetSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {t('emp.generate', 'পাসওয়ার্ড তৈরি', 'Generate')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
