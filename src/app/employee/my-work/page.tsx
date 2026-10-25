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
} from 'lucide-react';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';

interface TodoLink {
  id: string;
  url: string;
  title: string | null;
  section_id: string;
  section_name: string;
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
}

interface ProgressData {
  completedToday: number;
  totalAssigned: number;
  percentage: number;
}

export default function EmployeeMyWorkPage() {
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
        // Update temp completion id with real one
        setCompletedLinks((prev) =>
          prev.map((item) =>
            item.id === link.id
              ? { ...item, completion_id: data.completionId, completed_at: data.completedAt }
              : item
          )
        );
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
        title="আমার কাজ · My Work"
        subtitle="গ্রুপে পোস্ট দিন, তারপর Done চাপুন। Post in each group, then tap Done."
      />

      {/* Progress */}
      <div className="card card-body">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-500">আজকের অগ্রগতি · Today&apos;s progress</div>
            <div className="mt-1 text-sm text-slate-700">
              <span className="text-lg font-semibold text-slate-900 tabular-nums">{progress.completedToday}</span>
              <span className="text-slate-500"> / {progress.totalAssigned} </span>
              লিংক সম্পন্ন · links done
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
            <span>আজকের সব লিংক সম্পন্ন। All of today&apos;s links are done.</span>
          </div>
        )}
      </div>

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
            অনুসন্ধান · Search
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="mw-search"
            type="text"
            placeholder="গ্রুপ বা লিংক খুঁজুন · Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9"
          />
        </div>

        <div className="sm:w-64">
          <label htmlFor="mw-section" className="sr-only">
            সেকশন · Section
          </label>
          <select
            id="mw-section"
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="input cursor-pointer"
          >
            <option value="">সকল সেকশন · All sections ({assignedSections.length})</option>
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
            <h2 className="card-title">বাকি কাজ · To do</h2>
            <p className="card-subtitle">
              {todoLinks.length > 0 ? `${todoLinks.length}টি লিংক বাকি · ${todoLinks.length} left` : 'সব সম্পন্ন · All done'}
            </p>
          </div>
          <span className="badge badge-blue tabular-nums">{todoLinks.length}</span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Loader2 className="mb-2 h-6 w-6 animate-spin text-brand-600" />
            <p className="text-sm">লোড হচ্ছে... · Loading...</p>
          </div>
        ) : todoLinks.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-5 w-5" />}
            title="সব লিংক সম্পন্ন · All links done"
            description={
              searchQuery
                ? 'অনুসন্ধানে কোনো বাকি লিংক মেলেনি · No pending links match your search'
                : 'আজকের সব কাজ শেষ · Nothing left for today'
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {paginatedTodo.map((link) => (
              <li
                key={link.id}
                className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900">{link.title || link.url}</div>
                  <div className="mt-1 flex min-w-0 items-center gap-2">
                    <span className="badge badge-gray shrink-0">
                      <Layers className="h-3 w-3" />
                      {link.section_name}
                    </span>
                    <span className="truncate font-mono text-xs text-slate-400">{link.url}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary min-h-10"
                    title="নতুন ট্যাবে গ্রুপ খুলুন · Open group in new tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Open</span>
                  </a>
                  <button
                    onClick={() => handleMarkDone(link)}
                    disabled={actionLoadingId === link.id}
                    className="btn btn-primary min-h-10"
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
            ))}
          </ul>
        )}

        {totalTodoPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 sm:px-5">
            <div className="text-xs text-slate-500">
              পাতা · Page {todoPage} / {totalTodoPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={todoPage <= 1}
                onClick={() => setTodoPage((p) => Math.max(1, p - 1))}
                className="btn btn-secondary btn-sm"
              >
                আগে · Prev
              </button>
              <button
                disabled={todoPage >= totalTodoPages}
                onClick={() => setTodoPage((p) => Math.min(totalTodoPages, p + 1))}
                className="btn btn-secondary btn-sm"
              >
                পরে · Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Completed */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div>
            <h2 className="card-title">সম্পন্ন · Completed</h2>
            <p className="card-subtitle">
              {completedLinks.length}টি লিংক সম্পন্ন · {completedLinks.length} done
            </p>
          </div>
          <span className="badge badge-green tabular-nums">{completedLinks.length}</span>
        </div>

        {completedLinks.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">
            এখনও কিছু সম্পন্ন হয়নি · Nothing completed yet
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
                    title="আনডু করে বাকি কাজে ফিরিয়ে নিন · Move back to To do"
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
