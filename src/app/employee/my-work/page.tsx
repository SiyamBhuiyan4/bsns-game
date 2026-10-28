'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Circle,
  Coins,
  ExternalLink,
  FileText,
  Loader2,
  Lock,
  PlusCircle,
  RotateCcw,
  Save,
  Search,
  ShoppingBag,
  Sparkles,
  AlertCircle,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import TaskQuotaCard from '@/components/TaskQuotaCard';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
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
  const productsRef = useRef<Product[]>([]);
  const entryAbortRef = useRef<AbortController | null>(null);
  const queueAbortRef = useRef<AbortController | null>(null);
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  // Metrics this tab does not edit; loaded so a save sends the real values back.
  const [passthroughMetrics, setPassthroughMetrics] = useState({
    NEW_LEADS: 0,
    AD_SPEND: 0,
    B2B_ORDERS: 0,
    B2B_INQUIRIES: 0,
    B2B_INQUIRY_VALUE: 0,
  });
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
    queueAbortRef.current?.abort();
    const controller = new AbortController();
    queueAbortRef.current = controller;
    try {
      setLoadingLinks(true);
      const url = `/api/employee/work?q=${encodeURIComponent(
        searchQuery
      )}&sectionId=${encodeURIComponent(selectedSection)}`;
      const res = await fetch(url, { signal: controller.signal });
      const data = await res.json();
      if (controller.signal.aborted) return;
      if (res.ok) {
        setTodoLinks(data.todoLinks || []);
        setCompletedLinks(data.completedLinks || []);
        setAssignedSections(data.assignedSections || []);
        setProgress(data.progress || { completedToday: 0, totalAssigned: 0, percentage: 0 });
        setUndoEnabled(data.undoEnabled !== false);
        if (data.assignedSections && data.assignedSections.length > 0) {
          setExtraSectionId((prev) => prev || data.assignedSections[0].id);
        }
      } else {
        setErrorMessage(data.error || L('টাস্ক কিউ লোড করা যায়নি'));
      }
    } catch {
      if (controller.signal.aborted) return;
      setErrorMessage(L('নেটওয়ার্ক ত্রুটি'));
    } finally {
      if (!controller.signal.aborted) setLoadingLinks(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedSection]);

  useEffect(() => {
    fetchWorkQueue();
    return () => queueAbortRef.current?.abort();
  }, [fetchWorkQueue]);

  // Refetch when window regains focus
  useEffect(() => {
    const handleFocus = () => fetchWorkQueue();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchWorkQueue]);

  // 2. Fetch Daily Entry Data for Selected Date
  const fetchDailyEntry = useCallback(async (dateStr: string) => {
    entryAbortRef.current?.abort();
    const controller = new AbortController();
    entryAbortRef.current = controller;
    const isStale = () => controller.signal.aborted || selectedDateRef.current !== dateStr;
    try {
      setLoadingEntry(true);

      let prods = productsRef.current;
      if (prods.length === 0) {
        try {
          const prodRes = await fetch('/api/products', { signal: controller.signal });
          if (prodRes.ok) {
            const pData = await prodRes.json();
            prods = pData.products || [];
            productsRef.current = prods;
            if (!isStale()) setProducts(prods);
          }
        } catch {
          if (isStale()) return;
        }
      }
      if (isStale()) return;

      const res = await fetch(`/api/employee/daily-entry?date=${dateStr}`, { signal: controller.signal });
      const data = await res.json();
      if (isStale()) return;

      if (res.ok) {
        setIsLocked(data.is_locked || false);
        setCanEdit(data.can_edit !== false);

        // metrics come as { KEY: { value, note } }
        const m = data.metrics || {};
        const val = (k: string) => Number(m[k]?.value ?? 0) || 0;
        setSalesAmount(String(val('SALES_AMOUNT')));
        setProfitAmount(String(val('PROFIT_AMOUNT')));
        setConfirmedOrders(String(val('CONFIRMED_ORDERS')));
        setNewClients(String(val('NEW_CLIENTS')));
        setFollowupsDone(String(val('FOLLOWUPS_DONE')));
        setRetentionCount(String(val('RETENTION_COUNT')));
        setPassthroughMetrics({
          NEW_LEADS: val('NEW_LEADS'),
          AD_SPEND: val('AD_SPEND'),
          B2B_ORDERS: val('B2B_ORDERS'),
          B2B_INQUIRIES: val('B2B_INQUIRIES'),
          B2B_INQUIRY_VALUE: val('B2B_INQUIRY_VALUE'),
        });

        setDailyNote(data.daily_text?.next_priorities || '');

        // Rows from the active product list, plus any saved product not in
        // that list, so a save never drops an existing breakdown row.
        const existingSales: any[] = data.product_sales || [];
        const rows: ProductSaleRow[] = prods.map((p: Product) => {
          const found = existingSales.find((es) => es.product_id === p.id);
          return {
            product_id: p.id,
            product_name_bn: p.name_bn,
            unit: p.unit,
            selling_price: Number(p.selling_price),
            quantity: found ? Number(found.quantity) : 0,
            amount: found ? Number(found.amount) : 0,
          };
        });
        for (const es of existingSales) {
          if (!rows.some((r) => r.product_id === es.product_id)) {
            rows.push({
              product_id: es.product_id,
              product_name_bn: es.product_name_bn || '',
              unit: es.unit || '',
              selling_price: Number(es.selling_price) || 0,
              quantity: Number(es.quantity) || 0,
              amount: Number(es.amount) || 0,
            });
          }
        }
        setProductSales(rows);
      }
    } catch {
      // silent fallback
    } finally {
      if (!isStale()) setLoadingEntry(false);
    }
  }, []);

  useEffect(() => {
    fetchDailyEntry(selectedDate);
    return () => entryAbortRef.current?.abort();
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
          ...passthroughMetrics,
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

  // ---- Presentation only: nothing below changes data or saving ----
  const field = 'input min-h-10 text-base tabular-nums sm:text-sm';
  const dhakaHour =
    Number(
      new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Dhaka' }).format(new Date())
    ) % 24;
  const greeting =
    dhakaHour < 12
      ? L('শুভ সকাল', 'Good morning')
      : dhakaHour < 17
      ? L('শুভ অপরাহ্ন', 'Good afternoon')
      : L('শুভ সন্ধ্যা', 'Good evening');
  const goals = [
    {
      done: progress.completedToday > 0,
      label: L('অন্তত একটি নির্ধারিত পোস্ট সম্পন্ন করুন', 'Finish at least one assigned post'),
    },
    {
      done: Number(salesAmount) > 0 || Number(confirmedOrders) > 0,
      label: L('আজকের বিক্রি বা অর্ডার লিখুন', "Log today's sales or orders"),
    },
  ];
  const ringRadius = 26;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const tabs = [
    { id: 'links' as const, icon: CheckSquare, label: L('পোস্ট ও কাজ', 'Posts & tasks'), count: todoLinks.length },
    { id: 'daily_entry' as const, icon: Coins, label: L('দৈনিক এন্ট্রি', 'Daily entry'), count: null },
    { id: 'completed' as const, icon: CheckCircle2, label: L('সম্পন্ন', 'Completed'), count: completedLinks.length },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<CheckSquare className="h-5 w-5" />}
        title={L('আমার কাজ ও দৈনিক এন্ট্রি', 'My Work & Daily Entry')}
        subtitle={L(
          'অ্যাডমিনের নির্ধারিত কাজ, নিজের উদ্যোগে অতিরিক্ত পোস্ট ও দৈনিক বিক্রয়ের হিসাব — সব এক জায়গায় সহজে সম্পন্ন করুন।',
          'Assigned posts, your own extra posts and daily sales — all in one place.'
        )}
        actions={
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="btn btn-secondary min-h-10 w-full sm:w-auto"
          >
            <PlusCircle className="h-4 w-4 text-amber-600" />
            <span>{L('অতিরিক্ত কাজ যোগ করুন', 'Add Extra Work')}</span>
          </button>
        }
      />

      {/* Today at a glance */}
      <section className="card relative overflow-hidden" aria-label={L('আজকের অগ্রগতি', "Today's progress")}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-50 via-transparent to-sky-50"
        />
        <div className="relative space-y-5 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="relative h-16 w-16 shrink-0">
                <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden>
                  <circle cx="32" cy="32" r={ringRadius} fill="none" strokeWidth="6" className="stroke-slate-200" />
                  <circle
                    cx="32"
                    cy="32"
                    r={ringRadius}
                    fill="none"
                    strokeWidth="6"
                    strokeLinecap="round"
                    className={questPercent === 100 ? 'stroke-emerald-500' : 'stroke-brand-500'}
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringCircumference * (1 - questPercent / 100)}
                    style={{ transition: 'stroke-dashoffset 0.7s var(--ease-out-soft)' }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-slate-900 tabular-nums">
                  {questPercent}%
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-brand-700" suppressHydrationWarning>
                  {greeting}
                </p>
                <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">
                  {questPercent === 100
                    ? L('আজকের লক্ষ্য পূরণ হয়েছে, দারুণ কাজ!', "Today's goals are done — great work!")
                    : L(
                        `আজকের ${questsTotal}টি লক্ষ্যের ${questsCompleted}টি সম্পন্ন`,
                        `${questsCompleted} of ${questsTotal} daily goals done`
                      )}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {L('কাজ জমা দিলে আপনার স্কোর ও র‍্যাঙ্ক সাথে সাথে আপডেট হয়।', 'Your score and ranking update as soon as you submit.')}
                </p>
              </div>
            </div>

            {questPercent < 100 ? (
              <button
                type="button"
                onClick={() => setActiveTab(goals[0].done ? 'daily_entry' : 'links')}
                className="btn btn-primary min-h-10 w-full shrink-0 sm:w-auto"
              >
                {goals[0].done ? <Coins className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                <span>{goals[0].done ? L('আজকের বিক্রি লিখুন', "Log today's sales") : L('পোস্ট শুরু করুন', 'Start posting')}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <span className="badge badge-green shrink-0 self-start px-3 py-1 text-xs sm:self-auto">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {L('আজকের কাজ শেষ', 'All done for today')}
              </span>
            )}
          </div>

          <ul className="grid gap-2 sm:grid-cols-2">
            {goals.map((g) => (
              <li
                key={g.label}
                className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 text-sm"
              >
                {g.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-slate-300" />
                )}
                <span className={g.done ? 'text-slate-500' : 'font-medium text-slate-800'}>{g.label}</span>
              </li>
            ))}
          </ul>

          <dl className="grid grid-cols-3 gap-4 border-t border-slate-200/70 pt-4">
            <div className="min-w-0">
              <dt className="truncate text-xs text-slate-500">{L('আজ পোস্ট', 'Posts today')}</dt>
              <dd className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums">
                {progress.completedToday}
                {progress.totalAssigned > 0 && (
                  <span className="text-sm font-normal text-slate-400"> / {progress.totalAssigned}</span>
                )}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="truncate text-xs text-slate-500">{L('বিক্রি', 'Sales')}</dt>
              <dd className="mt-0.5 truncate text-lg font-semibold text-slate-900 tabular-nums">
                {formatTaka(Number(salesAmount))}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="truncate text-xs text-slate-500">{L('সম্পন্ন কাজ', 'Completed')}</dt>
              <dd className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums">{completedLinks.length}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Today's mandatory / normal tasks from the assigned quota */}
      <TaskQuotaCard />

      {/* Tabs */}
      <div
        role="tablist"
        aria-label={L('আমার কাজ', 'My work')}
        className="segmented grid w-full grid-cols-3 sm:inline-flex sm:w-auto"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-active={active}
              onClick={() => setActiveTab(tab.id)}
              className="flex min-h-10 min-w-0 items-center justify-center gap-1.5 px-2 sm:px-4"
            >
              <Icon className="hidden h-4 w-4 shrink-0 sm:block" />
              <span className="truncate">{tab.label}</span>
              {tab.count !== null && (
                <span className="rounded-md bg-slate-200/70 px-1.5 text-[11px] font-semibold text-slate-600 tabular-nums">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Toasts: pinned under the top bar so they are seen wherever the user has scrolled */}
      {(successToast || errorMessage) && (
        <div className="pointer-events-none fixed inset-x-4 top-16 z-40 flex flex-col gap-2 sm:left-auto sm:right-6 sm:w-[26rem]">
          {successToast && (
            <div role="status" aria-live="polite" className="alert alert-success pointer-events-auto items-center shadow-[var(--shadow-pop)]">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 font-medium">{successToast}</span>
              {xpReward && <span className="badge badge-green shrink-0 tabular-nums">+{xpReward} XP</span>}
              <button
                type="button"
                onClick={() => setSuccessToast(null)}
                className="btn-icon h-8 w-8 shrink-0 text-emerald-700 hover:bg-emerald-100"
                aria-label={L('বন্ধ করুন', 'Dismiss')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {errorMessage && (
            <div role="alert" className="alert alert-error pointer-events-auto items-center shadow-[var(--shadow-pop)]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 font-medium">{L(errorMessage)}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="btn-icon h-8 w-8 shrink-0 text-rose-700 hover:bg-rose-100"
                aria-label={L('বন্ধ করুন', 'Dismiss')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 1: TODAY'S GROUP POSTS & EXTRA TASKS
      ======================================================== */}
      {activeTab === 'links' && (
        <div className="space-y-6">
          {/* Per-section quota */}
          {assignedSections.length > 0 && (
            <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {assignedSections.map((sec) => {
                const pct = sec.postLimit
                  ? Math.min(100, Math.round(((sec.completedToday || 0) / sec.postLimit) * 100))
                  : 0;
                return (
                  <div
                    key={sec.id}
                    className={`card p-4 ${sec.isLimitReached ? 'border-amber-200 bg-amber-50/40' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-semibold text-slate-900">{sec.name}</span>
                      {sec.isLimitReached ? (
                        <span className="badge badge-amber shrink-0">
                          <Zap className="h-3 w-3" />
                          {L('কোটা পূর্ণ (বোনাস উন্মুক্ত)', 'Quota Full (Bonus Open)')}
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs text-slate-500">
                          {L('দৈনিক লক্ষ্য', 'Target')}: <span className="tabular-nums">{sec.postLimit ?? '∞'}</span>
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex items-baseline justify-between gap-2">
                      <span className="text-xs text-slate-500">{L('আজ সম্পন্ন', 'Completed Today')}</span>
                      <span className="text-sm font-semibold text-slate-900 tabular-nums">
                        {sec.completedToday || 0}
                        <span className="font-normal text-slate-400"> / {sec.postLimit ?? '∞'}</span>
                      </span>
                    </div>
                    {sec.postLimit ? (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            sec.isLimitReached ? 'bg-amber-500' : 'bg-brand-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {/* Queue */}
          <div className="card overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="relative w-full sm:max-w-xs">
                <label htmlFor="mw-search" className="sr-only">
                  {L('অনুসন্ধান', 'Search')}
                </label>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="mw-search"
                  type="text"
                  placeholder={L('লিঙ্ক বা গ্রুপের নাম খুঁজুন...', 'Search links or groups...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input min-h-10 pl-9 text-base sm:text-sm"
                />
              </div>

              {assignedSections.length > 1 && (
                <div className="w-full sm:w-56">
                  <label htmlFor="mw-section" className="sr-only">
                    {L('সেকশন', 'Section')}
                  </label>
                  <select
                    id="mw-section"
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="input min-h-10 text-base sm:text-sm"
                  >
                    <option value="">{L('সকল গ্রুপ ও সেকশন', 'All Groups & Sections')}</option>
                    {assignedSections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {loadingLinks ? (
              <div role="status" aria-busy="true" className="divide-y divide-slate-100">
                <span className="sr-only">{L('লোড হচ্ছে...', 'Loading...')}</span>
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div aria-hidden className="skeleton h-4 w-20 rounded-full" />
                      <div aria-hidden className="skeleton h-4 w-2/3" />
                      <div aria-hidden className="skeleton h-3 w-1/2" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                      <div aria-hidden className="skeleton h-10 w-full rounded-xl sm:w-24" />
                      <div aria-hidden className="skeleton h-10 w-full rounded-xl sm:w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : todoLinks.length === 0 ? (
              searchQuery || selectedSection ? (
                <EmptyState
                  icon={<Search className="h-5 w-5" />}
                  title={L('কোনো লিংক পাওয়া যায়নি', 'No matching links')}
                  description={L('অন্য শব্দ দিয়ে খুঁজুন বা ফিল্টার সরিয়ে দিন।', 'Try another search or clear the filter.')}
                />
              ) : (
                <EmptyState
                  icon={<CheckCircle2 className="h-6 w-6 text-emerald-600" />}
                  title={L('আজকের নির্ধারিত কাজ সম্পন্ন!', 'Assigned Quota Complete!')}
                  description={L(
                    'অ্যাডমিন নির্ধারিত সকল কাজ সম্পন্ন হয়েছে। আরও পয়েন্ট অর্জন ও লিডারবোর্ডে এগিয়ে থাকতে অতিরিক্ত কাজ যোগ করতে পারেন!',
                    'All assigned tasks cleared. Feel free to log extra posts or tasks to earn bonus score & boost your ranking!'
                  )}
                  action={
                    <button type="button" onClick={() => setShowAddModal(true)} className="btn btn-primary min-h-10">
                      <PlusCircle className="h-4 w-4" />
                      <span>{L('অতিরিক্ত কাজ যোগ করুন (+৫০ XP)', 'Add extra work (+50 XP)')}</span>
                    </button>
                  }
                />
              )
            ) : (
              <ul className="stagger divide-y divide-slate-100">
                {todoLinks.map((link) => (
                  <li
                    key={link.id}
                    className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${
                      link.is_limit_reached ? 'bg-amber-50/40' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="badge badge-gray">{link.section_name}</span>
                        {link.is_limit_reached && (
                          <span className="badge badge-amber">
                            <Zap className="h-3 w-3" />
                            {L('কোটা পূর্ণ — বোনাস কাজ সক্রিয়', 'Quota Full — Bonus Active')}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-sm font-semibold text-slate-900 sm:text-[15px]">
                        {link.title || link.url}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">{link.url}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary min-h-10"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>{L('গ্রুপে যান', 'Visit')}</span>
                      </a>

                      {link.is_limit_reached ? (
                        <button
                          type="button"
                          onClick={() => handleMarkDone(link, true)}
                          disabled={actionLoadingId === link.id}
                          className="btn min-h-10 border border-amber-200 bg-amber-50 font-semibold text-amber-800 hover:bg-amber-100"
                          title={L(
                            'কোটা পূর্ণ হলেও অতিরিক্ত পোস্ট করে বোনাস স্কোর (+৫০ XP) অর্জন করতে পারেন',
                            'Post extra to earn bonus XP (+50 XP)'
                          )}
                        >
                          {actionLoadingId === link.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4" />
                          )}
                          <span>{L('অতিরিক্ত পোস্ট (+৫০ XP)', 'Bonus post (+50 XP)')}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMarkDone(link, false)}
                          disabled={actionLoadingId === link.id}
                          className="btn btn-primary min-h-10"
                        >
                          {actionLoadingId === link.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          <span>{L('সম্পন্ন (+২৫ XP)', 'Done (+25 XP)')}</span>
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: DAILY SALES, ORDERS & WORK ENTRY
      ======================================================== */}
      {activeTab === 'daily_entry' && (
        <form onSubmit={handleSaveDailyEntry} className="space-y-6 pb-20 sm:pb-0">
          {/* Date + sales */}
          <div className="card">
            <div className="card-header">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                  <Coins className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="card-title">
                    {L('আজকের বিক্রয়, অর্ডার ও কাজের হিসাব', "Today's Sales, Orders & Work Log")}
                  </h2>
                  <p className="card-subtitle">
                    {L(
                      'টু-ডু ও দৈনিক এন্ট্রি এখন একসাথে সংযুক্ত — তথ্য সাবমিট করলে আপনার পারফরম্যান্স স্কোর ও লিডারবোর্ড সাথে সাথে আপডেট হবে।',
                      'To-Do & Daily Entry are unified here — submitting updates your score & ranking immediately.'
                    )}
                  </p>
                </div>
              </div>

              <div className="flex w-full items-center gap-2 sm:w-auto">
                <label htmlFor="mw-date" className="sr-only">
                  {L('তারিখ', 'Date')}
                </label>
                <div className="relative min-w-0 flex-1 sm:flex-none">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="mw-date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="input min-h-10 pl-9 text-base font-medium tabular-nums sm:text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDate(getDhakaDateString())}
                  className="btn btn-secondary min-h-10 shrink-0"
                >
                  {L('আজ', 'Today')}
                </button>
              </div>
            </div>

            <div className="card-body space-y-4">
              {(isLocked || !canEdit) && !loadingEntry && (
                <div className="alert alert-warning">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{L('এই তারিখের এন্ট্রি সম্পাদনা করা যাবে না।', 'This date entry is locked and cannot be edited.')}</span>
                </div>
              )}

              {loadingEntry ? (
                <div role="status" aria-busy="true" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <span className="sr-only">{L('লোড হচ্ছে...', 'Loading...')}</span>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="space-y-2">
                      <div aria-hidden className="skeleton h-3 w-28" />
                      <div aria-hidden className="skeleton h-10 w-full rounded-xl" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="mw-sales" className="label">
                      {L('মোট বিক্রি (৳)', 'Total Sales (৳)')} <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                        {L('৳')}
                      </span>
                      <input
                        id="mw-sales"
                        type="number"
                        min="0"
                        inputMode="decimal"
                        value={salesAmount}
                        onChange={(e) => setSalesAmount(e.target.value)}
                        className={`${field} pl-8 font-semibold`}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="mw-profit" className="label">
                      {L('অবদানমূলক লাভ (৳)', 'Net Profit (৳)')} <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                        {L('৳')}
                      </span>
                      <input
                        id="mw-profit"
                        type="number"
                        min="0"
                        inputMode="decimal"
                        value={profitAmount}
                        onChange={(e) => setProfitAmount(e.target.value)}
                        className={`${field} pl-8 font-semibold`}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="mw-orders" className="label">
                      {L('নিশ্চিত অর্ডার (সংখ্যা)', 'Confirmed Orders')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="mw-orders"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={confirmedOrders}
                      onChange={(e) => setConfirmedOrders(e.target.value)}
                      className={`${field} font-semibold`}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {loadingEntry ? (
            <div role="status" aria-busy="true" className="card space-y-4 p-5">
              <div aria-hidden className="skeleton h-4 w-40" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
              {/* Clients, follow-ups & retention */}
              <div className="card">
                <div className="card-header">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                      <Users className="h-4 w-4" />
                    </span>
                    <h2 className="card-title">{L('ক্রেতা ও ফলোআপ', 'Clients & follow-ups')}</h2>
                  </div>
                </div>
                <div className="card-body">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label htmlFor="mw-clients" className="label">
                        {L('নতুন কাস্টমার (সংখ্যা)', 'New Clients')}
                      </label>
                      <input
                        id="mw-clients"
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={newClients}
                        onChange={(e) => setNewClients(e.target.value)}
                        className={field}
                      />
                    </div>

                    <div>
                      <label htmlFor="mw-followups" className="label">
                        {L('ফলো-আপ সম্পন্ন (ইনবক্স/কল)', 'Follow-ups Done')}
                      </label>
                      <input
                        id="mw-followups"
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={followupsDone}
                        onChange={(e) => setFollowupsDone(e.target.value)}
                        className={field}
                      />
                    </div>

                    <div>
                      <label htmlFor="mw-retention" className="label">
                        {L('পুরোনো ক্রেতার পুনঃঅর্ডার', 'Repeat Retention')}
                      </label>
                      <input
                        id="mw-retention"
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={retentionCount}
                        onChange={(e) => setRetentionCount(e.target.value)}
                        className={field}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Product-wise sales */}
              {products.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="card-header">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                        <ShoppingBag className="h-4 w-4" />
                      </span>
                      <h2 className="card-title">{L('পণ্যভিত্তিক বিক্রির হিসাব', 'Product Sales Breakdown')}</h2>
                    </div>
                    <span className="text-xs text-slate-500">
                      {L('মোট পণ্য বিক্রি', 'Total')}{' '}
                      <span className="text-sm font-semibold text-brand-700 tabular-nums">
                        {formatTaka(totalProductAmount)}
                      </span>
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {productSales.map((ps) => (
                      <li key={ps.product_id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-slate-900">{ps.product_name_bn}</div>
                          <div className="text-xs text-slate-500 tabular-nums">
                            {L('মূল্য: ৳')}
                            {ps.selling_price} / {ps.unit}
                          </div>
                        </div>
                        <div className="w-24 shrink-0">
                          <label htmlFor={`mw-qty-${ps.product_id}`} className="sr-only">
                            {L('পরিমাণ')}
                          </label>
                          <input
                            id={`mw-qty-${ps.product_id}`}
                            type="number"
                            min="0"
                            inputMode="decimal"
                            placeholder={L('পরিমাণ')}
                            value={ps.quantity || ''}
                            onChange={(e) => handleProductQuantityChange(ps.product_id, e.target.value)}
                            className={field}
                          />
                        </div>
                        <div className="w-20 shrink-0 text-right text-sm font-semibold text-slate-900 tabular-nums sm:w-28">
                          {formatTaka(ps.amount)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Notes */}
              <div className="card">
                <div className="card-header">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                      <FileText className="h-4 w-4" />
                    </span>
                    <h2 className="card-title">{L('দিনের নোট', 'Notes for the day')}</h2>
                  </div>
                </div>
                <div className="card-body">
                  <label htmlFor="mw-note" className="label">
                    {L('আগামীকালের অগ্রাধিকার ও মন্তব্য', 'Next Priorities & Notes')}
                  </label>
                  <textarea
                    id="mw-note"
                    rows={3}
                    value={dailyNote}
                    onChange={(e) => setDailyNote(e.target.value)}
                    placeholder={L('আজকের বিশেষ কোনো সমস্যা বা আগামী দিনের কাজের নোট...', 'Roadblocks or priorities for tomorrow...')}
                    className="input text-base sm:text-sm"
                  />
                </div>
              </div>

              {/* Save bar: pinned to the bottom on phones, inline on larger screens */}
              <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="submit"
                    disabled={savingEntry || !canEdit || isLocked}
                    className="btn btn-primary min-h-11 w-full px-6 sm:w-auto"
                  >
                    {savingEntry ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span>{L('দৈনিক এন্ট্রি সাবমিট করুন (+৫০ XP)', 'Save Daily Log (+50 XP)')}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </form>
      )}

      {/* ========================================================
          TAB 3: COMPLETED LINKS & BONUS LOG
      ======================================================== */}
      {activeTab === 'completed' && (
        <div className="card overflow-hidden">
          {completedLinks.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title={L('এখনো কোনো কাজ সম্পন্ন করেননি', 'No completed tasks yet')}
              description={L('পোস্ট ও কাজ তালিকা থেকে লিংক পোস্ট করুন বা অতিরিক্ত কাজ যোগ করুন।', 'Post links from Posts & tasks or log extra work to see them here.')}
              action={
                <button type="button" onClick={() => setActiveTab('links')} className="btn btn-secondary min-h-10">
                  <CheckSquare className="h-4 w-4" />
                  <span>{L('পোস্ট ও কাজ', 'Posts & tasks')}</span>
                </button>
              }
            />
          ) : (
            <ul className="stagger divide-y divide-slate-100">
              {completedLinks.map((link) => (
                <li
                  key={link.completion_id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-medium text-slate-500">{link.section_name}</span>
                        {link.is_extra_work && (
                          <span className="badge badge-amber">
                            <Zap className="h-3 w-3" />
                            {L('অতিরিক্ত বোনাস পোস্ট (+৫০ XP)', 'Extra Bonus Post (+50 XP)')}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-sm font-medium text-slate-700">{link.title || link.url}</div>
                      <div className="mt-0.5 truncate text-xs text-slate-400">{link.url}</div>
                    </div>
                  </div>

                  {undoEnabled && (
                    <button
                      type="button"
                      onClick={() => handleUndo(link)}
                      disabled={actionLoadingId === link.id}
                      className="btn btn-secondary min-h-10 w-full shrink-0 sm:w-auto"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>{L('পূর্বাবস্থায় ফেরান', 'Undo')}</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ========================================================
          MODAL: ADD EXTRA WORK / BONUS TASK
      ======================================================== */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="mw-extra-title">
            <div className="card-header flex-nowrap">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <Zap className="h-4 w-4" />
                </span>
                <h3 id="mw-extra-title" className="card-title">
                  {L('অতিরিক্ত কাজ / বোনাস পোস্ট যোগ করুন', 'Add Extra Work / Bonus Post')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="btn-icon h-10 w-10 shrink-0"
                aria-label={L('বন্ধ করুন', 'Close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddExtraSubmit} className="card-body space-y-4">
              <p className="text-sm text-slate-500">
                {L(
                  'অ্যাডমিনের নির্ধারিত কোটার বাইরে আপনি যেসব গ্রুপ পোস্ট বা কাজ করেছেন, তা এখানে যুক্ত করুন। সাথে সাথে আপনার পয়েন্ট যোগ হবে (+৫০ XP)।',
                  'Log self-initiated extra posts beyond assigned quota to claim bonus score (+50 XP).'
                )}
              </p>

              <div>
                <label htmlFor="mw-extra-url" className="label">
                  {L('কাজের / পোস্টের লিংক (URL)', 'Work / Post URL')} <span className="text-rose-500">*</span>
                </label>
                <input
                  id="mw-extra-url"
                  type="url"
                  required
                  placeholder="https://facebook.com/groups/..."
                  value={extraUrl}
                  onChange={(e) => setExtraUrl(e.target.value)}
                  className="input min-h-10 text-base sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="mw-extra-title" className="label">
                  {L('শিরোনাম / বিবরণ (ঐচ্ছিক)', 'Title / Description (Optional)')}
                </label>
                <input
                  id="mw-extra-title"
                  type="text"
                  placeholder={L('যেমন: কৃষি ফোরামে নতুন পোস্ট', 'e.g. Extra post in agri group')}
                  value={extraTitle}
                  onChange={(e) => setExtraTitle(e.target.value)}
                  className="input min-h-10 text-base sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="mw-extra-section" className="label">
                  {L('সেকশন নির্বাচন করুন', 'Select Section')} <span className="text-rose-500">*</span>
                </label>
                <select
                  id="mw-extra-section"
                  value={extraSectionId}
                  onChange={(e) => setExtraSectionId(e.target.value)}
                  className="input min-h-10 text-base sm:text-sm"
                >
                  {assignedSections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary min-h-10">
                  {L('বাতিল', 'Cancel')}
                </button>
                <button type="submit" disabled={savingExtra || !extraUrl.trim()} className="btn btn-primary min-h-10">
                  {savingExtra ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
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
          <div className="flex items-start gap-3">
            <div aria-hidden className="skeleton h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div aria-hidden className="skeleton h-6 w-56" />
              <div aria-hidden className="skeleton h-3.5 w-full max-w-md" />
            </div>
          </div>
          <div className="card space-y-5 p-5">
            <div className="flex items-center gap-4">
              <div aria-hidden className="skeleton h-16 w-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <div aria-hidden className="skeleton h-3 w-24" />
                <div aria-hidden className="skeleton h-5 w-2/3" />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div aria-hidden className="skeleton h-11 w-full rounded-xl" />
              <div aria-hidden className="skeleton h-11 w-full rounded-xl" />
            </div>
          </div>
          <div aria-hidden className="skeleton h-12 w-full rounded-xl sm:w-96" />
          <div className="card divide-y divide-slate-100">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2 p-4">
                <div aria-hidden className="skeleton h-4 w-20 rounded-full" />
                <div aria-hidden className="skeleton h-4 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      }
    >
      <EmployeeMyWorkContent />
    </Suspense>
  );
}
