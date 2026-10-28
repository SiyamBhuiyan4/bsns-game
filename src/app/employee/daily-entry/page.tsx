'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Package,
  Users,
  Megaphone,
  MessageSquare,
  FileText,
  Clock,
  Save,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { formatTaka, getDhakaDateString } from '@/lib/date';
import {
  WARNING_MESSAGES,
  LOCK_NOTICE,
  SAVE_SUCCESS_MESSAGE,
} from '@/lib/daily-entry';
import PageHeader from '@/components/ui/PageHeader';
import { useLanguage } from '@/components/LanguageContext';
import EmptyState from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

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

interface HistoryRow {
  entry_date: string;
  metric_type: string;
  value: number;
  note?: string | null;
}

interface ProductSaleResponse {
  product_id: string;
  product_name_bn: string;
  product_name_en: string;
  unit: string;
  selling_price: number;
  quantity: number;
  amount: number;
}

export default function EmployeeDailyEntryPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/employee/my-work?tab=daily_entry');
  }, [router]);

  const { lang, L } = useLanguage();
  const [selectedDate, setSelectedDate] = useState(() => getDhakaDateString());
  const [products, setProducts] = useState<Product[]>([]);
  const productsRef = useRef<Product[]>([]);
  const loadAbortRef = useRef<AbortController | null>(null);
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Status & Edit state
  const [isLocked, setIsLocked] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [isAdminForbidden, setIsAdminForbidden] = useState(false);
  const [todayDhaka, setTodayDhaka] = useState('');
  const [oldestAllowed, setOldestAllowed] = useState('');

  // Auto-calculated completed posts from task queue
  const [postsDone, setPostsDone] = useState(0);
  const [postsInput, setPostsInput] = useState<string>('0');

  // 1. বিক্রি: মোট বিক্রি (৳), লাভ (৳), নিশ্চিত অর্ডার (সংখ্যা)
  const [salesAmount, setSalesAmount] = useState<string>('0');
  const [profitAmount, setProfitAmount] = useState<string>('0');
  const [confirmedOrders, setConfirmedOrders] = useState<string>('0');

  // 2. পণ্যভিত্তিক বিক্রি: row per product, quantity and amount
  const [productSales, setProductSales] = useState<ProductSaleRow[]>([]);

  // 3. লিড ও ক্রেতা: নতুন লিড (সংখ্যা), নতুন ক্রেতা (সংখ্যা), পুরোনো ক্রেতা ধরে রাখা (সংখ্যা)
  const [newLeads, setNewLeads] = useState<string>('0');
  const [newClients, setNewClients] = useState<string>('0');
  const [retentionCount, setRetentionCount] = useState<string>('0');

  // 4. বিজ্ঞাপন: বিজ্ঞাপনের খরচ (৳)
  const [adSpend, setAdSpend] = useState<string>('0');

  // 5. ফলোআপ: ফলোআপ সম্পন্ন (সংখ্যা)
  const [followupsDone, setFollowupsDone] = useState<string>('0');

  // 6. B2B: B2B অর্ডার (সংখ্যা), বড় B2B অনুসন্ধান (সংখ্যা), সম্ভাব্য মূল্য (৳)
  const [b2bOrders, setB2bOrders] = useState<string>('0');
  const [b2bInquiries, setB2bInquiries] = useState<string>('0');
  const [b2bInquiryValue, setB2bInquiryValue] = useState<string>('0');

  // 7. টেক্সট: প্রধান সমস্যা (max 500), আগামী দিনের অগ্রাধিকার (max 500)
  const [mainIssue, setMainIssue] = useState('');
  const [nextPriorities, setNextPriorities] = useState('');

  // 8. Note per field (max 300)
  const [metricNotes, setMetricNotes] = useState<Record<string, string>>({});
  const [openNoteFields, setOpenNoteFields] = useState<Record<string, boolean>>({});

  // History for 7 days
  const [history, setHistory] = useState<HistoryRow[]>([]);

  // Alerts
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const toggleNoteField = (field: string) => {
    setOpenNoteFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const setNote = (field: string, text: string) => {
    setMetricNotes((prev) => ({ ...prev, [field]: text.slice(0, 300) }));
  };

  // Fetch initial active products and daily entry
  const loadDayData = useCallback(async (dateStr: string) => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const isStale = () => controller.signal.aborted || selectedDateRef.current !== dateStr;
    try {
      setLoading(true);
      setErrorMsg('');
      setSuccessMsg('');
      setIsAdminForbidden(false);

      // Fetch products if not loaded
      let prods = productsRef.current;
      if (prods.length === 0) {
        const prodRes = await fetch('/api/products', { signal: controller.signal });
        if (prodRes.ok) {
          const pData = await prodRes.json();
          prods = pData.products || [];
          productsRef.current = prods;
          if (!isStale()) setProducts(prods);
        }
      }
      if (isStale()) return;

      const res = await fetch(`/api/employee/daily-entry?date=${dateStr}`, { signal: controller.signal });
      if (isStale()) return;
      if (res.status === 403) {
        const errJson = await res.json();
        if (isStale()) return;
        if (errJson.is_admin_forbidden) {
          setIsAdminForbidden(true);
          setCanEdit(false);
          return;
        }
      }

      if (!res.ok) {
        throw new Error(L('তথ্য লোড করতে সমস্যা হয়েছে'));
      }

      const data = await res.json();
      if (isStale()) return;
      setIsLocked(data.is_locked);
      setCanEdit(data.can_edit);
      setTodayDhaka(data.today);
      setOldestAllowed(data.oldest_allowed);

      // Metrics
      const m = data.metrics || {};
      const postsCountVal = m.POSTS_DONE?.value || 0;
      setPostsDone(postsCountVal);
      setPostsInput(String(postsCountVal));

      // 1. বিক্রি
      setSalesAmount(String(m.SALES_AMOUNT?.value ?? 0));
      setProfitAmount(String(m.PROFIT_AMOUNT?.value ?? 0));
      setConfirmedOrders(String(m.CONFIRMED_ORDERS?.value ?? 0));

      // 3. লিড ও ক্রেতা
      setNewLeads(String(m.NEW_LEADS?.value ?? 0));
      setNewClients(String(m.NEW_CLIENTS?.value ?? 0));
      setRetentionCount(String(m.RETENTION_COUNT?.value ?? 0));

      // 4. বিজ্ঞাপন
      setAdSpend(String(m.AD_SPEND?.value ?? 0));

      // 5. ফলোআপ
      setFollowupsDone(String(m.FOLLOWUPS_DONE?.value ?? 0));

      // 6. B2B
      setB2bOrders(String(m.B2B_ORDERS?.value ?? 0));
      setB2bInquiries(String(m.B2B_INQUIRIES?.value ?? 0));
      setB2bInquiryValue(String(m.B2B_INQUIRY_VALUE?.value ?? 0));

      // Notes
      const notes: Record<string, string> = {};
      const activeNotes: Record<string, boolean> = {};
      for (const key of Object.keys(m)) {
        if (m[key]?.note) {
          notes[key] = m[key].note;
          activeNotes[key] = true;
        }
      }
      setMetricNotes(notes);
      setOpenNoteFields((prev) => ({ ...prev, ...activeNotes }));

      // 2. Product sales map with selling_price multiplication
      const existingSales: Record<string, ProductSaleResponse> = {};
      ((data.product_sales || []) as ProductSaleResponse[]).forEach((ps) => {
        existingSales[ps.product_id] = ps;
      });

      const initialProductRows: ProductSaleRow[] = prods.map((p) => {
        const row = existingSales[p.id];
        const unitPrice = Number(p.selling_price) || 0;
        const qty = row ? Number(row.quantity) : 0;
        const amt = row ? Number(row.amount) : (qty > 0 ? Math.round(qty * unitPrice * 100) / 100 : 0);
        return {
          product_id: p.id,
          product_name_bn: p.name_bn,
          unit: p.unit,
          selling_price: unitPrice,
          quantity: qty,
          amount: amt,
        };
      });
      setProductSales(initialProductRows);

      // 7. Daily text
      setMainIssue(data.daily_text?.main_issue || '');
      setNextPriorities(data.daily_text?.next_priorities || '');

      // History
      setHistory(data.history || []);
    } catch (err: unknown) {
      if (isStale()) return;
      setErrorMsg(err instanceof Error ? err.message : L('ত্রুটি হয়েছে'));
    } finally {
      if (!isStale()) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDayData(selectedDate);
    return () => loadAbortRef.current?.abort();
  }, [selectedDate, loadDayData]);

  // Product change with selling_price multiplication
  const handleProductChange = (
    index: number,
    field: 'quantity' | 'amount',
    val: number
  ) => {
    setProductSales((prev) => {
      const copy = [...prev];
      const row = { ...copy[index] };
      if (field === 'quantity') {
        row.quantity = val;
        // Selling price multiplication: amount = quantity * selling_price
        const price = Number(row.selling_price) || 0;
        row.amount = Math.round(val * price * 100) / 100;
      } else if (field === 'amount') {
        row.amount = val;
      }
      copy[index] = row;
      return copy;
    });
  };

  // Business Warnings Logic (Section 7.2)
  const numSales = parseFloat(salesAmount) || 0;
  const numProfit = parseFloat(profitAmount) || 0;
  const numConfirmedOrders = parseInt(confirmedOrders, 10) || 0;
  const numNewLeads = parseInt(newLeads, 10) || 0;
  const numNewClients = parseInt(newClients, 10) || 0;
  const numRetention = parseInt(retentionCount, 10) || 0;
  const numAdSpend = parseFloat(adSpend) || 0;
  const numFollowups = parseInt(followupsDone, 10) || 0;
  const numB2bOrders = parseInt(b2bOrders, 10) || 0;
  const numB2bInquiries = parseInt(b2bInquiries, 10) || 0;
  const numB2bInquiryValue = parseFloat(b2bInquiryValue) || 0;

  // Warning 1: Profit > Sales
  const isProfitHigherThanSales = numProfit > numSales;

  // Warning 2: Confirmed Orders > New Leads
  const isConfirmedOrdersHigherThanNewLeads = numConfirmedOrders > numNewLeads;

  // Warning 3: B2B Orders > B2B Inquiries
  const isB2bOrdersHigherThanInquiries = numB2bOrders > numB2bInquiries;

  // Product sales sum
  const totalProductSalesAmount = productSales.reduce(
    (sum, r) => sum + (parseFloat(String(r.amount)) || 0),
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Business Warnings: Non-blocking warning confirmation before submit
    const activeWarnings: string[] = [];
    if (isProfitHigherThanSales) {
      activeWarnings.push(WARNING_MESSAGES.PROFIT_EXCEEDS_SALES);
    }
    if (isConfirmedOrdersHigherThanNewLeads) {
      activeWarnings.push(WARNING_MESSAGES.ORDERS_EXCEED_LEADS);
    }
    if (isB2bOrdersHigherThanInquiries) {
      activeWarnings.push(WARNING_MESSAGES.B2B_ORDERS_EXCEED_INQUIRIES);
    }

    if (activeWarnings.length > 0) {
      const confirmText = L(`${activeWarnings.join('\n')}\n\nআপনি কি নিশ্চিত যে এই তথ্য সংরক্ষণ করবেন?`);
      if (!window.confirm(confirmText)) {
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        entry_date: selectedDate,
        metrics: {
          POSTS_DONE: parseInt(postsInput, 10) || 0,
          SALES_AMOUNT: numSales,
          PROFIT_AMOUNT: numProfit,
          CONFIRMED_ORDERS: numConfirmedOrders,
          NEW_LEADS: numNewLeads,
          NEW_CLIENTS: numNewClients,
          RETENTION_COUNT: numRetention,
          AD_SPEND: numAdSpend,
          FOLLOWUPS_DONE: numFollowups,
          B2B_ORDERS: numB2bOrders,
          B2B_INQUIRIES: numB2bInquiries,
          B2B_INQUIRY_VALUE: numB2bInquiryValue,
        },
        product_sales: productSales
          .filter((p) => p.quantity > 0 || p.amount > 0)
          .map((p) => ({
            product_id: p.product_id,
            quantity: parseFloat(String(p.quantity)) || 0,
            amount: parseFloat(String(p.amount)) || 0,
          })),
        daily_text: {
          main_issue: mainIssue.trim() || null,
          next_priorities: nextPriorities.trim() || null,
        },
        metric_notes: metricNotes,
      };

      const res = await fetch('/api/employee/daily-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || L('তথ্য সংরক্ষণ করা যায়নি'));
      }

      setSuccessMsg(data.message || L(SAVE_SUCCESS_MESSAGE));
      loadDayData(selectedDate);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : L('ত্রুটি হয়েছে'));
    } finally {
      setSaving(false);
    }
  };

  // Helper component to render note input
  const renderNoteInput = (metricKey: string) => {
    const isOpen = openNoteFields[metricKey];
    const noteVal = metricNotes[metricKey] || '';

    return (
      <div className="mt-1.5">
        {!isOpen && (
          <button
            type="button"
            onClick={() => toggleNoteField(metricKey)}
            className="-my-1.5 inline-flex min-h-10 items-center text-xs font-medium text-brand-700 hover:text-brand-800"
          >
            {L('+ নোট', '+ Add note')}
          </button>
        )}
        {isOpen && (
          <div className="mt-1 space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor={`note-${metricKey}`} className="text-[11px] font-medium text-slate-500">
                {L('নোট', 'Note')}
              </label>
              <span className="text-[11px] text-slate-400 tabular-nums">{noteVal.length}/300</span>
            </div>
            <input
              id={`note-${metricKey}`}
              type="text"
              maxLength={300}
              disabled={!canEdit}
              value={noteVal}
              onChange={(e) => setNote(metricKey, e.target.value)}
              placeholder={L('বিস্তারিত লিখুন', 'Details')}
              className="input min-h-10 py-1.5 text-base sm:min-h-0 sm:text-xs"
            />
          </div>
        )}
      </div>
    );
  };

  const sectionHeader = (icon: ReactNode, title: string, subtitle: string, right?: ReactNode) => (
    <div className="card-header">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="card-title">{title}</h2>
          <p className="card-subtitle">{subtitle}</p>
        </div>
      </div>
      {right}
    </div>
  );

  const warnInput = (warn: boolean) =>
    `input tabular-nums ${warn ? 'border-amber-500 bg-amber-50/40 focus:border-amber-500 focus:ring-amber-500/20' : ''}`;

  // Group history by date for 7-day summary table
  const historyByDate: Record<string, Record<string, number>> = {};
  history.forEach((h) => {
    const d = h.entry_date ? new Date(h.entry_date).toISOString().slice(0, 10) : '';
    if (!d) return;
    if (!historyByDate[d]) historyByDate[d] = {};
    historyByDate[d][h.metric_type] = Number(h.value);
  });
  const historyDates = Object.keys(historyByDate).sort().reverse();

  if (isAdminForbidden) {
    return (
      <div className="card">
        <EmptyState
          icon={<ShieldAlert className="h-5 w-5 text-rose-600" />}
          title={L('অ্যাডমিন প্রবেশাধিকার নেই', 'Admin access not allowed')}
          description={L('অ্যাডমিন কর্মচারীর দৈনিক এন্ট্রি খুলতে বা জমা দিতে পারবেন না।', 'Admins cannot open or submit the employee daily entry.')}
          action={
            <Link href="/admin/dashboard" className="btn btn-primary">
              {L('অ্যাডমিন ড্যাশবোর্ড', 'Admin dashboard')}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<FileText className="h-5 w-5" />}
        title={L('দৈনিক এন্ট্রি', 'Daily Entry')}
        subtitle={L('আজকের বিক্রি, লিড, বিজ্ঞাপন ও কাজের হিসাব লিখুন।', "Log today's sales, leads and work.")}
        actions={
          <>
            <div className="relative">
              <label htmlFor="de-date" className="sr-only">
                {L('তারিখ', 'Date')}
              </label>
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="de-date"
                type="date"
                max={todayDhaka || getDhakaDateString()}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input min-h-10 w-full pl-9 font-medium tabular-nums sm:w-auto"
              />
            </div>
            <div className="segmented">
              <button
                type="button"
                className="min-h-9"
                data-active={selectedDate === (todayDhaka || getDhakaDateString())}
                onClick={() => {
                  setSelectedDate(todayDhaka || getDhakaDateString());
                }}
              >
                {L('আজ', 'Today')}
              </button>
              {oldestAllowed && (
                <button
                  type="button"
                  className="min-h-9"
                  data-active={selectedDate === oldestAllowed}
                  onClick={() => setSelectedDate(oldestAllowed)}
                >
                  {L('গতকাল', 'Yesterday')}
                </button>
              )}
            </div>
          </>
        }
      />

      {/* Lock notice or edit window */}
      {isLocked ? (
        <div className="alert alert-warning">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <div className="font-medium">{L(LOCK_NOTICE)}</div>
            <p className="text-xs">
              {L('শুধু আজ ও গতকালের তথ্য সম্পাদন করা যায়; এই তারিখ শুধু দেখা যাবে।', 'Only today and yesterday can be edited; this date is read-only.')}
            </p>
            {oldestAllowed && todayDhaka && (
              <p className="text-xs font-medium tabular-nums">
                {L('সম্পাদনযোগ্য:', 'Editable:')} {oldestAllowed} – {todayDhaka}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="alert alert-info flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Unlock className="h-4 w-4 shrink-0" />
            <span>{L('আজ ও গতকালের এন্ট্রি সম্পাদন করা যাবে', 'Today and yesterday are editable')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>
              {L('টাস্ক কিউ পোস্ট:', 'Queue posts:')} <strong className="font-semibold tabular-nums">{postsDone}</strong>
            </span>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="alert alert-error">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-6" role="status" aria-busy="true">
          <span className="sr-only">{L('লোড হচ্ছে...', 'Loading...')}</span>
          {[0, 1].map((card) => (
            <div key={card} className="card space-y-4 p-5">
              <Skeleton className="h-4 w-40" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={`space-y-6 ${canEdit ? 'pb-20 sm:pb-0' : ''}`}>
          {/* Posts done */}
          <div className="card">
            {sectionHeader(
              <Megaphone className="h-4 w-4" />,
              L('গ্রুপ পোস্ট', 'Group posts'),
              L('আজকের সম্পন্ন ফেসবুক গ্রুপ পোস্ট', 'Facebook group posts done today'),
              <span className="badge badge-green">
                <CheckCircle2 className="h-3 w-3" />
                {L('কিউ থেকে:', 'From queue:')} {postsDone}
              </span>
            )}
            <div className="card-body">
              <div className="max-w-md">
                <label htmlFor="de-posts" className="label">
                  {L('গ্রুপ পোস্ট সম্পন্ন', 'Posts done')} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">#</span>
                  <input
                    id="de-posts"
                    type="number"
                    step="1"
                    min="0"
                    disabled={!canEdit}
                    value={postsInput}
                    onChange={(e) => setPostsInput(e.target.value)}
                    className="input pl-8 tabular-nums"
                    placeholder="0"
                    required
                  />
                </div>
                <p className="hint">{L('টাস্ক কিউ থেকে স্বয়ংক্রিয়; প্রয়োজনে বদলান।', 'Filled from your task queue; adjust if needed.')}</p>
                {renderNoteInput('POSTS_DONE')}
              </div>
            </div>
          </div>

          {/* 1. Sales */}
          <div className="card">
            {sectionHeader(
              <DollarSign className="h-4 w-4" />,
              L('১. বিক্রি', '1. Sales'),
              L('মোট বিক্রি, লাভ ও নিশ্চিত অর্ডার', 'Sales, profit and confirmed orders')
            )}
            <div className="card-body space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="de-sales" className="label">
                    {L('মোট বিক্রি (৳)', 'Sales (৳)')} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{L("৳")}</span>
                    <input
                      id="de-sales"
                      type="number"
                      step="any"
                      min="0"
                      disabled={!canEdit}
                      value={salesAmount}
                      onChange={(e) => setSalesAmount(e.target.value)}
                      className="input pl-8 tabular-nums"
                      placeholder="0.00"
                      required
                    />
                  </div>
                  {renderNoteInput('SALES_AMOUNT')}
                </div>

                <div>
                  <label htmlFor="de-profit" className="label">
                    {L('লাভ (৳)', 'Profit (৳)')} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{L("৳")}</span>
                    <input
                      id="de-profit"
                      type="number"
                      step="any"
                      min="0"
                      disabled={!canEdit}
                      value={profitAmount}
                      onChange={(e) => setProfitAmount(e.target.value)}
                      className={`${warnInput(isProfitHigherThanSales)} pl-8`}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  {renderNoteInput('PROFIT_AMOUNT')}
                </div>

                <div>
                  <label htmlFor="de-orders" className="label">
                    {L('নিশ্চিত অর্ডার', 'Confirmed orders')} <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">#</span>
                    <input
                      id="de-orders"
                      type="number"
                      step="1"
                      min="0"
                      disabled={!canEdit}
                      value={confirmedOrders}
                      onChange={(e) => setConfirmedOrders(e.target.value)}
                      className={`${warnInput(isConfirmedOrdersHigherThanNewLeads)} pl-8`}
                      placeholder="0"
                      required
                    />
                  </div>
                  {renderNoteInput('CONFIRMED_ORDERS')}
                </div>
              </div>

              {isProfitHigherThanSales && (
                <div className="alert alert-warning">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{WARNING_MESSAGES.PROFIT_EXCEEDS_SALES}</span>
                </div>
              )}
            </div>
          </div>

          {/* 2. Product-wise sales */}
          <div className="card">
            {sectionHeader(
              <Package className="h-4 w-4" />,
              L('২. পণ্যভিত্তিক বিক্রি', '2. Products'),
              L('প্রতিটি পণ্যের পরিমাণ ও টাকা', 'Quantity and amount per product'),
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">
                  {L('মোট:', 'Total:')}{' '}
                  <span className="text-sm font-semibold text-slate-900 tabular-nums">
                    {formatTaka(totalProductSalesAmount)}
                  </span>
                </span>
                {canEdit && totalProductSalesAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => setSalesAmount(String(totalProductSalesAmount))}
                    className="btn btn-secondary btn-sm"
                    title={L("পণ্যের মোট টাকা 'মোট বিক্রি' ঘরে বসান", 'Copy to Sales')}
                  >
                    {L('বিক্রিতে কপি', 'Copy to sales')}
                  </button>
                )}
              </div>
            )}

            {productSales.length === 0 ? (
              <EmptyState icon={<Package className="h-5 w-5" />} title={L('কোনো সক্রিয় পণ্য নেই', 'No active products')} />
            ) : (
              <>
                <div className="hidden border-b border-slate-200 bg-slate-50/80 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-4">
                  <span>{L('পণ্য', 'Product')}</span>
                  <span>{L('মূল্য', 'Price')}</span>
                  <span>{L('পরিমাণ', 'Qty')}</span>
                  <span>{L('মোট (৳)', 'Amount (৳)')}</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {productSales.map((ps, idx) => (
                    <li
                      key={ps.product_id}
                      className="grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-4 sm:px-5"
                    >
                      <div className="col-span-2 flex items-baseline justify-between gap-2 sm:col-span-1 sm:block">
                        <div className="truncate text-sm font-medium text-slate-900">{ps.product_name_bn}</div>
                        <div className="text-xs text-slate-500">{ps.unit}</div>
                      </div>
                      <div className="col-span-2 text-xs text-slate-500 sm:col-span-1 sm:text-sm sm:text-slate-700 tabular-nums">
                        <span className="sm:hidden">{L('মূল্য: ', 'Price: ')}</span>
                        {formatTaka(ps.selling_price)}
                      </div>
                      <div>
                        <label htmlFor={`de-qty-${ps.product_id}`} className="label sm:sr-only">
                          {L('পরিমাণ', 'Qty')}
                        </label>
                        <input
                          id={`de-qty-${ps.product_id}`}
                          type="number"
                          step="any"
                          min="0"
                          disabled={!canEdit}
                          value={ps.quantity || ''}
                          onChange={(e) =>
                            handleProductChange(idx, 'quantity', parseFloat(e.target.value) || 0)
                          }
                          className="input tabular-nums"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label htmlFor={`de-amt-${ps.product_id}`} className="label sm:sr-only">
                          {L('মোট (৳)', 'Amount (৳)')}
                        </label>
                        <input
                          id={`de-amt-${ps.product_id}`}
                          type="number"
                          step="any"
                          min="0"
                          disabled={!canEdit}
                          value={ps.amount || ''}
                          onChange={(e) =>
                            handleProductChange(idx, 'amount', parseFloat(e.target.value) || 0)
                          }
                          className="input tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              {L('পরিমাণ লিখলে মূল্য × পরিমাণ স্বয়ংক্রিয় হিসাব হয়; প্রয়োজনে বদলান।', 'Amount is auto-calculated from quantity × price; you can adjust it.')}
            </div>
          </div>

          {/* 3. Leads & clients */}
          <div className="card">
            {sectionHeader(
              <Users className="h-4 w-4" />,
              L('৩. লিড ও ক্রেতা', '3. Leads & clients'),
              L('নতুন লিড, নতুন ও পুরোনো ক্রেতা', 'New leads, new and returning clients')
            )}
            <div className="card-body space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="de-leads" className="label">
                    {L('নতুন লিড', 'New leads')}
                  </label>
                  <input
                    id="de-leads"
                    type="number"
                    min="0"
                    step="1"
                    disabled={!canEdit}
                    value={newLeads}
                    onChange={(e) => setNewLeads(e.target.value)}
                    className={warnInput(isConfirmedOrdersHigherThanNewLeads)}
                    placeholder="0"
                  />
                  {renderNoteInput('NEW_LEADS')}
                </div>

                <div>
                  <label htmlFor="de-clients" className="label">
                    {L('নতুন ক্রেতা', 'New clients')}
                  </label>
                  <input
                    id="de-clients"
                    type="number"
                    min="0"
                    step="1"
                    disabled={!canEdit}
                    value={newClients}
                    onChange={(e) => setNewClients(e.target.value)}
                    className="input tabular-nums"
                    placeholder="0"
                  />
                  {renderNoteInput('NEW_CLIENTS')}
                </div>

                <div>
                  <label htmlFor="de-retention" className="label">
                    {L('পুরোনো ক্রেতা ধরে রাখা', 'Retained')}
                  </label>
                  <input
                    id="de-retention"
                    type="number"
                    min="0"
                    step="1"
                    disabled={!canEdit}
                    value={retentionCount}
                    onChange={(e) => setRetentionCount(e.target.value)}
                    className="input tabular-nums"
                    placeholder="0"
                  />
                  {renderNoteInput('RETENTION_COUNT')}
                </div>
              </div>

              {isConfirmedOrdersHigherThanNewLeads && (
                <div className="alert alert-warning">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{WARNING_MESSAGES.ORDERS_EXCEED_LEADS}</span>
                </div>
              )}
            </div>
          </div>

          {/* 4 + 5. Advertising and follow-ups */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card">
              {sectionHeader(
                <Megaphone className="h-4 w-4" />,
                L('৪. বিজ্ঞাপন', '4. Advertising'),
                L('আজকের বিজ্ঞাপন খরচ', "Today's ad spend")
              )}
              <div className="card-body">
                <label htmlFor="de-ad" className="label">
                  {L('বিজ্ঞাপনের খরচ (৳)', 'Ad spend (৳)')}
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{L("৳")}</span>
                  <input
                    id="de-ad"
                    type="number"
                    step="any"
                    min="0"
                    disabled={!canEdit}
                    value={adSpend}
                    onChange={(e) => setAdSpend(e.target.value)}
                    className="input pl-8 tabular-nums"
                    placeholder="0.00"
                  />
                </div>
                {renderNoteInput('AD_SPEND')}
              </div>
            </div>

            <div className="card">
              {sectionHeader(
                <MessageSquare className="h-4 w-4" />,
                L('৫. ফলোআপ', '5. Follow-ups'),
                L('আজকের মেসেজ ও কল ফলোআপ', 'Messages and calls today')
              )}
              <div className="card-body">
                <label htmlFor="de-followups" className="label">
                  {L('ফলোআপ সম্পন্ন', 'Follow-ups done')}
                </label>
                <input
                  id="de-followups"
                  type="number"
                  min="0"
                  step="1"
                  disabled={!canEdit}
                  value={followupsDone}
                  onChange={(e) => setFollowupsDone(e.target.value)}
                  className="input tabular-nums"
                  placeholder="0"
                />
                {renderNoteInput('FOLLOWUPS_DONE')}
              </div>
            </div>
          </div>

          {/* 6. B2B */}
          <div className="card">
            {sectionHeader(
              <TrendingUp className="h-4 w-4" />,
              L('৬. B2B · পাইকার / কর্পোরেট / রেস্তোরাঁ', '6. B2B · Wholesale / Corporate / Restaurant'),
              L('B2B অর্ডার, অনুসন্ধান ও সম্ভাব্য মূল্য', 'Orders, inquiries and potential value')
            )}
            <div className="card-body space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="de-b2b-orders" className="label">
                    {L('B2B অর্ডার', 'Orders')}
                  </label>
                  <input
                    id="de-b2b-orders"
                    type="number"
                    min="0"
                    step="1"
                    disabled={!canEdit}
                    value={b2bOrders}
                    onChange={(e) => setB2bOrders(e.target.value)}
                    className={warnInput(isB2bOrdersHigherThanInquiries)}
                    placeholder="0"
                  />
                  {renderNoteInput('B2B_ORDERS')}
                </div>

                <div>
                  <label htmlFor="de-b2b-inq" className="label">
                    {L('বড় B2B অনুসন্ধান', 'Inquiries')}
                  </label>
                  <input
                    id="de-b2b-inq"
                    type="number"
                    min="0"
                    step="1"
                    disabled={!canEdit}
                    value={b2bInquiries}
                    onChange={(e) => setB2bInquiries(e.target.value)}
                    className="input tabular-nums"
                    placeholder="0"
                  />
                  {renderNoteInput('B2B_INQUIRIES')}
                </div>

                <div>
                  <label htmlFor="de-b2b-value" className="label">
                    {L('সম্ভাব্য মূল্য (৳)', 'Potential value (৳)')}
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{L("৳")}</span>
                    <input
                      id="de-b2b-value"
                      type="number"
                      step="any"
                      min="0"
                      disabled={!canEdit}
                      value={b2bInquiryValue}
                      onChange={(e) => setB2bInquiryValue(e.target.value)}
                      className="input pl-8 tabular-nums"
                      placeholder="0.00"
                    />
                  </div>
                  {renderNoteInput('B2B_INQUIRY_VALUE')}
                </div>
              </div>

              {isB2bOrdersHigherThanInquiries && (
                <div className="alert alert-warning">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{WARNING_MESSAGES.B2B_ORDERS_EXCEED_INQUIRIES}</span>
                </div>
              )}
            </div>
          </div>

          {/* 7. Reflection */}
          <div className="card">
            {sectionHeader(
              <FileText className="h-4 w-4" />,
              L('৭. দিনের প্রতিফলন', '7. Reflection'),
              L('প্রধান সমস্যা ও আগামী দিনের অগ্রাধিকার', 'Main issue and next priorities')
            )}
            <div className="card-body space-y-4">
              <div>
                <label htmlFor="de-issue" className="label">
                  {L('প্রধান সমস্যা', 'Main issue')}
                </label>
                <textarea
                  id="de-issue"
                  rows={2}
                  maxLength={500}
                  disabled={!canEdit}
                  value={mainIssue}
                  onChange={(e) => setMainIssue(e.target.value)}
                  placeholder={L('আজ কী বাধা ছিল?', 'What got in the way today?')}
                  className="input"
                />
                <span className="mt-1 block text-right text-[11px] text-slate-400 tabular-nums">
                  {mainIssue.length}/500
                </span>
              </div>

              <div>
                <label htmlFor="de-next" className="label">
                  {L('আগামী দিনের অগ্রাধিকার', 'Next priorities')}
                </label>
                <textarea
                  id="de-next"
                  rows={2}
                  maxLength={500}
                  disabled={!canEdit}
                  value={nextPriorities}
                  onChange={(e) => setNextPriorities(e.target.value)}
                  placeholder={L('আগামীকাল কী আগে করবেন?', 'What comes first tomorrow?')}
                  className="input"
                />
                <span className="mt-1 block text-right text-[11px] text-slate-400 tabular-nums">
                  {nextPriorities.length}/500
                </span>
              </div>
            </div>
          </div>

          {canEdit && (
            /* Save bar: pinned to the bottom on phones so it is always in reach; inline on larger screens. */
            <div className="fixed inset-x-0 bottom-0 z-30 flex justify-end border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <button type="submit" disabled={saving} className="btn btn-primary min-h-11 w-full px-6 sm:w-auto">
                <Save className="h-4 w-4" />
                {saving ? L('সংরক্ষণ হচ্ছে...', 'Saving...') : L('সংরক্ষণ করুন', 'Save entry')}
              </button>
            </div>
          )}
        </form>
      )}

      {/* Daily report link */}
      <div className="card card-body flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="card-title">{L('দৈনিক রিপোর্ট', 'Daily report')}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{L('আজকের পয়েন্ট, স্কোর ও লক্ষ্য দেখুন', "See today's points, score and targets")}</p>
        </div>
        <Link href="/employee/performance?period=daily" className="btn btn-secondary shrink-0">
          <span>{L('রিপোর্ট দেখুন', 'View report')}</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Last 7 days */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Clock className="h-4 w-4" />
            </span>
            <h3 className="card-title">{L('গত ৭ দিন', 'Last 7 days')}</h3>
          </div>
          <span className="card-subtitle">
            {L('রেকর্ড:', 'Days recorded:')} {historyDates.length}
          </span>
        </div>

        {historyDates.length === 0 ? (
          <EmptyState icon={<Clock className="h-5 w-5" />} title={L('গত ৭ দিনের কোনো রেকর্ড নেই', 'No records in the last 7 days')} />
        ) : (
          <>
            {/* Phone: stacked rows */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {historyDates.map((d) => {
                const row = historyByDate[d] || {};
                return (
                  <li key={d} className="px-4 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-900 tabular-nums">{d}</span>
                      <span className="text-sm font-semibold text-brand-700 tabular-nums">
                        {formatTaka(row.SALES_AMOUNT || 0)}
                      </span>
                    </div>
                    <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
                      {[
                        [L('পোস্ট', 'Posts'), row.POSTS_DONE ?? 0],
                        [L('লাভ', 'Profit'), formatTaka(row.PROFIT_AMOUNT || 0)],
                        [L('অর্ডার', 'Orders'), row.CONFIRMED_ORDERS ?? 0],
                        [L('লিড', 'Leads'), row.NEW_LEADS ?? 0],
                        [L('ক্রেতা', 'Clients'), row.NEW_CLIENTS ?? 0],
                        [L('বিজ্ঞাপন', 'Ads'), formatTaka(row.AD_SPEND || 0)],
                        [L('ফলোআপ', 'Follow-ups'), row.FOLLOWUPS_DONE ?? 0],
                        ['B2B', row.B2B_ORDERS ?? 0],
                      ].map(([k, v]) => (
                        <div key={String(k)} className="min-w-0">
                          <dt className="truncate text-slate-500">{k}</dt>
                          <dd className="font-medium text-slate-900 tabular-nums">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                );
              })}
            </ul>

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="table-pro">
                <thead>
                  <tr>
                    <th>{L('তারিখ', 'Date')}</th>
                    <th>{L("পোস্ট")}</th>
                    <th>{L("বিক্রি (৳)")}</th>
                    <th>{L("লাভ (৳)")}</th>
                    <th>{L("অর্ডার")}</th>
                    <th>{L("লিড")}</th>
                    <th>{L("নতুন ক্রেতা")}</th>
                    <th>{L("বিজ্ঞাপন (৳)")}</th>
                    <th>{L("ফলোআপ")}</th>
                    <th>{L("B2B অর্ডার")}</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {historyDates.map((d) => {
                    const row = historyByDate[d] || {};
                    return (
                      <tr key={d}>
                        <td className="font-medium text-slate-900">{d}</td>
                        <td>{row.POSTS_DONE ?? 0}</td>
                        <td className="font-medium text-slate-900">{formatTaka(row.SALES_AMOUNT || 0)}</td>
                        <td>{formatTaka(row.PROFIT_AMOUNT || 0)}</td>
                        <td>{row.CONFIRMED_ORDERS ?? 0}</td>
                        <td>{row.NEW_LEADS ?? 0}</td>
                        <td>{row.NEW_CLIENTS ?? 0}</td>
                        <td>{formatTaka(row.AD_SPEND || 0)}</td>
                        <td>{row.FOLLOWUPS_DONE ?? 0}</td>
                        <td>{row.B2B_ORDERS ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
