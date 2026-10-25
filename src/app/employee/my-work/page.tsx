'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CheckSquare,
  ExternalLink,
  CheckCircle2,
  RotateCcw,
  Search,
  Layers,
  Clock,
  Sparkles,
  AlertCircle,
  Loader2,
  Check,
  Target,
} from 'lucide-react';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import { useLanguage } from '@/components/LanguageContext';
import EmptyState from '@/components/ui/EmptyState';

interface TodoLink {
  id: string;
  url: string;
  title: string | null;
  section_id: string;
  section_name: string;
  section_post_limit?: number | null;
  section_completed_today?: number;
  is_limit_reached?: boolean;
}

interface CompletedLink {
  id: string;
  url: string;
  title: string | null;
  section_id: string;
  section_name: string;
  completion_id: string;
  completed_at: string;
}

interface AssignedSection {
  id: string;
  name: string;
  postLimit?: number | null;
  completedToday?: number;
  isLimitReached?: boolean;
  remaining?: number | null;
}

interface ProgressData {
  completedToday: number;
  totalAssigned: number;
  percentage: number;
}

export default function EmployeeMyWorkPage() {
  const { lang } = useLanguage();
  const L = (bn: string, en: string) => (lang === 'en' ? en : bn);
  const [todoLinks, setTodoLinks] = useState<TodoLink[]>([]);
  const [completedLinks, setCompletedLinks] = useState<CompletedLink[]>([]);
  const [assignedSections, setAssignedSections] = useState<AssignedSection[]>([]);
  const [progress, setProgress] = useState<ProgressData>({
    completedToday: 0,
    totalAssigned: 0,
    percentage: 0,
  });
  const [undoEnabled, setUndoEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Pagination for To Do
  const [todoPage, setTodoPage] = useState(1);
  const PAGE_SIZE = 25;

  const fetchWorkQueue = useCallback(async () => {
    try {
      const url = `/api/employee/work?q=${encodeURIComponent(
        searchQuery
      )}&sectionId=${encodeURIComponent(selectedSection)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setTodoLinks(data.todoLinks || []);
        setCompletedLinks(data.completedLinks || []);
        setAssignedSections(data.assignedSections || []);
        setProgress(data.progress || { completedToday: 0, totalAssigned: 0, percentage: 0 });
        setUndoEnabled(data.undoEnabled !== false);
      } else {
        setErrorMessage(data.error || 'টাস্ক কিউ লোড করা যায়নি');
      }
    } catch {
      setErrorMessage('নেটওয়ার্ক ত্রুটি');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedSection]);

  useEffect(() => {
    fetchWorkQueue();
  }, [fetchWorkQueue]);

  // Window Focus Refresh Rule: The list refreshes when the page regains focus
  useEffect(() => {
    const handleFocus = () => {
      fetchWorkQueue();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchWorkQueue]);

  // Handle Mark Done (Optimistic Update)
  const handleMarkDone = async (link: TodoLink) => {
    if (actionLoadingId === link.id) return;

    // Check if sub-group quota is already reached
    if (link.is_limit_reached) {
      setErrorMessage(
        L(
          `"${link.section_name}" এ আজকের নির্ধারিত পোস্ট সীমা (${link.section_post_limit}টি) পূরণ হয়ে গেছে। অতিরিক্ত পোস্ট রেকর্ড করা যাবে না।`,
          `Daily post quota (${link.section_post_limit}) reached for "${link.section_name}". No more posts allowed.`
        )
      );
      return;
    }

    setActionLoadingId(link.id);
    setErrorMessage(null);

    // 1. Optimistic Update: immediately remove from To Do and push to Completed
    const previousTodo = [...todoLinks];
    const previousCompleted = [...completedLinks];
    const previousProgress = { ...progress };

    const newCompletedItem: CompletedLink = {
      ...link,
      completion_id: 'temp-' + Date.now(),
      completed_at: new Date().toISOString(),
    };

    setTodoLinks((prev) => prev.filter((item) => item.id !== link.id));
    setCompletedLinks((prev) => [newCompletedItem, ...prev]);
    setProgress((prev) => {
      const nextDone = prev.completedToday + 1;
      return {
        ...prev,
        completedToday: nextDone,
        percentage: prev.totalAssigned > 0 ? Math.round((nextDone / prev.totalAssigned) * 100) : 100,
      };
    });

    setSuccessToast(`"${link.title || link.url}" সম্পন্ন হিসেবে চিহ্নিত হয়েছে!`);
    setTimeout(() => setSuccessToast(null), 3000);

    try {
      const res = await fetch(`/api/employee/work/${link.id}/done`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        // Rollback on failure
        setTodoLinks(previousTodo);
        setCompletedLinks(previousCompleted);
        setProgress(previousProgress);
        setErrorMessage(data.error || 'লিংক সম্পন্ন সংরক্ষণ ব্যর্থ হয়েছে');
      } else {
        // Update temp completion id with real one and refresh work queue
        setCompletedLinks((prev) =>
          prev.map((item) =>
            item.id === link.id
              ? { ...item, completion_id: data.completionId, completed_at: data.completedAt }
              : item
          )
        );
        fetchWorkQueue();
      }
    } catch {
      // Rollback on network failure
      setTodoLinks(previousTodo);
      setCompletedLinks(previousCompleted);
      setProgress(previousProgress);
      setErrorMessage('নেটওয়ার্ক ত্রুটি। আবার চেষ্টা করুন।');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Undo (Sets undone_at and returns link to To Do list)
  const handleUndo = async (link: CompletedLink) => {
    if (actionLoadingId === link.id) return;
    setActionLoadingId(link.id);
    setErrorMessage(null);

    // Optimistic Update
    const previousTodo = [...todoLinks];
    const previousCompleted = [...completedLinks];
    const previousProgress = { ...progress };

    setCompletedLinks((prev) => prev.filter((item) => item.id !== link.id));
    setTodoLinks((prev) => [
      {
        id: link.id,
        url: link.url,
        title: link.title,
        section_id: link.section_id,
        section_name: link.section_name,
      },
      ...prev,
    ]);
    setProgress((prev) => {
      const nextDone = Math.max(0, prev.completedToday - 1);
      return {
        ...prev,
        completedToday: nextDone,
        percentage: prev.totalAssigned > 0 ? Math.round((nextDone / prev.totalAssigned) * 100) : 0,
      };
    });

    try {
      const res = await fetch(`/api/employee/work/${link.id}/undo`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        // Rollback on failure
        setTodoLinks(previousTodo);
        setCompletedLinks(previousCompleted);
        setProgress(previousProgress);
        setErrorMessage(data.error || 'আনডু করা যায়নি');
      } else {
        setSuccessToast('লিংকটি পুনরায় সম্পন্ন করার তালিকায় ফিরিয়ে আনা হয়েছে।');
        setTimeout(() => setSuccessToast(null), 3000);
      }
    } catch {
      setTodoLinks(previousTodo);
      setCompletedLinks(previousCompleted);
      setProgress(previousProgress);
      setErrorMessage('নেটওয়ার্ক সমস্যা');
    } finally {
      setActionLoadingId(null);
    }
  };

  const paginatedTodo = todoLinks.slice((todoPage - 1) * PAGE_SIZE, todoPage * PAGE_SIZE);
  const totalTodoPages = Math.ceil(todoLinks.length / PAGE_SIZE) || 1;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<CheckSquare className="h-5 w-5" />}
        title={L('আমার কাজ', 'My Work')}
        subtitle={L('গ্রুপে পোস্ট দিন, তারপর Done চাপুন।', 'Post in each group, then tap Done.')}
      />

      {/* Progress */}
      <div className="card card-body">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-500">{L('আজকের অগ্রগতি', "Today's progress")}</div>
            <div className="mt-1 text-sm text-slate-700">
              <span className="text-lg font-semibold text-slate-900 tabular-nums">{progress.completedToday}</span>
              <span className="text-slate-500"> / {progress.totalAssigned} </span>
              {L('লিংক সম্পন্ন', 'links done')}
            </div>
          </div>
          <span className="text-2xl font-semibold tracking-tight text-brand-700 tabular-nums">
            {progress.percentage}%
          </span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-2 rounded-full bg-brand-600 transition-all duration-500"
            style={{ width: `${Math.min(100, progress.percentage)}%` }}
          ></div>
        </div>

        {progress.percentage >= 100 && (
          <div className="alert alert-success mt-4">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>{L('আজকের সব লিংক সম্পন্ন।', "All of today's links are done.")}</span>
          </div>
        )}
      </div>

      {/* Sub-Group Mandatory Post Quotas Banner */}
      {assignedSections.some((s) => s.postLimit && s.postLimit > 0) && (
        <div className="card p-4 bg-linear-to-r from-brand-50/50 via-white to-slate-50 border-brand-200/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Target className="h-4 w-4 text-brand-600" />
                <span>{L('সাব-গ্রুপভিত্তিক পোস্ট কোটা ও লিমিট', 'Sub-Group Post Quotas & Limits')}</span>
              </h3>
              <p className="text-xs text-slate-500">
                {L(
                  'এডমিন কর্তৃক আপনার জন্য নির্ধারিত প্রতিটি সাব-গ্রুপের বাধ্যতামূলক পোস্ট লক্ষ্যমাত্রা',
                  'Admin-assigned mandatory post limits for each specific sub-group'
                )}
              </p>
            </div>
            <div className="text-xs font-semibold text-brand-800">
              {L('আজকের মোট কোটা:', 'Today Total:')}{' '}
              <span className="font-mono tabular-nums text-sm">
                {assignedSections.reduce((s, a) => s + (a.completedToday || 0), 0)} /{' '}
                {assignedSections.reduce((s, a) => s + (a.postLimit || 0), 0)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {assignedSections
              .filter((s) => s.postLimit && s.postLimit > 0)
              .map((sec) => {
                const comp = sec.completedToday || 0;
                const limit = sec.postLimit || 1;
                const isMet = sec.isLimitReached;
                const pct = Math.min(100, Math.round((comp / limit) * 100));

                return (
                  <div
                    key={sec.id}
                    className={`rounded-xl border p-3 transition-colors ${
                      isMet
                        ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                        : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold truncate">{sec.name}</span>
                      <span
                        className={`badge text-[10px] font-semibold tabular-nums ${
                          isMet ? 'badge-green' : 'badge-blue'
                        }`}
                      >
                        {isMet ? L('কোটা পূর্ণ', 'Limit Met') : `${pct}%`}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between text-xs mb-1.5">
                      <span className="text-slate-500 text-[11px]">{L('সম্পন্ন:', 'Done:')}</span>
                      <span className="font-mono font-bold">
                        {comp} / {limit} {L('টি পোস্ট', 'posts')}
                      </span>
                    </div>

                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isMet ? 'bg-emerald-500' : 'bg-brand-600'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Notifications */}
      {errorMessage && (
        <div className="alert alert-error items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="btn-icon h-7 w-7 text-rose-600 hover:bg-rose-100 hover:text-rose-800"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {successToast && (
        <div className="alert alert-success animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{successToast}</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1 sm:max-w-md">
          <label htmlFor="mw-search" className="sr-only">
            {L('অনুসন্ধান', 'Search')}
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="mw-search"
            type="text"
            placeholder={L('গ্রুপ বা লিংক খুঁজুন', 'Search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9"
          />
        </div>

        <div className="sm:w-64">
          <label htmlFor="mw-section" className="sr-only">
            {L('সেকশন', 'Section')}
          </label>
          <select
            id="mw-section"
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="input cursor-pointer"
          >
            <option value="">{L('সকল সেকশন', 'All sections')} ({assignedSections.length})</option>
            {assignedSections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {sec.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* To Do */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div>
            <h2 className="card-title">{L('বাকি কাজ', 'To do')}</h2>
            <p className="card-subtitle">
              {todoLinks.length > 0 ? L(`${todoLinks.length}টি লিংক বাকি`, `${todoLinks.length} left`) : L('সব সম্পন্ন', 'All done')}
            </p>
          </div>
          <span className="badge badge-blue tabular-nums">{todoLinks.length}</span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Loader2 className="mb-2 h-6 w-6 animate-spin text-brand-600" />
            <p className="text-sm">{L('লোড হচ্ছে...', 'Loading...')}</p>
          </div>
        ) : todoLinks.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-5 w-5" />}
            title={L('সব লিংক সম্পন্ন', 'All links done')}
            description={
              searchQuery
                ? L('অনুসন্ধানে কোনো বাকি লিংক মেলেনি', 'No pending links match your search')
                : L('আজকের সব কাজ শেষ', 'Nothing left for today')
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {paginatedTodo.map((link) => {
              const isLimitMet = Boolean(link.is_limit_reached);

              return (
                <li
                  key={link.id}
                  className={`flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5 transition-colors ${
                    isLimitMet ? 'bg-slate-50/70 opacity-80' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-medium text-slate-900">{link.title || link.url}</div>
                      {isLimitMet && (
                        <span className="badge badge-amber text-[10px] font-semibold shrink-0">
                          {L('কোটা পূর্ণ', 'Quota Reached')}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex min-w-0 items-center gap-2 flex-wrap">
                      <span className="badge badge-gray shrink-0">
                        <Layers className="h-3 w-3" />
                        {link.section_name}
                      </span>
                      {link.section_post_limit && link.section_post_limit > 0 && (
                        <span className={`text-[11px] font-mono font-semibold ${isLimitMet ? 'text-amber-700' : 'text-brand-700'}`}>
                          {link.section_completed_today ?? 0} / {link.section_post_limit} {L('পোস্ট', 'posts')}
                        </span>
                      )}
                      <span className="truncate font-mono text-xs text-slate-400">{link.url}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary min-h-10"
                      title={L('নতুন ট্যাবে গ্রুপ খুলুন', 'Open group in new tab')}
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Open</span>
                    </a>
                    <button
                      onClick={() => handleMarkDone(link)}
                      disabled={actionLoadingId === link.id || isLimitMet}
                      className={`btn min-h-10 ${
                        isLimitMet
                          ? 'btn-secondary cursor-not-allowed text-slate-400 bg-slate-100 border-slate-200 hover:bg-slate-100'
                          : 'btn-primary'
                      }`}
                      title={
                        isLimitMet
                          ? L(
                              `এই গ্রুপের কোটা (${link.section_post_limit}টি) পূর্ণ হয়ে গেছে। আর পোস্ট করা যাবে না।`,
                              `Quota (${link.section_post_limit}) reached for this group. No more posts allowed.`
                            )
                          : L('সম্পন্ন হিসেবে মার্ক করুন', 'Mark Done')
                      }
                    >
                      {actionLoadingId === link.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      <span>Done</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {totalTodoPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 sm:px-5">
            <div className="text-xs text-slate-500">
              {L('পাতা', 'Page')} {todoPage} / {totalTodoPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={todoPage <= 1}
                onClick={() => setTodoPage((p) => Math.max(1, p - 1))}
                className="btn btn-secondary btn-sm"
              >
                {L('আগে', 'Prev')}
              </button>
              <button
                disabled={todoPage >= totalTodoPages}
                onClick={() => setTodoPage((p) => Math.min(totalTodoPages, p + 1))}
                className="btn btn-secondary btn-sm"
              >
                {L('পরে', 'Next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Completed */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div>
            <h2 className="card-title">{L('সম্পন্ন', 'Completed')}</h2>
            <p className="card-subtitle">
              {L(`${completedLinks.length}টি লিংক সম্পন্ন`, `${completedLinks.length} done`)}
            </p>
          </div>
          <span className="badge badge-green tabular-nums">{completedLinks.length}</span>
        </div>

        {completedLinks.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">
            {L('এখনও কিছু সম্পন্ন হয়নি', 'Nothing completed yet')}
          </div>
        ) : (
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {completedLinks.map((link) => (
              <li
                key={link.id}
                className="flex items-center gap-3 px-4 py-3 sm:px-5"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900">{link.title || link.url}</div>
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span className="badge badge-gray">{link.section_name}</span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Clock className="h-3 w-3 text-slate-400" />
                      {format(new Date(link.completed_at), 'dd MMM yyyy, hh:mm a')}
                    </span>
                  </div>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block truncate font-mono text-xs text-slate-400 hover:text-brand-700"
                  >
                    {link.url}
                  </a>
                </div>

                {undoEnabled && (
                  <button
                    onClick={() => handleUndo(link)}
                    disabled={actionLoadingId === link.id}
                    className="btn btn-secondary min-h-10 shrink-0"
                    title={L('আনডু করে বাকি কাজে ফিরিয়ে নিন', 'Move back to To do')}
                  >
                    {actionLoadingId === link.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4 text-amber-600" />
                    )}
                    <span>Undo</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
