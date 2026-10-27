'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CheckSquare,
  ExternalLink,
  CheckCircle2,
  RotateCcw,
  Search,
  Sparkles,
  AlertCircle,
  Loader2,
  Save,
  Flame,
  Swords,
  Coins,
  ShoppingBag,
  Zap,
  PlusCircle,
  X,
  Target,
  FileSpreadsheet,
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import EmptyState from '@/components/ui/EmptyState';
import { formatTaka, getDhakaDateString } from '@/lib/date';

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
  is_extra_work?: boolean;
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

interface Product {
  id: string;
  name_bn: string;
  name_en: string;
  unit: string;
  selling_price: number;
}

interface ProductSaleRow {
  product_id: string;
  product_name_bn: string;
  unit: string;
  selling_price: number;
  quantity: number;
  amount: number;
}

function EmployeeMyWorkContent() {
  const { lang, L } = useLanguage();
  const searchParams = useSearchParams();

  // Active view tab: 'links' (Task 1) | 'daily_entry' (Task 2) | 'completed'
  const [activeTab, setActiveTab] = useState<'links' | 'daily_entry' | 'completed'>('links');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'daily_entry' || tabParam === 'links' || tabParam === 'completed') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // --- Task 1: Links State ---
  const [todoLinks, setTodoLinks] = useState<TodoLink[]>([]);
  const [completedLinks, setCompletedLinks] = useState<CompletedLink[]>([]);
  const [assignedSections, setAssignedSections] = useState<AssignedSection[]>([]);
  const [progress, setProgress] = useState<ProgressData>({
    completedToday: 0,
    totalAssigned: 0,
    percentage: 0,
  });
  const [undoEnabled, setUndoEnabled] = useState(true);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // --- Add Extra Work Modal State ---
  const [showAddModal, setShowAddModal] = useState(false);
  const [extraUrl, setExtraUrl] = useState('');
  const [extraTitle, setExtraTitle] = useState('');
  const [extraSectionId, setExtraSectionId] = useState('');
  const [savingExtra, setSavingExtra] = useState(false);

  // --- Task 2: Daily Entry State ---
  const [selectedDate, setSelectedDate] = useState(() => getDhakaDateString());
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [canEdit, setCanEdit] = useState(true);

  const [salesAmount, setSalesAmount] = useState<string>('0');
  const [profitAmount, setProfitAmount] = useState<string>('0');
  const [confirmedOrders, setConfirmedOrders] = useState<string>('0');
  const [productSales, setProductSales] = useState<ProductSaleRow[]>([]);
  const [newClients, setNewClients] = useState<string>('0');
  const [followupsDone, setFollowupsDone] = useState<string>('0');
  const [retentionCount, setRetentionCount] = useState<string>('0');
  const [dailyNote, setDailyNote] = useState<string>('');

  // Toast / Messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [xpReward, setXpReward] = useState<number | null>(null);

  // 1. Fetch Work Queue (Links)
  const fetchWorkQueue = useCallback(async () => {
    try {
      setLoadingLinks(true);
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
        if (!extraSectionId && data.assignedSections && data.assignedSections.length > 0) {
          setExtraSectionId(data.assignedSections[0].id);
        }
      } else {
        setErrorMessage(data.error || L('টাস্ক কিউ লোড করা যায়নি'));
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক ত্রুটি'));
    } finally {
      setLoadingLinks(false);
    }
  }, [searchQuery, selectedSection, extraSectionId]);

  useEffect(() => {
    fetchWorkQueue();
  }, [fetchWorkQueue]);

  // Refetch when window regains focus
  useEffect(() => {
    const handleFocus = () => fetchWorkQueue();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchWorkQueue]);

  // 2. Fetch Daily Entry Data for Selected Date
  const fetchDailyEntry = useCallback(async (dateStr: string) => {
    try {
      setLoadingEntry(true);
      const res = await fetch(`/api/employee/daily-entry?date=${dateStr}`);
      const data = await res.json();

      if (res.ok) {
        setIsLocked(data.is_locked || false);
        setCanEdit(data.can_edit !== false);

        const m = data.metrics || {};
        setSalesAmount(String(m.SALES_AMOUNT || 0));
        setProfitAmount(String(m.PROFIT_AMOUNT || 0));
        setConfirmedOrders(String(m.CONFIRMED_ORDERS || 0));
        setNewClients(String(m.NEW_CLIENTS || 0));
        setFollowupsDone(String(m.FOLLOWUPS_DONE || 0));
        setRetentionCount(String(m.RETENTION_COUNT || 0));

        if (data.daily_text?.next_priorities) {
          setDailyNote(data.daily_text.next_priorities);
        }

        if (Array.isArray(data.products)) {
          setProducts(data.products);
          const existingSales = data.product_sales || [];
          const initialRows = data.products.map((p: Product) => {
            const found = existingSales.find((es: any) => es.product_id === p.id);
            return {
              product_id: p.id,
              product_name_bn: p.name_bn,
              unit: p.unit,
              selling_price: Number(p.selling_price),
              quantity: found ? Number(found.quantity) : 0,
              amount: found ? Number(found.amount) : 0,
            };
          });
          setProductSales(initialRows);
        }
      }
    } catch {
      // silent fallback
    } finally {
      setLoadingEntry(false);
    }
  }, []);

  useEffect(() => {
    fetchDailyEntry(selectedDate);
  }, [selectedDate, fetchDailyEntry]);

  // Reward toast trigger
  const triggerReward = (xp: number, message: string) => {
    setXpReward(xp);
    setSuccessToast(message);
    setTimeout(() => {
      setSuccessToast(null);
      setXpReward(null);
    }, 4000);
  };

  // Handle Mark Link Done (supports normal & extra/bonus work)
  const handleMarkDone = async (link: TodoLink, allowExtra = false) => {
    if (actionLoadingId === link.id) return;

    const isExtra = allowExtra || Boolean(link.is_limit_reached);

    setActionLoadingId(link.id);
    setErrorMessage(null);

    const previousTodo = [...todoLinks];
    const previousCompleted = [...completedLinks];
    const previousProgress = { ...progress };

    const newCompletedItem: CompletedLink = {
      ...link,
      completion_id: 'temp-' + Date.now(),
      completed_at: new Date().toISOString(),
      is_extra_work: isExtra,
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

    triggerReward(
      isExtra ? 50 : 25,
      isExtra
        ? L('🚀 বোনাস সম্পন্ন! অতিরিক্ত পোস্ট সফলভাবে জমা হয়েছে (+৫০ XP)', 'Bonus Complete! Extra post verified (+50 XP)')
        : L('মিশন সফল! লিঙ্ক পোস্ট সম্পন্ন হয়েছে (+২৫ XP)', 'Quest Complete! Link post verified (+25 XP)')
    );

    try {
      const url = `/api/employee/work/${link.id}/done${isExtra ? '?allowExtra=true' : ''}`;
      const res = await fetch(url, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        setTodoLinks(previousTodo);
        setCompletedLinks(previousCompleted);
        setProgress(previousProgress);
        setErrorMessage(data.error || L('সংরক্ষণ ব্যর্থ হয়েছে'));
      } else {
        setCompletedLinks((prev) =>
          prev.map((item) =>
            item.id === link.id
              ? {
                  ...item,
                  completion_id: data.completionId,
                  completed_at: data.completedAt,
                  is_extra_work: data.isExtraWork,
                }
              : item
          )
        );
        fetchWorkQueue();
      }
    } catch {
      setTodoLinks(previousTodo);
      setCompletedLinks(previousCompleted);
      setProgress(previousProgress);
      setErrorMessage(L('নেটওয়ার্ক ত্রুটি। আবার চেষ্টা করুন।'));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Undo
  const handleUndo = async (link: CompletedLink) => {
    if (actionLoadingId === link.id) return;
    setActionLoadingId(link.id);
    setErrorMessage(null);

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
        setTodoLinks(previousTodo);
        setCompletedLinks(previousCompleted);
        setProgress(previousProgress);
        setErrorMessage(data.error || L('আনডু করা যায়নি'));
      } else {
        setSuccessToast(L('লিংকটি টু-ডু তালিকায় ফিরিয়ে আনা হয়েছে।', 'Link returned to To-Do queue.'));
        setTimeout(() => setSuccessToast(null), 3000);
      }
    } catch {
      setTodoLinks(previousTodo);
      setCompletedLinks(previousCompleted);
      setProgress(previousProgress);
      setErrorMessage(L('নেটওয়ার্ক সমস্যা'));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Add Custom Extra Task
  const handleAddExtraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraUrl.trim()) {
      setErrorMessage(L('অনুগ্রহ করে লিংক বা পোস্টের URL দিন', 'Please enter a valid URL'));
      return;
    }
    const secId = extraSectionId || assignedSections[0]?.id;
    if (!secId) {
      setErrorMessage(L('অনুগ্রহ করে সেকশন নির্বাচন করুন', 'Please select a section'));
      return;
    }

    setSavingExtra(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/employee/work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: extraUrl.trim(),
          title: extraTitle.trim() || L('অতিরিক্ত বোনাস পোস্ট', 'Bonus Post'),
          section_id: secId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || L('অতিরিক্ত কাজ সংরক্ষণ ব্যর্থ হয়েছে'));
      } else {
        triggerReward(50, L('🎉 দুর্দান্ত! আপনার অতিরিক্ত পোস্ট যুক্ত ও সম্পন্ন হয়েছে (+৫০ XP)', 'Awesome! Extra bonus post logged successfully (+50 XP)'));
        setShowAddModal(false);
        setExtraUrl('');
        setExtraTitle('');
        fetchWorkQueue();
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক ত্রুটি'));
    } finally {
      setSavingExtra(false);
    }
  };

  // Handle Save Daily Entry
  const handleSaveDailyEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || isLocked) {
      setErrorMessage(L('এই তারিখের এন্ট্রি সম্পাদনা করা যাবে না।', 'This date entry is locked and cannot be edited.'));
      return;
    }

    setSavingEntry(true);
    setErrorMessage(null);

    try {
      const payload = {
        entry_date: selectedDate,
        metrics: {
          SALES_AMOUNT: Number(salesAmount) || 0,
          PROFIT_AMOUNT: Number(profitAmount) || 0,
          CONFIRMED_ORDERS: Math.round(Number(confirmedOrders)) || 0,
          NEW_CLIENTS: Math.round(Number(newClients)) || 0,
          FOLLOWUPS_DONE: Math.round(Number(followupsDone)) || 0,
          RETENTION_COUNT: Math.round(Number(retentionCount)) || 0,
          NEW_LEADS: 0,
          AD_SPEND: 0,
          B2B_ORDERS: 0,
          B2B_INQUIRIES: 0,
          B2B_INQUIRY_VALUE: 0,
        },
        product_sales: productSales
          .filter((p) => p.quantity > 0 || p.amount > 0)
          .map((p) => ({
            product_id: p.product_id,
            quantity: p.quantity,
            amount: p.amount,
          })),
        daily_text: {
          next_priorities: dailyNote || null,
        },
      };

      const res = await fetch('/api/employee/daily-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || L('দৈনিক এন্ট্রি সেভ ব্যর্থ হয়েছে'));
      } else {
        triggerReward(50, L('🎉 দুর্দান্ত! আজকের দৈনিক কাজের হিসাব সফলভাবে সেভ হয়েছে (+৫০ XP)', 'Awesome! Today daily work logged successfully (+50 XP)'));
        fetchDailyEntry(selectedDate);
      }
    } catch {
      setErrorMessage(L('নেটওয়ার্ক ত্রুটি। আবার চেষ্টা করুন।'));
    } finally {
      setSavingEntry(false);
    }
  };

  // Update product row
  const handleProductQuantityChange = (productId: string, qtyStr: string) => {
    const qty = Math.max(0, parseFloat(qtyStr) || 0);
    setProductSales((prev) =>
      prev.map((p) =>
        p.product_id === productId
          ? { ...p, quantity: qty, amount: Math.round(qty * p.selling_price) }
          : p
      )
    );
  };

  // Total products amount
  const totalProductAmount = productSales.reduce((sum, p) => sum + p.amount, 0);

  // Overall quest progress calculation
  const questsTotal = 2;
  const questsCompleted = (progress.completedToday > 0 ? 1 : 0) + (Number(salesAmount) > 0 || Number(confirmedOrders) > 0 ? 1 : 0);
  const questPercent = Math.round((questsCompleted / questsTotal) * 100);

  return (
    <div className="space-y-6">
      {/* ARENA HERO HUD (Gaming Arena Atmosphere) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl border border-white/10">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-100 border border-emerald-500/30">
                <Swords className="w-3.5 h-3.5" />
                {L('মার্কেটার এরিনা', 'Marketer Battle Arena')}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-100 border border-amber-500/30">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                {L('দৈনিক স্ট্রাইক সক্রিয়', 'Daily Streak Active')}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/20 text-sky-100 border border-sky-500/30">
                <Zap className="w-3.5 h-3.5 text-sky-400" />
                {L('সীমাহীন অতিরিক্ত কাজ উন্মুক্ত', 'Unlimited Extra Work Enabled')}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
              {L('আমার কাজ ও দৈনিক এন্ট্রি', 'My Work & Daily Entry')}
            </h1>
            <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-2xl">
              {L(
                'অ্যাডমিনের নির্ধারিত কাজ, নিজের উদ্যোগে অতিরিক্ত পোস্ট ও দৈনিক বিক্রয়ের হিসাব — সব এক জায়গায় সহজে সম্পন্ন করুন।',
                'Assigned group quotas, self-initiated extra posts & daily sales results — all unified in one arena.'
              )}
            </p>
          </div>

          {/* Gamified Mission Progress & Extra Work Action */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-sm gap-2 bg-gradient-to-r from-amber-500 to-amber-500 hover:from-amber-600 hover:to-amber-600 text-slate-950 font-bold shadow-lg shadow-amber-500/20 border-0"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>{L('অতিরিক্ত কাজ যোগ করুন', 'Add Extra Work')}</span>
            </button>

            <div className="bg-slate-800/80 backdrop-blur-md rounded-xl p-3 border border-slate-700/60 flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <div className="w-10 h-10 rounded-full border-3 border-slate-700 border-t-emerald-400 flex items-center justify-center font-bold text-xs text-emerald-400">
                  {questPercent}%
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-medium">
                  {L('মিশন অগ্রগতি', 'Quest Progress')}
                </div>
                <div className="text-xs font-bold text-white flex items-center gap-1">
                  <span>{questsCompleted} / {questsTotal} {L('সম্পন্ন', 'Done')}</span>
                  {questPercent === 100 && <span className="text-emerald-400">⭐</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quest Navigation Tabs */}
        <div className="relative z-10 mt-6 flex flex-wrap gap-2 border-t border-slate-700/60 pt-4">
          <button
            onClick={() => setActiveTab('links')}
            className={`press flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === 'links'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400/40'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>{L('টাস্ক ১: পোস্ট ও কাজের তালিকা', 'Task 1: Group Posts & Tasks')}</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-md bg-white/20 text-xs font-mono">
              {todoLinks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('daily_entry')}
            className={`press flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === 'daily_entry'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-500/25 ring-2 ring-sky-400/40'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>{L('টাস্ক ২: দৈনিক বিক্রয় ও মেট্রিক্স এন্ট্রি', 'Task 2: Daily Sales & Log')}</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-md bg-white/20 text-xs font-mono">
              {L("৳")} {formatTaka(Number(salesAmount))}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`press flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === 'completed'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/25 ring-2 ring-amber-400/40'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{L('সম্পন্ন কাজ ও বোনাস লগ', 'Completed & Bonus Log')}</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-md bg-white/20 text-xs font-mono">
              {completedLinks.length}
            </span>
          </button>
        </div>
      </div>

      {/* Rewards Toast */}
      {successToast && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-emerald-800 shadow-sm animate-fade-up">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-emerald-600 animate-bounce" />
            <span className="font-semibold text-sm">{successToast}</span>
            {xpReward && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-xs font-bold">
                +{xpReward} XP
              </span>
            )}
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="flex items-center justify-between rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-rose-800 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <span className="text-sm font-medium">{L(errorMessage)}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-700 font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* ========================================================
          TAB 1: TASK 1 - TODAY'S GROUP POSTS & EXTRA TASKS
      ======================================================== */}
      {activeTab === 'links' && (
        <div className="space-y-4">
          {/* Section Quota & Bonus Indicator Cards */}
          {assignedSections.length > 0 && (
            <div className="stagger grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {assignedSections.map((sec) => (
                <div
                  key={sec.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    sec.isLimitReached
                      ? 'bg-amber-500/10 border-amber-500/40 shadow-sm'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm truncate">{sec.name}</span>
                    {sec.isLimitReached ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center gap-1">
                        <Zap className="w-3 h-3 fill-current" />
                        {L('কোটা পূর্ণ (বোনাস উন্মুক্ত)', 'Quota Full (Bonus Open)')}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">
                        {L('দৈনিক লক্ষ্য', 'Target')}: {sec.postLimit ?? '∞'}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{L('আজ সম্পন্ন', 'Completed Today')}:</span>
                    <span className="font-bold text-slate-900">
                      {sec.completedToday || 0} / {sec.postLimit ?? '∞'}
                    </span>
                  </div>
                  {sec.postLimit && (
                    <div className="mt-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          sec.isLimitReached ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(((sec.completedToday || 0) / sec.postLimit) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Search, Filter & Quick Add Row */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={L('লিঙ্ক বা গ্রুপের নাম খুঁজুন...', 'Search links or groups...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input input-sm pl-9 w-full"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              {assignedSections.length > 1 && (
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="select select-sm w-full sm:w-auto"
                >
                  <option value="">{L('সকল গ্রুপ ও সেকশন', 'All Groups & Sections')}</option>
                  {assignedSections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name}
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={() => setShowAddModal(true)}
                className="btn btn-sm btn-secondary gap-1.5 border-dashed border-amber-500/50 text-amber-700 hover:bg-amber-500/10"
              >
                <PlusCircle className="w-4 h-4 text-amber-500" />
                <span>{L('অতিরিক্ত কাজ যোগ করুন', 'Add Extra Work')}</span>
              </button>
            </div>
          </div>

          {/* Links Queue */}
          {loadingLinks ? (
            <div role="status" aria-busy="true" className="grid grid-cols-1 gap-3">
              <span className="sr-only">{L('লোড হচ্ছে...', 'Loading...')}</span>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div aria-hidden className="skeleton h-3 w-24" />
                    <div aria-hidden className="skeleton h-4 w-2/3" />
                    <div aria-hidden className="skeleton h-3 w-1/3" />
                  </div>
                  <div className="flex gap-2">
                    <div aria-hidden className="skeleton h-8 w-24 rounded-xl" />
                    <div aria-hidden className="skeleton h-8 w-20 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : todoLinks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {L('আজকের নির্ধারিত কাজ সম্পন্ন!', 'Assigned Quota Complete!')}
                </h3>
                <p className="text-xs md:text-sm text-slate-500 max-w-md mx-auto mt-1">
                  {L(
                    'অ্যাডমিন নির্ধারিত সকল কাজ সম্পন্ন হয়েছে। আরও পয়েন্ট অর্জন ও লিডারবোর্ডে এগিয়ে থাকতে অতিরিক্ত কাজ যোগ করতে পারেন!',
                    'All assigned tasks cleared. Feel free to log extra posts or tasks to earn bonus score & boost your ranking!'
                  )}
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="btn btn-primary gap-2 bg-gradient-to-r from-amber-500 to-amber-500 hover:from-amber-600 hover:to-amber-600 text-slate-950 font-bold border-0 shadow-md"
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>{L('⚡ অতিরিক্ত কাজ যোগ করুন (+৫০ XP)', '⚡ Add Extra Work (+50 XP)')}</span>
              </button>
            </div>
          ) : (
            <div className="stagger grid grid-cols-1 gap-3">
              {todoLinks.map((link) => (
                <div
                  key={link.id}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border transition-all ${
                    link.is_limit_reached
                      ? 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60'
                      : 'border-slate-200 hover:border-emerald-500/50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                        {link.section_name}
                      </span>
                      {link.is_limit_reached && (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-700 flex items-center gap-1">
                          <Zap className="w-3 h-3 fill-current" />
                          {L('কোটা পূর্ণ — বোনাস কাজ সক্রিয়', 'Quota Full — Bonus Active')}
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-slate-900 truncate text-base">
                      {link.title || link.url}
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">{link.url}</div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm gap-1.5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>{L('গ্রুপে যান', 'Visit')}</span>
                    </a>

                    {link.is_limit_reached ? (
                      <button
                        onClick={() => handleMarkDone(link, true)}
                        disabled={actionLoadingId === link.id}
                        className="btn btn-sm gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                        title={L(
                          'কোটা পূর্ণ হলেও অতিরিক্ত পোস্ট করে বোনাস স্কোর (+৫০ XP) অর্জন করতে পারেন',
                          'Post extra to earn bonus XP (+50 XP)'
                        )}
                      >
                        {actionLoadingId === link.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Zap className="h-3.5 w-3.5 fill-current" />
                        )}
                        <span>{L('⚡ অতিরিক্ত পোস্ট (+৫০ XP)', '⚡ Bonus Post (+50 XP)')}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleMarkDone(link, false)}
                        disabled={actionLoadingId === link.id}
                        className="btn btn-primary btn-sm gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                      >
                        {actionLoadingId === link.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        <span>{L('সম্পন্ন (+২৫ XP)', 'Done (+25 XP)')}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 2: TASK 2 - DAILY SALES, ORDERS & WORK ENTRY
      ======================================================== */}
      {activeTab === 'daily_entry' && (
        <form onSubmit={handleSaveDailyEntry} className="space-y-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          {/* Header & Date Selector */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-sky-500" />
                <h2 className="text-lg font-bold text-slate-900">
                  {L('আজকের বিক্রয়, অর্ডার ও কাজের হিসাব', "Today's Sales, Orders & Work Log")}
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {L(
                  'টু-ডু ও দৈনিক এন্ট্রি এখন একসাথে সংযুক্ত — তথ্য সাবমিট করলে আপনার পারফরম্যান্স স্কোর ও লিডারবোর্ড সাথে সাথে আপডেট হবে।',
                  'To-Do & Daily Entry are unified here — submitting updates your score & ranking immediately.'
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input input-sm font-semibold"
              />
              <button
                type="button"
                onClick={() => setSelectedDate(getDhakaDateString())}
                className="btn btn-secondary btn-sm"
              >
                {L('আজ', 'Today')}
              </button>
            </div>
          </div>

          {loadingEntry ? (
            <div role="status" aria-busy="true" className="space-y-6">
              <span className="sr-only">{L('লোড হচ্ছে...', 'Loading...')}</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-2">
                    <div aria-hidden className="skeleton h-3 w-28" />
                    <div aria-hidden className="skeleton h-10 w-full rounded-xl" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-2">
                    <div aria-hidden className="skeleton h-3 w-24" />
                    <div aria-hidden className="skeleton h-10 w-full rounded-xl" />
                  </div>
                ))}
              </div>
              <div aria-hidden className="skeleton h-24 w-full rounded-xl" />
            </div>
          ) : (
            <>
              {/* Sales, Profit & Confirmed Orders */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label font-semibold text-xs">
                    {L('মোট বিক্রি (৳)', 'Total Sales (৳)')} *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold">{L("৳")}</span>
                    <input
                      type="number"
                      min="0"
                      value={salesAmount}
                      onChange={(e) => setSalesAmount(e.target.value)}
                      className="input pl-8 w-full font-bold text-base"
                    />
                  </div>
                </div>

                <div>
                  <label className="label font-semibold text-xs">
                    {L('অবদানমূলক লাভ (৳)', 'Net Profit (৳)')} *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold">{L("৳")}</span>
                    <input
                      type="number"
                      min="0"
                      value={profitAmount}
                      onChange={(e) => setProfitAmount(e.target.value)}
                      className="input pl-8 w-full font-bold text-base"
                    />
                  </div>
                </div>

                <div>
                  <label className="label font-semibold text-xs">
                    {L('নিশ্চিত অর্ডার (সংখ্যা)', 'Confirmed Orders')} *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={confirmedOrders}
                    onChange={(e) => setConfirmedOrders(e.target.value)}
                    className="input w-full font-bold text-base"
                  />
                </div>
              </div>

              {/* Clients, Followups & Retention */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="label font-semibold text-xs">
                    {L('নতুন কাস্টমার (সংখ্যা)', 'New Clients')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newClients}
                    onChange={(e) => setNewClients(e.target.value)}
                    className="input w-full font-bold"
                  />
                </div>

                <div>
                  <label className="label font-semibold text-xs">
                    {L('ফলো-আপ সম্পন্ন (ইনবক্স/কল)', 'Follow-ups Done')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={followupsDone}
                    onChange={(e) => setFollowupsDone(e.target.value)}
                    className="input w-full font-bold"
                  />
                </div>

                <div>
                  <label className="label font-semibold text-xs">
                    {L('পুরোনো ক্রেতার পুনঃঅর্ডার', 'Repeat Retention')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={retentionCount}
                    onChange={(e) => setRetentionCount(e.target.value)}
                    className="input w-full font-bold"
                  />
                </div>
              </div>

              {/* Product-wise Sales Breakdown */}
              {products.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-emerald-500" />
                      <span>{L('পণ্যভিত্তিক বিক্রির হিসাব', 'Product Sales Breakdown')}</span>
                    </h3>
                    <span className="text-xs font-bold text-emerald-600">
                      {L('মোট পণ্য বিক্রি', 'Total')}{L(": ৳")} {formatTaka(totalProductAmount)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {productSales.map((ps) => (
                      <div
                        key={ps.product_id}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/50"
                      >
                        <div className="font-semibold text-sm truncate">{ps.product_name_bn}</div>
                        <div className="text-xs text-slate-500 mb-2">
                          {L("মূল্য: ৳")}{ps.selling_price} / {ps.unit}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            placeholder={L("পরিমাণ")}
                            value={ps.quantity || ''}
                            onChange={(e) => handleProductQuantityChange(ps.product_id, e.target.value)}
                            className="input input-sm w-full font-semibold"
                          />
                          <span className="text-xs font-mono shrink-0 font-bold text-slate-700">
                            {L("৳")}{formatTaka(ps.amount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next Priorities / Notes */}
              <div className="pt-2">
                <label className="label font-semibold text-xs">
                  {L('আগামীকালের অগ্রাধিকার ও মন্তব্য', 'Next Priorities & Notes')}
                </label>
                <textarea
                  rows={2}
                  value={dailyNote}
                  onChange={(e) => setDailyNote(e.target.value)}
                  placeholder={L('আজকের বিশেষ কোনো সমস্যা বা আগামী দিনের কাজের নোট...', 'Roadblocks or priorities for tomorrow...')}
                  className="textarea w-full text-sm"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={savingEntry || !canEdit || isLocked}
                  className="btn btn-primary gap-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-base shadow-md hover:shadow-lg transition-all"
                >
                  {savingEntry ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Save className="h-5 w-5" />
                  )}
                  <span>{L('দৈনিক এন্ট্রি সাবমিট করুন (+৫০ XP)', 'Save Daily Log (+50 XP)')}</span>
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {/* ========================================================
          TAB 3: COMPLETED LINKS & BONUS LOG
      ======================================================== */}
      {activeTab === 'completed' && (
        <div className="space-y-4">
          {completedLinks.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-8 w-8 text-slate-400" />}
              title={L('এখনো কোনো কাজ সম্পন্ন করেননি', 'No completed tasks yet')}
              description={L('টাস্ক ১ থেকে লিঙ্ক পোস্ট করুন বা অতিরিক্ত কাজ যোগ করুন।', 'Post links in Task 1 or log extra tasks to see them here.')}
            />
          ) : (
            <div className="stagger grid grid-cols-1 gap-3">
              {completedLinks.map((link) => (
                <div
                  key={link.completion_id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 opacity-90"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                        ✓ {L('সম্পন্ন', 'Done')}
                      </span>
                      {link.is_extra_work && (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                          <Zap className="w-3 h-3 fill-current" />
                          {L('অতিরিক্ত বোনাস পোস্ট (+৫০ XP)', 'Extra Bonus Post (+50 XP)')}
                        </span>
                      )}
                      <span className="text-xs text-slate-500">{link.section_name}</span>
                    </div>
                    <div className="font-semibold text-slate-900 truncate text-base line-through text-slate-500">
                      {link.title || link.url}
                    </div>
                    <div className="text-xs text-slate-400 truncate mt-0.5">{link.url}</div>
                  </div>

                  {undoEnabled && (
                    <button
                      onClick={() => handleUndo(link)}
                      disabled={actionLoadingId === link.id}
                      className="btn btn-secondary btn-sm gap-1.5 shrink-0"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{L('পূর্বাবস্থায় ফেরান', 'Undo')}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          MODAL: ADD EXTRA WORK / BONUS TASK
      ======================================================== */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-panel space-y-4 p-6" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-amber-600">
                <Zap className="w-5 h-5 fill-current" />
                <h3 className="text-lg font-bold text-slate-900">
                  {L('অতিরিক্ত কাজ / বোনাস পোস্ট যোগ করুন', 'Add Extra Work / Bonus Post')}
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              {L(
                'অ্যাডমিনের নির্ধারিত কোটার বাইরে আপনি যেসব গ্রুপ পোস্ট বা কাজ করেছেন, তা এখানে যুক্ত করুন। সাথে সাথে আপনার পয়েন্ট যোগ হবে (+৫০ XP)।',
                'Log self-initiated extra posts beyond assigned quota to claim bonus score (+50 XP).'
              )}
            </p>

            <form onSubmit={handleAddExtraSubmit} className="space-y-4">
              <div>
                <label className="label font-semibold text-xs">
                  {L('কাজের / পোস্টের লিংক (URL)', 'Work / Post URL')} *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://facebook.com/groups/..."
                  value={extraUrl}
                  onChange={(e) => setExtraUrl(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>

              <div>
                <label className="label font-semibold text-xs">
                  {L('শিরোনাম / বিবরণ (ঐচ্ছিক)', 'Title / Description (Optional)')}
                </label>
                <input
                  type="text"
                  placeholder={L('যেমন: কৃষি ফোরামে নতুন পোস্ট', 'e.g. Extra post in agri group')}
                  value={extraTitle}
                  onChange={(e) => setExtraTitle(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>

              <div>
                <label className="label font-semibold text-xs">
                  {L('সেকশন নির্বাচন করুন', 'Select Section')} *
                </label>
                <select
                  value={extraSectionId}
                  onChange={(e) => setExtraSectionId(e.target.value)}
                  className="select w-full text-sm"
                >
                  {assignedSections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  {L('বাতিল', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={savingExtra || !extraUrl.trim()}
                  className="btn btn-primary btn-sm gap-2 bg-gradient-to-r from-amber-500 to-amber-500 hover:from-amber-600 hover:to-amber-600 text-slate-950 font-bold border-0"
                >
                  {savingExtra ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 fill-current" />
                  )}
                  <span>{L('বোনাস কাজ সাবমিট করুন (+৫০ XP)', 'Submit Bonus Task (+50 XP)')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmployeeMyWorkPage() {
  return (
    <Suspense
      fallback={
        <div role="status" aria-busy="true" className="space-y-6">
          <div aria-hidden className="skeleton h-40 w-full rounded-2xl" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} aria-hidden className="skeleton h-20 w-full rounded-xl" />
            ))}
          </div>
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} aria-hidden className="skeleton h-20 w-full rounded-xl" />
            ))}
          </div>
        </div>
      }
    >
      <EmployeeMyWorkContent />
    </Suspense>
  );
}
