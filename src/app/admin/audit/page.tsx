'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Search,
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
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { useLanguage } from '@/components/LanguageContext';
import { Skeleton } from '@/components/ui/Skeleton';

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


export default function AuditLogPage() {
  const { L } = useLanguage();
  const ACTION_LABELS: Record<string, { labelBn: string; color: string }> = {
    CREATE: { labelBn: L('তৈরি', 'Create'), color: 'badge-green' },
    UPDATE: { labelBn: L('আপডেট', 'Update'), color: 'badge-blue' },
    DELETE: { labelBn: L('ডিলিট', 'Delete'), color: 'badge-red' },
    LOGIN: { labelBn: L('লগইন', 'Login'), color: 'badge-gray' },
    UPLOAD: { labelBn: L('আপলোড', 'Upload'), color: 'badge-gray' },
    ASSIGN: { labelBn: L('অ্যাসাইন', 'Assign'), color: 'badge-blue' },
    TARGET_SET: { labelBn: L('টার্গেট সেট', 'Target Set'), color: 'badge-gray' },
    BUDGET_SET: { labelBn: L('বাজেট সেট', 'Budget Set'), color: 'badge-gray' },
    ENTRY_SAVE: { labelBn: L('এন্ট্রি সেভ', 'Entry Save'), color: 'badge-green' },
    LEAD_UPDATE: { labelBn: L('লিড আপডেট', 'Lead Update'), color: 'badge-blue' },
    UNDO: { labelBn: L('আনডু', 'Undo'), color: 'badge-amber' },
    REPORT_PUBLISH: { labelBn: L('রিপোর্ট প্রকাশ', 'Report Publish'), color: 'badge-brand' },
    REPORT_FINALIZE: { labelBn: L('রিপোর্ট চূড়ান্ত', 'Report Finalize'), color: 'badge-brand' },
    PLAN_UPDATE: { labelBn: L('প্ল্যান আপডেট', 'Plan Update'), color: 'badge-blue' },
    EXPORT: { labelBn: L('এক্সপোর্ট', 'Export'), color: 'badge-gray' },
  };

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
      <PageHeader
        icon={<ShieldAlert className="h-5 w-5" />}
        title={L("অডিট লগ")}
        subtitle={L("সকল পরিবর্তন ও ব্যবহারকারী অ্যাক্টিভিটির রেকর্ড")}
        actions={
          <button onClick={() => fetchLogs()} disabled={loading} className="btn btn-secondary">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {L("রিফ্রেশ")}
          </button>
        }
      />

      <div className="card">
        <div className="card-header">
          <div className="min-w-0">
            <h2 className="card-title">{L('ফিল্টার', 'Filters')}</h2>
            <p className="card-subtitle">{L('ব্যবহারকারী, অ্যাকশন, এনটিটি বা তারিখ দিয়ে খুঁজুন', 'Narrow down by user, action, entity or date')}</p>
          </div>
        </div>
        <div className="card-body grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <div>
            <label className="label" htmlFor="audit-actor">{L("ব্যবহারকারী")}</label>
            <select
              id="audit-actor"
              value={selectedActor}
              onChange={(e) => {
                setSelectedActor(e.target.value);
                setCurrentPage(1);
              }}
              className="input"
            >
              <option value="">{L("সকল ব্যবহারকারী")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="audit-action">{L("অ্যাকশন")}</label>
            <select
              id="audit-action"
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setCurrentPage(1);
              }}
              className="input"
            >
              <option value="">{L("সকল অ্যাকশন")}</option>
              {Object.entries(ACTION_LABELS).map(([actionKey, { labelBn }]) => (
                <option key={actionKey} value={actionKey}>
                  {labelBn}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="audit-entity">{L("এনটিটি")}</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="audit-entity"
                type="text"
                placeholder={L("যেমন: Product, Lead")}
                value={entityQuery}
                onChange={(e) => {
                  setEntityQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="input pl-9"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="audit-start">{L("শুরুর তারিখ")}</label>
            <input
              id="audit-start"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="audit-end">{L("শেষের তারিখ")}</label>
            <input
              id="audit-end"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="input"
            />
          </div>
        </div>

        {(selectedActor || selectedAction || entityQuery || startDate || endDate) && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
            <span className="text-xs text-slate-500">{L("ফিল্টার সক্রিয়")}</span>
            <button onClick={handleResetFilters} className="btn btn-ghost btn-sm">
              <RotateCcw className="h-3.5 w-3.5" />
              {L("ফিল্টার রিসেট")}
            </button>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="max-h-[70vh] overflow-auto [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-slate-50">
          <table className="table-pro min-w-[760px]">
            <thead>
              <tr>
                <th>{L("সময় (ঢাকা)")}</th>
                <th>{L("ব্যবহারকারী")}</th>
                <th>{L("অ্যাকশন")}</th>
                <th>{L("এনটিটি")}</th>
                <th className="text-right">{L("বিবরণ")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <div role="status" aria-busy="true" className="space-y-3 p-4">
                      <span className="sr-only">{L("লোড হচ্ছে...")}</span>
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 flex-1" />
                          <Skeleton className="h-4 flex-1" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <EmptyState
                      icon={<ShieldAlert className="h-5 w-5" />}
                      title={L("কোনো অডিট লগ পাওয়া যায়নি")}
                      description={L("নির্বাচিত ফিল্টারে কোনো রেকর্ড মেলেনি।")}
                    />
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const actionMeta = ACTION_LABELS[log.action] || {
                    labelBn: log.action,
                    color: 'badge-gray',
                  };

                  return (
                    <tr key={log.id}>
                      <td className="whitespace-nowrap">
                        <span className="flex items-center gap-1.5 tabular-nums text-slate-700">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {formatDhakaDateTime(log.created_at)}
                        </span>
                      </td>

                      <td>
                        {log.actor ? (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-slate-900">{log.actor.name}</span>
                              <span className={`badge ${log.actor.role === 'ADMIN' ? 'badge-green' : 'badge-gray'}`}>
                                {log.actor.role}
                              </span>
                            </div>
                            <span className="text-xs text-slate-500">{log.actor.email}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <User className="h-3.5 w-3.5" />
                            {L("সিস্টেম")}
                          </span>
                        )}
                      </td>

                      <td className="whitespace-nowrap">
                        <span className={`badge ${actionMeta.color}`} title={log.action}>
                          {actionMeta.labelBn}
                        </span>
                      </td>

                      <td>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-slate-800">{log.entity}</span>
                          {log.entity_id && (
                            <span className="font-mono text-[11px] text-slate-400" title={log.entity_id}>
                              {log.entity_id.length > 18 ? `${log.entity_id.substring(0, 18)}...` : log.entity_id}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="whitespace-nowrap text-right">
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
                            className="btn btn-ghost btn-sm"
                            aria-label={L('লগ বিবরণ দেখুন', 'View log details')}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {L("দেখুন")}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:flex-row">
          <div className="flex flex-wrap items-center gap-3">
            <span className="tabular-nums">
              {pagination.total === 0
                ? 0
                : (pagination.page - 1) * pagination.limit + 1}
              –{Math.min(pagination.page * pagination.limit, pagination.total)} {L("/ মোট")} {pagination.total}
            </span>
            <label className="flex items-center gap-1.5">
              <span>{L("প্রতি পৃষ্ঠায়")}</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="input input-sm w-auto"
              >
                <option value={25}>{L("২৫")}</option>
                <option value={50}>{L("৫০")}</option>
                <option value={100}>{L("১০০")}</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || loading}
              className="btn btn-secondary btn-sm"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {L("আগের")}
            </button>
            <span className="px-2 tabular-nums text-slate-700">
              {pagination.page} / {pagination.totalPages || 1}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={currentPage >= pagination.totalPages || loading}
              className="btn btn-secondary btn-sm"
            >
              {L("পরের")}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {selectedLog && (
        <div className="modal-backdrop">
          <div className="modal-panel flex flex-col sm:max-w-2xl" role="dialog" aria-modal="true" aria-labelledby="audit-log-title">
            <div className="card-header">
              <div className="flex min-w-0 items-center gap-2">
                <FileCode className="h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <h3 id="audit-log-title" className="card-title">{L("লগ বিবরণ")}</h3>
                  <p className="card-subtitle truncate">
                    {selectedLog.entity} · {formatDhakaDateTime(selectedLog.created_at)}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedLog(null)} className="btn-icon" aria-label={L("বন্ধ করুন")}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
              <div className="segmented">
                {hasDiff && (
                  <button data-active={modalTab === 'diff'} onClick={() => setModalTab('diff')}>
                    {L("পরিবর্তন")}
                  </button>
                )}
                <button data-active={modalTab === 'raw' || !hasDiff} onClick={() => setModalTab('raw')}>
                  JSON
                </button>
              </div>

              <button onClick={() => copyPayloadJson(selectedLog.payload)} className="btn btn-ghost btn-sm">
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-brand-600" />
                    {L("কপি হয়েছে")}
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    {L("JSON কপি")}
                  </>
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 text-sm">
              {modalTab === 'diff' && hasDiff ? (
                diffKeys.length === 0 ? (
                  <p className="py-6 text-center text-slate-500">{L("কোনো ফিল্ডে পরিবর্তন নেই।")}</p>
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
                            isChanged ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="mb-2 flex items-center gap-2 font-mono text-xs font-semibold text-slate-800">
                            {key}
                            {isChanged && <span className="badge badge-amber">{L("পরিবর্তিত")}</span>}
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div className="min-w-0 rounded-md border border-rose-100 bg-rose-50 p-2 text-rose-900">
                              <span className="mb-1 block text-[11px] font-medium text-rose-700">{L("আগের মান")}</span>
                              <pre className="whitespace-pre-wrap break-all font-mono text-[11px]">
                                {oldVal !== undefined ? JSON.stringify(oldVal, null, 2) : L('(নেই)', '(none)')}
                              </pre>
                            </div>
                            <div className="min-w-0 rounded-md border border-emerald-100 bg-emerald-50 p-2 text-emerald-900">
                              <span className="mb-1 block text-[11px] font-medium text-emerald-700">{L("নতুন মান")}</span>
                              <pre className="whitespace-pre-wrap break-all font-mono text-[11px]">
                                {newVal !== undefined ? JSON.stringify(newVal, null, 2) : L('(নেই)', '(none)')}
                              </pre>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800">
                  <pre>{JSON.stringify(selectedLog.payload, null, 2)}</pre>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-100 px-5 py-4">
              <button onClick={() => setSelectedLog(null)} className="btn btn-secondary">
                {L("বন্ধ করুন")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
