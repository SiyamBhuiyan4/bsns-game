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
} from 'lucide-react';

interface SectionRef {
  id: string;
  name: string;
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
      const res = await fetch(`/api/admin/employees/${assigningEmp.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionIds: assignSelectedSections }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMessage('সেকশন অ্যাসাইনমেন্ট সংরক্ষিত হয়েছে');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-emerald-600" />
            টিম ও কর্মী ব্যবস্থাপনা (Employee Management)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            ডিজিটাল মার্কেটিং টিমের কর্মীদের প্রোফাইল, মোবাইল নম্বর, সেকশন অ্যাসাইনমেন্ট ও পাসওয়ার্ড পরিচালনা করুন।
          </p>
        </div>

        <button
          onClick={() => {
            setIsAddOpen(true);
            setErrorMessage(null);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          <span>নতুন কর্মী যোগ করুন (Add Employee)</span>
        </button>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-800 font-bold">×</button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800 font-bold">×</button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">মোট কর্মী</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{employees.length} জন</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">সক্রিয় কর্মী</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">
            {employees.filter((e) => e.is_active).length} জন
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">নিষ্ক্রিয় কর্মী</div>
          <div className="mt-1 text-2xl font-bold text-slate-400">
            {employees.filter((e) => !e.is_active).length} জন
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">সম্পন্ন গ্রুপ লিংক (মোট)</div>
          <div className="mt-1 text-2xl font-bold text-teal-600">
            {employees.reduce((acc, e) => acc + e.total_completed_links, 0)} বার
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="নাম, মোবাইল বা ইমেইল দিয়ে খুঁজুন..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
        />
      </div>

      {/* Employees Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mb-2" />
            <p className="text-sm">কর্মী তালিকা লোড হচ্ছে...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Users className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">কোনো কর্মী পাওয়া যায়নি</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sm:px-6">কর্মী (Marketer Name & Phone)</th>
                  <th className="py-3 px-4">ইমেইল (Email)</th>
                  <th className="py-3 px-4">নির্ধারিত সেকশন (Assigned Sections)</th>
                  <th className="py-3 px-4 text-center">সম্পন্ন লিংক (Done)</th>
                  <th className="py-3 px-4 text-center">স্ট্যাটাস (Status)</th>
                  <th className="py-3 px-4 sm:px-6 text-right">কার্যক্রম (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="font-semibold text-slate-900">{emp.name}</div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <Phone className="h-3 w-3 text-slate-400" />
                        <span className="font-mono">{emp.phone || 'ফোন নম্বর নেই'}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-xs font-mono text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3 text-slate-400" />
                        <span>{emp.email}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {emp.sections.length === 0 ? (
                          <span className="text-xs text-amber-600 italic">কোনো সেকশন নির্ধারিত নেই</span>
                        ) : (
                          emp.sections.map((sec) => (
                            <span
                              key={sec.id}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-800"
                            >
                              <Layers className="h-2.5 w-2.5" />
                              {sec.name}
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-800">
                        {emp.total_completed_links} বার
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {emp.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                          <CheckCircle className="h-3 w-3 text-emerald-600" /> সক্রিয়
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
                          <XCircle className="h-3 w-3 text-slate-400" /> নিষ্ক্রিয়
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 sm:px-6 text-right space-x-1 sm:space-x-2 whitespace-nowrap">
                      {/* Assign Sections */}
                      <button
                        onClick={() => {
                          setAssigningEmp(emp);
                          setAssignSelectedSections(emp.sections.map((s) => s.id));
                          setErrorMessage(null);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors cursor-pointer"
                        title="সেকশন অ্যাসাইন করুন"
                      >
                        <Layers className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="hidden sm:inline">অ্যাসাইন</span>
                      </button>

                      {/* Reset Password */}
                      <button
                        onClick={() => {
                          setResetEmp(emp);
                          setTempPassword(null);
                          setErrorMessage(null);
                        }}
                        className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1.5 text-xs text-amber-700 hover:bg-amber-50 hover:border-amber-300 transition-colors cursor-pointer"
                        title="পাসওয়ার্ড রিসেট করুন"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
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
                        className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1.5 text-xs text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="সম্পাদনা করুন"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-1">নতুন ডিজিটাল মার্কেটার যোগ করুন</h3>
            <p className="text-xs text-slate-500 mb-4">Add new employee with login credentials and assigned sections</p>

            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  কর্মীর নাম (Full Name) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: রাকিব হাসান"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ইমেইল (Email) *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="employee@example.com"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    মোবাইল নম্বর (BD Mobile) *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="017XXXXXXXX"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-mono focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  লগইন পাসওয়ার্ড (Password) *
                </label>
                <input
                  type="password"
                  required
                  placeholder="ন্যূনতম ৬ অক্ষর"
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              {/* Assign Sections Checkbox List */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  নির্ধারিত গ্রুপ সেকশন (Assign Group Sections)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-slate-200 rounded-xl p-3 bg-slate-50 max-h-36 overflow-y-auto">
                  {sections.map((sec) => (
                    <label key={sec.id} className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
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
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="font-medium">{sec.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  বাতিল (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
                >
                  {addSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  কর্মী তৈরি করুন (Save)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Employee */}
      {editingEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 mb-1">কর্মী তথ্য সম্পাদনা করুন</h3>
            <p className="text-xs text-slate-500 mb-4">Edit Employee Information</p>

            <form onSubmit={handleEditEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  নাম (Name) *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  মোবাইল নম্বর (Phone)
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-mono focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ইমেইল (Email) *
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit_emp_active"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="edit_emp_active" className="text-xs font-semibold text-slate-700">
                  অ্যাকাউন্ট সক্রিয় রাখুন (Active Account)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingEmp(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  বাতিল (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
                >
                  {editSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  আপডেট করুন (Update)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assign Sections */}
      {assigningEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              গ্রুপ সেকশন নির্ধারণ (Assign Sections)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              কর্মী: <strong>{assigningEmp.name}</strong> ({assigningEmp.email})
            </p>

            <form onSubmit={handleSaveAssignments} className="space-y-4">
              <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50 max-h-60 overflow-y-auto">
                {sections.map((sec) => (
                  <label
                    key={sec.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 hover:bg-emerald-50/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={assignSelectedSections.includes(sec.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAssignSelectedSections([...assignSelectedSections, sec.id]);
                        } else {
                          setAssignSelectedSections(assignSelectedSections.filter((id) => id !== sec.id));
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-semibold text-slate-800">{sec.name}</span>
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssigningEmp(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  বাতিল (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={assignSubmitting}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
                >
                  {assignSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  সংরক্ষণ করুন (Save)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Password */}
      {resetEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-amber-600 mb-2">
              <KeyRound className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900">পাসওয়ার্ড রিসেট করুন</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              কর্মী: <strong>{resetEmp.name}</strong> ({resetEmp.email})
            </p>

            {tempPassword ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                  <div className="text-xs font-bold text-amber-900 mb-1">
                    নতুন সাময়িক পাসওয়ার্ড (Temporary Password):
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white border border-amber-300 p-2.5 font-mono text-base font-bold text-slate-900">
                    <span>{tempPassword}</span>
                    <button
                      onClick={() => copyToClipboard(tempPassword)}
                      className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline cursor-pointer"
                    >
                      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                      <span>{copied ? 'কপি হয়েছে' : 'কপি করুন'}</span>
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-amber-800">
                    ⚠️ এটি শুধুমাত্র একবার দেখানো হবে। কর্মীকে পাসওয়ার্ডটি পৌঁছে দিন।
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setResetEmp(null);
                      setTempPassword(null);
                    }}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
                  >
                    বন্ধ করুন (Close)
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  পাসওয়ার্ড রিসেট করলে একটি স্বয়ংক্রিয় নিরাপদ সাময়িক পাসওয়ার্ড তৈরি হবে এবং কর্মীর পূর্ববর্তী পাসওয়ার্ড বাতিল হয়ে যাবে।
                </p>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setResetEmp(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    বাতিল (Cancel)
                  </button>
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    disabled={resetSubmitting}
                    className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60 cursor-pointer"
                  >
                    {resetSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    নতুন পাসওয়ার্ড তৈরি করুন (Generate)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
