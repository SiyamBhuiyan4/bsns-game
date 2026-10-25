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
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <CheckSquare className="h-6 w-6 text-teal-600" />
          আমার কাজ (My Work & Task Queue)
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          আপনার নির্ধারিত সেকশনের গ্রুপ লিংকগুলোতে পোস্ট দিন এবং কাজ শেষে &quot;Done&quot; বাটনে চাপুন।
        </p>
      </div>

      {/* Progress Bar Card */}
      <div className="rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-50 via-emerald-50 to-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-teal-800">
              দৈনিক অগ্রগতি (Daily Posting Progress)
            </div>
            <div className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
              আজ: <span className="text-teal-700">{progress.completedToday}</span> টি লিংক সম্পন্ন /{' '}
              <span className="text-slate-600">{progress.totalAssigned}</span> টি
              <span className="text-xs font-normal text-slate-500 ml-2">
                (Today: {progress.completedToday} of {progress.totalAssigned} links done)
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-2xl sm:text-3xl font-extrabold text-teal-700">
              {progress.percentage}%
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200/70 rounded-full h-3.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-teal-500 to-emerald-600 h-3.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, progress.percentage)}%` }}
          ></div>
        </div>

        {progress.percentage >= 100 && (
          <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/70 px-3 py-1.5 rounded-xl">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            দারুণ! আজকের সকল নির্ধারিত গ্রুপ লিংকের কাজ সম্পূর্ণ হয়েছে।
          </div>
        )}
      </div>

      {/* Notifications / Toast */}
      {errorMessage && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-800 font-bold">×</button>
        </div>
      )}

      {successToast && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs sm:text-sm text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="গ্রুপের নাম বা লিংক অনুসন্ধান করুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-300 py-1.5 pl-9 pr-3 text-xs text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">সেকশন:</label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white py-1.5 px-3 text-xs text-slate-800 focus:border-teal-600 focus:outline-none cursor-pointer"
          >
            <option value="">সকল নির্ধারিত সেকশন ({assignedSections.length})</option>
            {assignedSections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {sec.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 1. TO DO LIST (বাকি কাজের তালিকা) */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-slate-50/80 px-4 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-600 text-white text-xs font-bold">
              {todoLinks.length}
            </span>
            <h2 className="text-sm font-bold text-slate-900">
              বাকি কাজের তালিকা (To Do List)
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            {todoLinks.length > 0 ? `${todoLinks.length}টি লিঙ্ক বাকি আছে` : 'সব সম্পন্ন'}
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600 mb-2" />
            <p className="text-sm">টাস্ক লোড হচ্ছে...</p>
          </div>
        ) : todoLinks.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 mb-2" />
            <p className="text-base font-bold text-slate-800">সব লিংক সম্পন্ন হয়েছে! 🎉</p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery ? 'অনুসন্ধানের সাথে কোনো বাকি লিংক মেলেনি' : 'আজকের বাকি সব কাজের লিংক সম্পন্ন করেছেন।'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sm:px-6">গ্রুপ শিরোনাম (Group Title)</th>
                  <th className="py-3 px-4">সেকশন (Section)</th>
                  <th className="py-3 px-4 text-center">পোস্ট লিংক (Open Link)</th>
                  <th className="py-3 px-4 sm:px-6 text-right">কার্যক্রম (Action)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginatedTodo.map((link) => (
                  <tr key={link.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6 max-w-md">
                      <div className="font-semibold text-slate-900 truncate">
                        {link.title || link.url}
                      </div>
                      <div className="font-mono text-xs text-slate-400 truncate">
                        {link.url}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                        <Layers className="h-3 w-3" />
                        {link.section_name}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-teal-500 hover:text-teal-700 hover:bg-teal-50/50 transition-colors shadow-2xs"
                        title="নতুন ট্যাবে গ্রুপ খুলুন"
                      >
                        <span>পোস্ট করতে যান</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </td>

                    <td className="py-3.5 px-4 sm:px-6 text-right">
                      <button
                        onClick={() => handleMarkDone(link)}
                        disabled={actionLoadingId === link.id}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-teal-700 disabled:opacity-60 transition-all cursor-pointer"
                      >
                        {actionLoadingId === link.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        <span>Done</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* To Do Pagination */}
        {totalTodoPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-2.5 sm:px-6">
            <div className="text-xs text-slate-500">
              পাতা {todoPage} / {totalTodoPages}
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={todoPage <= 1}
                onClick={() => setTodoPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40 cursor-pointer"
              >
                আগে
              </button>
              <button
                disabled={todoPage >= totalTodoPages}
                onClick={() => setTodoPage((p) => Math.min(totalTodoPages, p + 1))}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40 cursor-pointer"
              >
                পরে
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. COMPLETED LIST (সম্পন্ন কাজের তালিকা) */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-slate-50/80 px-4 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white text-xs font-bold">
              {completedLinks.length}
            </span>
            <h2 className="text-sm font-bold text-slate-900">
              সম্পন্ন কাজের তালিকা (Completed List)
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            {completedLinks.length}টি লিঙ্ক সম্পন্ন
          </span>
        </div>

        {completedLinks.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            এখনও কোনো লিংক সম্পন্ন হিসেবে চিহ্নিত করা হয়নি।
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sm:px-6">গ্রুপ শিরোনাম (Group Title)</th>
                  <th className="py-3 px-4">সেকশন (Section)</th>
                  <th className="py-3 px-4">সম্পন্নের সময় (Asia/Dhaka)</th>
                  {undoEnabled && <th className="py-3 px-4 sm:px-6 text-right">আনডু (Undo)</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {completedLinks.map((link) => (
                  <tr key={link.id} className="hover:bg-slate-50/70 transition-colors bg-emerald-50/15">
                    <td className="py-3.5 px-4 sm:px-6 max-w-md">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5 truncate">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="truncate">{link.title || link.url}</span>
                      </div>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-slate-400 hover:text-teal-700 truncate block mt-0.5"
                      >
                        {link.url}
                      </a>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                        {link.section_name}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-xs font-mono text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>{format(new Date(link.completed_at), 'dd MMM yyyy, hh:mm a')}</span>
                      </div>
                    </td>

                    {undoEnabled && (
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <button
                          onClick={() => handleUndo(link)}
                          disabled={actionLoadingId === link.id}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-800 transition-colors cursor-pointer"
                          title="আনডু করে পুনরায় বাকি কাজের তালিকায় ফিরিয়ে নিন"
                        >
                          {actionLoadingId === link.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3 text-amber-600" />
                          )}
                          <span>Undo</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
