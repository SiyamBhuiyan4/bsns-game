'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Search,
  Calendar,
  RotateCcw,
  RefreshCw,
  Eye,
  X,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  User,
  FileCode,
  Clock,
} from 'lucide-react';

interface Actor {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'EMPLOYEE';
}

interface AuditPayload {
  old?: Record<string, unknown>;
  new?: Record<string, unknown>;
  [key: string]: unknown;
}

interface AuditLogItem {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  payload: AuditPayload | null;
  created_at: string;
  actor: Actor | null;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const ACTION_LABELS: Record<string, { labelBn: string; color: string }> = {
  CREATE: { labelBn: 'তৈরি (CREATE)', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  UPDATE: { labelBn: 'আপডেট (UPDATE)', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  DELETE: { labelBn: 'ডিলিট (DELETE)', color: 'bg-red-100 text-red-800 border-red-200' },
  LOGIN: { labelBn: 'লগইন (LOGIN)', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  UPLOAD: { labelBn: 'আপলোড (UPLOAD)', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  ASSIGN: { labelBn: 'অ্যাসাইন (ASSIGN)', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  TARGET_SET: { labelBn: 'টার্গেট সেট (TARGET_SET)', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  BUDGET_SET: { labelBn: 'বাজেট সেট (BUDGET_SET)', color: 'bg-teal-100 text-teal-800 border-teal-200' },
  ENTRY_SAVE: { labelBn: 'এন্ট্রি সেভ (ENTRY_SAVE)', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  LEAD_UPDATE: { labelBn: 'লিড আপডেট (LEAD_UPDATE)', color: 'bg-sky-100 text-sky-800 border-sky-200' },
  UNDO: { labelBn: 'আনডু (UNDO)', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  REPORT_PUBLISH: { labelBn: 'রিপোর্ট পাবলিশ (REPORT_PUBLISH)', color: 'bg-violet-100 text-violet-800 border-violet-200' },
  REPORT_FINALIZE: { labelBn: 'রিপোর্ট ফাইনাল (REPORT_FINALIZE)', color: 'bg-slate-800 text-white border-slate-700' },
  PLAN_UPDATE: { labelBn: 'প্ল্যান আপডেট (PLAN_UPDATE)', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  EXPORT: { labelBn: 'এক্সপোর্ট (EXPORT)', color: 'bg-zinc-100 text-zinc-800 border-zinc-200' },
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [users, setUsers] = useState<Actor[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedActor, setSelectedActor] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [entityQuery, setEntityQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);

  // Modal State for payload details
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [modalTab, setModalTab] = useState<'diff' | 'raw'>('diff');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedActor) params.append('actor_id', selectedActor);
      if (selectedAction) params.append('action', selectedAction);
      if (entityQuery.trim()) params.append('entity', entityQuery.trim());
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      params.append('page', currentPage.toString());
      params.append('limit', limit.toString());

      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        if (data.users) setUsers(data.users);
        if (data.pagination) setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedActor, selectedAction, entityQuery, startDate, endDate, currentPage, limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleResetFilters = () => {
    setSelectedActor('');
    setSelectedAction('');
    setEntityQuery('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const formatDhakaDateTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dhaka',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  const copyPayloadJson = async (payload: unknown) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      } else if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = JSON.stringify(payload, null, 2);
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy payload JSON:', err);
    }
  };

  // Check if payload has diff (old and/or new objects)
  const hasDiff = Boolean(
    selectedLog?.payload &&
    typeof selectedLog.payload === 'object' &&
    ('old' in selectedLog.payload || 'new' in selectedLog.payload)
  );

  const oldPayloadObj: Record<string, unknown> =
    selectedLog?.payload?.old && typeof selectedLog.payload.old === 'object'
      ? (selectedLog.payload.old as Record<string, unknown>)
      : {};

  const newPayloadObj: Record<string, unknown> =
    selectedLog?.payload?.new && typeof selectedLog.payload.new === 'object'
      ? (selectedLog.payload.new as Record<string, unknown>)
      : {};

  const diffKeys = Object.keys({
    ...oldPayloadObj,
    ...newPayloadObj,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-emerald-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              অডিট লগ ও অ্যাক্টিভিটি ট্রেইল
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            মার্কেটিং সিস্টেমের সকল ডেটা পরিবর্তন, ব্যবহারকারীর অ্যাক্টিভিটি এবং ক্রিয়াকলাপের সময়ানুক্রমিক রেকর্ড।
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLogs()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            রিফ্রেশ
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {/* Actor Filter */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              ব্যবহারকারী (Actor)
            </label>
            <select
              value={selectedActor}
              onChange={(e) => {
                setSelectedActor(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">সকল ব্যবহারকারী</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Action Filter */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              অ্যাকশন (Action)
            </label>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">সকল অ্যাকশন</option>
              {Object.entries(ACTION_LABELS).map(([actionKey, { labelBn }]) => (
                <option key={actionKey} value={actionKey}>
                  {labelBn}
                </option>
              ))}
            </select>
          </div>

          {/* Entity Search */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              এনটিটি (Entity)
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="যেমন: Product, Lead..."
                value={entityQuery}
                onChange={(e) => {
                  setEntityQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              শুরুর তারিখ
            </label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              শেষের তারিখ
            </label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-2 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Clear Filters helper button */}
        {(selectedActor || selectedAction || entityQuery || startDate || endDate) && (
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <div className="text-xs text-slate-500">
              ফিল্টার সক্রিয় রয়েছে। ফলাফল সীমিত দেখাচ্ছে।
            </div>
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              ফিল্টার রিসেট করুন
            </button>
          </div>
        )}
      </div>

      {/* Main Table Card */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3">সময় (Asia/Dhaka)</th>
                <th className="px-4 py-3">ব্যবহারকারী (Actor)</th>
                <th className="px-4 py-3">অ্যাকশন</th>
                <th className="px-4 py-3">এনটিটি ও আইডি</th>
                <th className="px-4 py-3 text-right">পে-লোড / পরিবর্তন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
                      <span>অডিট লগ লোড হচ্ছে...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShieldAlert className="h-8 w-8 text-slate-300" />
                      <span className="font-medium text-slate-700">কোনো অডিট লগ পাওয়া যায়নি</span>
                      <span className="text-xs text-slate-400">
                        নির্বাচিত ফিল্টার বা ডেটাবেসে কোনো রেকর্ড মেলেনি।
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const actionMeta = ACTION_LABELS[log.action] || {
                    labelBn: log.action,
                    color: 'bg-slate-100 text-slate-800 border-slate-200',
                  };

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Time */}
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>{formatDhakaDateTime(log.created_at)}</span>
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="px-4 py-3">
                        {log.actor ? (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900">
                                {log.actor.name}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                                  log.actor.role === 'ADMIN'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {log.actor.role}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500">
                              {log.actor.email}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400 italic">
                            <User className="h-3 w-3" />
                            সিস্টেম (System)
                          </span>
                        )}
                      </td>

                      {/* Action Badge */}
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-bold ${actionMeta.color}`}
                        >
                          {actionMeta.labelBn}
                        </span>
                      </td>

                      {/* Entity & Entity ID */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-slate-800">
                            {log.entity}
                          </span>
                          {log.entity_id && (
                            <span className="font-mono text-[10px] text-slate-400" title={log.entity_id}>
                              ID: {log.entity_id.length > 18 ? `${log.entity_id.substring(0, 18)}...` : log.entity_id}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Payload / Changes Action */}
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {log.payload ? (
                          <button
                            onClick={() => {
                              const isDiff = Boolean(
                                log.payload &&
                                typeof log.payload === 'object' &&
                                ('old' in log.payload || 'new' in log.payload)
                              );
                              setSelectedLog(log);
                              setModalTab(isDiff ? 'diff' : 'raw');
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            পরিবর্তন / বিবরণ
                          </button>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">নেই</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>
              মোট <strong>{pagination.total}</strong> টির মধ্যে{' '}
              {pagination.total === 0
                ? 0
                : (pagination.page - 1) * pagination.limit + 1}{' '}
              -{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} টি
              দেখানো হচ্ছে
            </span>
            <span className="text-slate-300">|</span>
            <label className="flex items-center gap-1">
              <span>প্রতি পৃষ্ঠায়:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-700 focus:outline-none"
              >
                <option value={25}>২৫</option>
                <option value={50}>৫০</option>
                <option value={100}>১০০</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || loading}
              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              পূর্ববর্তী
            </button>
            <span className="px-2 py-1 text-xs font-medium text-slate-700">
              পৃষ্ঠা {pagination.page} এর {pagination.totalPages || 1}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={currentPage >= pagination.totalPages || loading}
              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              পরবর্তী
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Payload Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-emerald-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    অডিট লগ বিবরণ & পে-লোড
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{selectedLog.entity}</span>
                    <span>•</span>
                    <span>{formatDhakaDateTime(selectedLog.created_at)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Tabs & Action Bar */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-2">
              <div className="flex gap-2">
                {hasDiff && (
                  <button
                    onClick={() => setModalTab('diff')}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                      modalTab === 'diff'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    পরিবর্তন (Diff)
                  </button>
                )}
                <button
                  onClick={() => setModalTab('raw')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                    modalTab === 'raw' || !hasDiff
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  র&apos; JSON (Raw)
                </button>
              </div>

              <button
                onClick={() => copyPayloadJson(selectedLog.payload)}
                className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-700">কপি হয়েছে!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-500" />
                    <span>কপি JSON</span>
                  </>
                )}
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 text-xs">
              {modalTab === 'diff' && hasDiff ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <span className="font-semibold text-slate-700">পরিবর্তনসমূহের তুলনা:</span>
                  </div>
                  {diffKeys.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-slate-500">
                      কোনো ফিল্ডে পরিবর্তন পাওয়া যায়নি।
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {diffKeys.map((key) => {
                        const oldVal = oldPayloadObj[key];
                        const newVal = newPayloadObj[key];
                        const isChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);

                        return (
                          <div
                            key={key}
                            className={`rounded-lg border p-3 ${
                              isChanged
                                ? 'border-amber-200 bg-amber-50/30'
                                : 'border-slate-200 bg-slate-50/50'
                            }`}
                          >
                            <div className="mb-2 font-mono text-xs font-bold text-slate-800">
                              {key}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              <div className="rounded bg-rose-50 border border-rose-100 p-2 text-rose-900">
                                <span className="block text-[10px] font-bold uppercase text-rose-700 mb-1">
                                  পূর্ববর্তী মান (Old):
                                </span>
                                <pre className="whitespace-pre-wrap font-mono text-[11px]">
                                  {oldVal !== undefined ? JSON.stringify(oldVal, null, 2) : '(none)'}
                                </pre>
                              </div>
                              <div className="rounded bg-emerald-50 border border-emerald-100 p-2 text-emerald-900">
                                <span className="block text-[10px] font-bold uppercase text-emerald-700 mb-1">
                                  নতুন মান (New):
                                </span>
                                <pre className="whitespace-pre-wrap font-mono text-[11px]">
                                  {newVal !== undefined ? JSON.stringify(newVal, null, 2) : '(none)'}
                                </pre>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-slate-900 p-4 text-emerald-400 font-mono text-xs overflow-x-auto">
                  <pre>{JSON.stringify(selectedLog.payload, null, 2)}</pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-3">
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
