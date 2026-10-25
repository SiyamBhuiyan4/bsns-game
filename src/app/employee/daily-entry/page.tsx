'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
  const [selectedDate, setSelectedDate] = useState(() => getDhakaDateString());
  const [products, setProducts] = useState<Product[]>([]);
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
    try {
      setLoading(true);
      setErrorMsg('');
      setSuccessMsg('');
      setIsAdminForbidden(false);

      // Fetch products if not loaded
      let prods = products;
      if (prods.length === 0) {
        const prodRes = await fetch('/api/products');
        if (prodRes.ok) {
          const pData = await prodRes.json();
          prods = pData.products || [];
          setProducts(prods);
        }
      }

      const res = await fetch(`/api/employee/daily-entry?date=${dateStr}`);
      if (res.status === 403) {
        const errJson = await res.json();
        if (errJson.is_admin_forbidden) {
          setIsAdminForbidden(true);
          setCanEdit(false);
          return;
        }
      }

      if (!res.ok) {
        throw new Error('তথ্য লোড করতে সমস্যা হয়েছে');
      }

      const data = await res.json();
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
      setErrorMsg(err instanceof Error ? err.message : 'ত্রুটি হয়েছে');
    } finally {
      setLoading(false);
    }
  }, [products]);

  useEffect(() => {
    loadDayData(selectedDate);
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
      const confirmText = `${activeWarnings.join('\n')}\n\nআপনি কি নিশ্চিত যে এই তথ্য সংরক্ষণ করবেন?`;
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
        throw new Error(data.error || 'তথ্য সংরক্ষণ করা যায়নি');
      }

      setSuccessMsg(data.message || SAVE_SUCCESS_MESSAGE);
      loadDayData(selectedDate);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'ত্রুটি হয়েছে');
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
            className="text-[11px] font-medium text-teal-600 hover:text-teal-800 transition flex items-center gap-1"
          >
            + নোট যোগ করুন
          </button>
        )}
        {isOpen && (
          <div className="space-y-1 mt-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-500">নোট (Note):</span>
              <span className="text-[10px] text-slate-400">{noteVal.length}/300</span>
            </div>
            <input
              type="text"
              maxLength={300}
              disabled={!canEdit}
              value={noteVal}
              onChange={(e) => setNote(metricKey, e.target.value)}
              placeholder="এই মেট্রিকের বিস্তারিত নোট লিখুন..."
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs text-slate-800 focus:border-teal-500 focus:outline-none disabled:bg-slate-100"
            />
          </div>
        )}
      </div>
    );
  };

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
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
        <ShieldAlert className="h-12 w-12 mx-auto text-red-600 mb-3" />
        <h2 className="text-lg font-bold text-red-900">অ্যাডমিন প্রবেশাধিকার নিষিদ্ধ</h2>
        <p className="text-sm text-red-700 mt-1 max-w-md mx-auto">
          অ্যাডমিন কর্মচারী দৈনিক এন্ট্রি ফর্ম খুলতে বা জমা দিতে পারবেন না (Admin cannot open or submit employee daily entry form)।
        </p>
        <div className="mt-4">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 shadow"
          >
            অ্যাডমিন ড্যাশবোর্ডে ফিরুন
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Date Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            দৈনিক পারফরম্যান্স এন্ট্রি (Daily Entry Form)
          </h1>
          <p className="text-sm text-slate-500">
            আপনার আজকের বিক্রয়, লিড, বিজ্ঞাপন, B2B এবং কাজের প্রতিক্রিয়া লিপিবদ্ধ করুন
          </p>
        </div>

        {/* Date Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold shadow-sm">
            <Calendar className="h-4 w-4 text-teal-600" />
            <input
              type="date"
              max={todayDhaka || getDhakaDateString()}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border-none bg-transparent p-0 font-bold text-slate-800 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedDate(todayDhaka || getDhakaDateString());
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            আজ (Today)
          </button>

          {oldestAllowed && (
            <button
              type="button"
              onClick={() => setSelectedDate(oldestAllowed)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              গতকাল (Yesterday)
            </button>
          )}
        </div>
      </div>

      {/* Lock Notice or Window Info Banner */}
      {isLocked ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs font-medium text-amber-900 shadow-sm">
          <Lock className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-amber-950 text-sm">
              {LOCK_NOTICE}
            </div>
            <p className="text-amber-800">
              নিয়ম অনুযায়ী শুধুমাত্র আজ এবং গতকালের তথ্য সম্পাদন করা যায়। এই তারিখে সংরক্ষিত তথ্য নিচে শুধু দর্শনযোগ্য হিসেবে দেখানো হচ্ছে (Read-only View)।
            </p>
            {oldestAllowed && todayDhaka && (
              <p className="text-[11px] font-semibold text-amber-900 bg-amber-100/70 inline-block px-2 py-0.5 rounded border border-amber-200">
                অনুমোদিত সম্পাদন সময়সীমা (Asia/Dhaka): {oldestAllowed} থেকে {todayDhaka} পর্যন্ত
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg bg-teal-50 px-4 py-2.5 text-xs font-semibold text-teal-900 border border-teal-200 shadow-sm">
          <div className="flex items-center gap-2">
            <Unlock className="h-4 w-4 text-teal-600 shrink-0" />
            <span>সম্পাদন উইন্ডো সক্রিয় (Asia/Dhaka): আপনি আজ ও গতকালের এন্ট্রি যুক্ত বা পরিবর্তন করতে পারবেন।</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-normal text-teal-700">
            <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
            <span>টাস্ক কিউ পোস্ট সম্পন্ন: <strong className="font-bold">{postsDone}</strong> টি</span>
          </div>
        </div>
      )}

      {/* Alert Messages */}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3.5 text-xs font-semibold text-red-800 border border-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          ডাটা লোড হচ্ছে...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SECTION 0: কন্টেন্ট ও গ্রুপ পোস্টিং (Posts Done) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 mb-4 gap-2">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-teal-50 p-2 text-teal-700">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    কন্টেন্ট ও গ্রুপ পোস্টিং (Group Posts Completed)
                  </h2>
                  <p className="text-xs text-slate-500">
                    আজকের সম্পন্ন করা ফেসবুক গ্রুপ পোস্ট সংখ্যা ও নোট
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 self-start sm:self-auto rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800 border border-teal-200">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
                টাস্ক কিউ থেকে স্বয়ংক্রিয় গণনা: {postsDone} টি
              </span>
            </div>

            <div className="max-w-md">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                গ্রুপ পোস্ট সম্পন্ন (সংখ্যা) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">#</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  disabled={!canEdit}
                  value={postsInput}
                  onChange={(e) => setPostsInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-xs font-bold text-slate-900 focus:border-teal-500 focus:outline-none disabled:bg-slate-100"
                  placeholder="0"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                * টাস্ক কিউতে সম্পন্ন করা পোস্ট সংখ্যা স্বয়ংক্রিয়ভাবে বসেছে। প্রয়োজনে সমন্বয় বা নোট যুক্ত করতে পারেন।
              </p>
              {renderNoteInput('POSTS_DONE')}
            </div>
          </div>

          {/* SECTION 1: বিক্রি (Sales, Profit, Confirmed Orders) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    ১. বিক্রি (Sales & Profit)
                  </h2>
                  <p className="text-xs text-slate-500">
                    মোট বিক্রি, লাভের পরিমাণ এবং নিশ্চিত অর্ডারের সংখ্যা লিখুন
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* মোট বিক্রি */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  মোট বিক্রি (৳) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">৳</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    disabled={!canEdit}
                    value={salesAmount}
                    onChange={(e) => setSalesAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-xs font-bold text-slate-900 focus:border-teal-500 focus:outline-none disabled:bg-slate-100"
                    placeholder="0.00"
                    required
                  />
                </div>
                {renderNoteInput('SALES_AMOUNT')}
              </div>

              {/* লাভ */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  লাভ (৳) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">৳</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    disabled={!canEdit}
                    value={profitAmount}
                    onChange={(e) => setProfitAmount(e.target.value)}
                    className={`w-full rounded-lg border pl-8 pr-3 py-2 text-xs font-bold text-slate-900 focus:outline-none disabled:bg-slate-100 ${
                      isProfitHigherThanSales ? 'border-amber-500 bg-amber-50/40' : 'border-slate-300 focus:border-teal-500'
                    }`}
                    placeholder="0.00"
                    required
                  />
                </div>
                {renderNoteInput('PROFIT_AMOUNT')}
              </div>

              {/* নিশ্চিত অর্ডার */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  নিশ্চিত অর্ডার (সংখ্যা) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">#</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    disabled={!canEdit}
                    value={confirmedOrders}
                    onChange={(e) => setConfirmedOrders(e.target.value)}
                    className={`w-full rounded-lg border pl-8 pr-3 py-2 text-xs font-bold text-slate-900 focus:outline-none disabled:bg-slate-100 ${
                      isConfirmedOrdersHigherThanNewLeads ? 'border-amber-500 bg-amber-50/40' : 'border-slate-300 focus:border-teal-500'
                    }`}
                    placeholder="0"
                    required
                  />
                </div>
                {renderNoteInput('CONFIRMED_ORDERS')}
              </div>
            </div>

            {/* Warning Banner 1: Profit > Sales */}
            {isProfitHigherThanSales && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 p-2.5 text-xs font-semibold text-amber-900 border border-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>{WARNING_MESSAGES.PROFIT_EXCEEDS_SALES}</span>
              </div>
            )}
          </div>

          {/* SECTION 2: পণ্যভিত্তিক বিক্রি (Product-wise Sales) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    ২. পণ্যভিত্তিক বিক্রি (Product Breakdown)
                  </h2>
                  <p className="text-xs text-slate-500">
                    প্রতিটি পণ্যের পরিমাণ এবং মোট বিক্রির টাকার পরিমাণ লিখুন
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-xs font-medium text-slate-500">পণ্য বিক্রির মোট:</span>
                  <span className="text-sm font-bold text-slate-900 ml-1.5">
                    {formatTaka(totalProductSalesAmount)}
                  </span>
                </div>
                {canEdit && totalProductSalesAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => setSalesAmount(String(totalProductSalesAmount))}
                    className="rounded-lg border border-teal-300 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700 hover:bg-teal-100 transition shadow-xs"
                    title="পণ্য বিক্রির মোট টাকাকে উপরে 'মোট বিক্রি' ঘরে বসান"
                  >
                    মোট বিক্রিতে কপি করুন
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 font-bold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2.5">পণ্যের নাম</th>
                    <th className="px-3 py-2.5">একক (Unit)</th>
                    <th className="px-3 py-2.5">নির্ধারিত বিক্রয়মূল্য (৳ Selling Price)</th>
                    <th className="px-3 py-2.5">পরিমাণ (Quantity)</th>
                    <th className="px-3 py-2.5">মোট মূল্য (৳ Amount)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {productSales.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                        কোন সক্রিয় পণ্য পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    productSales.map((ps, idx) => (
                      <tr key={ps.product_id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-bold text-slate-800">
                          {ps.product_name_bn}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500">{ps.unit}</td>
                        <td className="px-3 py-2.5 font-semibold text-slate-700">
                          {formatTaka(ps.selling_price)}
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            disabled={!canEdit}
                            value={ps.quantity || ''}
                            onChange={(e) =>
                              handleProductChange(idx, 'quantity', parseFloat(e.target.value) || 0)
                            }
                            className="w-24 rounded border border-slate-300 p-1 font-bold text-slate-800 focus:border-teal-500 focus:outline-none disabled:bg-slate-100"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              disabled={!canEdit}
                              value={ps.amount || ''}
                              onChange={(e) =>
                                handleProductChange(idx, 'amount', parseFloat(e.target.value) || 0)
                              }
                              className="w-32 rounded border border-slate-300 p-1 font-bold text-slate-800 focus:border-teal-500 focus:outline-none disabled:bg-slate-100"
                              placeholder="0.00"
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600 border border-slate-200 flex items-center justify-between">
              <span>* <strong>স্বয়ংক্রিয় হিসাব:</strong> পরিমাণ (Quantity) লিখলে নির্ধারিত বিক্রয়মূল্য (Selling Price) দিয়ে গুণ হয়ে মোট মূল্য স্বয়ংক্রিয়ভাবে হিসাব হবে। প্রয়োজনে সমন্বয় করতে পারবেন।</span>
            </div>
          </div>

          {/* SECTION 3: লিড ও ক্রেতা (Leads & Clients) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <div className="rounded-lg bg-teal-50 p-2 text-teal-700">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  ৩. লিড ও ক্রেতা (Leads & Clients)
                </h2>
                <p className="text-xs text-slate-500">
                  নতুন লিড, নতুন ক্রেতা এবং পুরোনো ক্রেতা ধরে রাখার সংখ্যা লিখুন
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* নতুন লিড */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  নতুন লিড (সংখ্যা)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  disabled={!canEdit}
                  value={newLeads}
                  onChange={(e) => setNewLeads(e.target.value)}
                  className={`w-full rounded-lg border p-2 text-xs font-bold text-slate-800 focus:outline-none disabled:bg-slate-100 ${
                    isConfirmedOrdersHigherThanNewLeads ? 'border-amber-500 bg-amber-50/40' : 'border-slate-300 focus:border-teal-500'
                  }`}
                  placeholder="0"
                />
                {renderNoteInput('NEW_LEADS')}
              </div>

              {/* নতুন ক্রেতা */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  নতুন ক্রেতা (সংখ্যা)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  disabled={!canEdit}
                  value={newClients}
                  onChange={(e) => setNewClients(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs font-bold text-slate-800 focus:border-teal-500 focus:outline-none disabled:bg-slate-100"
                  placeholder="0"
                />
                {renderNoteInput('NEW_CLIENTS')}
              </div>

              {/* পুরোনো ক্রেতা ধরে রাখা */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  পুরোনো ক্রেতা ধরে রাখা (সংখ্যা)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  disabled={!canEdit}
                  value={retentionCount}
                  onChange={(e) => setRetentionCount(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs font-bold text-slate-800 focus:border-teal-500 focus:outline-none disabled:bg-slate-100"
                  placeholder="0"
                />
                {renderNoteInput('RETENTION_COUNT')}
              </div>
            </div>

            {/* Warning Banner 2: Confirmed Orders > New Leads */}
            {isConfirmedOrdersHigherThanNewLeads && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 p-2.5 text-xs font-semibold text-amber-900 border border-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>{WARNING_MESSAGES.ORDERS_EXCEED_LEADS}</span>
              </div>
            )}
          </div>

          {/* SECTION 4: বিজ্ঞাপন (Advertising) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <div className="rounded-lg bg-orange-50 p-2 text-orange-700">
                <Megaphone className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  ৪. বিজ্ঞাপন (Advertising)
                </h2>
                <p className="text-xs text-slate-500">
                  আজকের বিজ্ঞাপনের খরচ (৳) লিপিবদ্ধ করুন
                </p>
              </div>
            </div>

            <div className="max-w-md">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                বিজ্ঞাপনের খরচ (৳)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">৳</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  disabled={!canEdit}
                  value={adSpend}
                  onChange={(e) => setAdSpend(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-xs font-bold text-slate-900 focus:border-teal-500 focus:outline-none disabled:bg-slate-100"
                  placeholder="0.00"
                />
              </div>
              {renderNoteInput('AD_SPEND')}
            </div>
          </div>

          {/* SECTION 5: ফলোআপ (Follow-ups) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <div className="rounded-lg bg-purple-50 p-2 text-purple-700">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  ৫. ফলোআপ (Follow-ups)
                </h2>
                <p className="text-xs text-slate-500">
                  আজকে সম্পন্ন করা মেসেজ ও কল ফলোআপের মোট সংখ্যা
                </p>
              </div>
            </div>

            <div className="max-w-md">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ফলোআপ সম্পন্ন (সংখ্যা)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                disabled={!canEdit}
                value={followupsDone}
                onChange={(e) => setFollowupsDone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs font-bold text-slate-800 focus:border-teal-500 focus:outline-none disabled:bg-slate-100"
                placeholder="0"
              />
              {renderNoteInput('FOLLOWUPS_DONE')}
            </div>
          </div>

          {/* SECTION 6: B2B (B2B Orders, Inquiries, Potential Value) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <div className="rounded-lg bg-indigo-50 p-2 text-indigo-700">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  ৬. B2B (পাইকার / কর্পোরেট / রেস্তোরাঁ)
                </h2>
                <p className="text-xs text-slate-500">
                  B2B অর্ডার সংখ্যা, বড় B2B অনুসন্ধান এবং অনুসন্ধানের সম্ভাব্য মোট মূল্য লিখুন
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* B2B অর্ডার */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  B2B অর্ডার (সংখ্যা)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  disabled={!canEdit}
                  value={b2bOrders}
                  onChange={(e) => setB2bOrders(e.target.value)}
                  className={`w-full rounded-lg border p-2 text-xs font-bold text-slate-800 focus:outline-none disabled:bg-slate-100 ${
                    isB2bOrdersHigherThanInquiries ? 'border-amber-500 bg-amber-50/40' : 'border-slate-300 focus:border-teal-500'
                  }`}
                  placeholder="0"
                />
                {renderNoteInput('B2B_ORDERS')}
              </div>

              {/* বড় B2B অনুসন্ধান */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  বড় B2B অনুসন্ধান (সংখ্যা)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  disabled={!canEdit}
                  value={b2bInquiries}
                  onChange={(e) => setB2bInquiries(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs font-bold text-slate-800 focus:border-teal-500 focus:outline-none disabled:bg-slate-100"
                  placeholder="0"
                />
                {renderNoteInput('B2B_INQUIRIES')}
              </div>

              {/* সম্ভাব্য মূল্য */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  সম্ভাব্য মূল্য (৳)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">৳</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    disabled={!canEdit}
                    value={b2bInquiryValue}
                    onChange={(e) => setB2bInquiryValue(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-xs font-bold text-slate-900 focus:border-teal-500 focus:outline-none disabled:bg-slate-100"
                    placeholder="0.00"
                  />
                </div>
                {renderNoteInput('B2B_INQUIRY_VALUE')}
              </div>
            </div>

            {/* Warning Banner 3: B2B Orders > B2B Inquiries */}
            {isB2bOrdersHigherThanInquiries && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 p-2.5 text-xs font-semibold text-amber-900 border border-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>{WARNING_MESSAGES.B2B_ORDERS_EXCEED_INQUIRIES}</span>
              </div>
            )}
          </div>

          {/* SECTION 7: টেক্সট (Reflection: Issues & Next Priorities) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <div className="rounded-lg bg-violet-50 p-2 text-violet-700">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  ৭. টেক্সট প্রতিক্রিয়া (Daily Reflection)
                </h2>
                <p className="text-xs text-slate-500">
                  আজকের প্রধান সমস্যা এবং আগামী দিনের অগ্রাধিকারমূলক কাজগুলো লিখুন
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  প্রধান সমস্যা (সর্বোচ্চ ৫০০ অক্ষর)
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  disabled={!canEdit}
                  value={mainIssue}
                  onChange={(e) => setMainIssue(e.target.value)}
                  placeholder="আজকের কাজে কি কি সমস্যা বা বাধার মুখোমুখি হয়েছেন..."
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 focus:border-teal-500 focus:outline-none disabled:bg-slate-100"
                />
                <span className="text-[10px] text-slate-400 block text-right">
                  {mainIssue.length}/500 অক্ষর
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  আগামী দিনের অগ্রাধিকার (সর্বোচ্চ ৫০০ অক্ষর)
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  disabled={!canEdit}
                  value={nextPriorities}
                  onChange={(e) => setNextPriorities(e.target.value)}
                  placeholder="আগামীকাল কোন কোন কাজগুলো অগ্রাধিকার ভিত্তিতে করবেন..."
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 focus:border-teal-500 focus:outline-none disabled:bg-slate-100"
                />
                <span className="text-[10px] text-slate-400 block text-right">
                  {nextPriorities.length}/500 অক্ষর
                </span>
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          {canEdit && (
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-7 py-2.5 text-xs font-bold text-white shadow-md hover:bg-teal-700 transition disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'সংরক্ষণ করা হচ্ছে...' : 'দৈনিক তথ্য সংরক্ষণ করুন'}
              </button>
            </div>
          )}
        </form>
      )}

      {/* Below Form: Actions & 7-Day History Table */}
      <div className="pt-4 border-t border-slate-200 space-y-6">
        {/* Link Button to Daily Report */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-r from-teal-50 via-slate-50 to-emerald-50 p-4 rounded-xl border border-teal-200/70 shadow-sm">
          <div>
            <h4 className="text-xs font-bold text-slate-900">
              দৈনিক পারফরম্যান্স রিপোর্ট পর্যবেক্ষণ
            </h4>
            <p className="text-[11px] text-slate-600 mt-0.5">
              আজকের অর্জিত পয়েন্ট, স্কোরিং ও লক্ষ্যমাত্রার হিসাব বিস্তারিত দেখতে নিচের বাটনে ক্লিক করুন
            </p>
          </div>
          <Link
            href="/employee/performance?period=daily"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 transition shadow-sm shrink-0"
          >
            <span>আজকের daily report দেখুন</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* 7-Day History Table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-teal-600" />
              <h3 className="text-xs font-bold text-slate-800">
                বিগত ৭ দিনের সারসংক্ষেপ (Last 7 Days Summary)
              </h3>
            </div>
            <span className="text-[11px] font-medium text-slate-500">
              মোট রেকর্ডকৃত দিন: {historyDates.length}
            </span>
          </div>

          {historyDates.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              বিগত ৭ দিনের কোনো রেকর্ড সংরক্ষিত নেই।
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3">তারিখ</th>
                    <th className="px-3 py-3">পোস্ট</th>
                    <th className="px-3 py-3">মোট বিক্রি (৳)</th>
                    <th className="px-3 py-3">লাভ (৳)</th>
                    <th className="px-3 py-3">অর্ডার</th>
                    <th className="px-3 py-3">লিড</th>
                    <th className="px-3 py-3">নতুন ক্রেতা</th>
                    <th className="px-3 py-3">বিজ্ঞাপন (৳)</th>
                    <th className="px-3 py-3">ফলোআপ</th>
                    <th className="px-3 py-3">B2B অর্ডার</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {historyDates.map((d) => {
                    const row = historyByDate[d] || {};
                    return (
                      <tr key={d} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-2.5 font-bold text-slate-900">{d}</td>
                        <td className="px-3 py-2.5 font-bold text-teal-800">
                          {row.POSTS_DONE ?? 0}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-emerald-700">
                          {formatTaka(row.SALES_AMOUNT || 0)}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-slate-700">
                          {formatTaka(row.PROFIT_AMOUNT || 0)}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-slate-900">
                          {row.CONFIRMED_ORDERS ?? 0}
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">{row.NEW_LEADS ?? 0}</td>
                        <td className="px-3 py-2.5 text-slate-700">{row.NEW_CLIENTS ?? 0}</td>
                        <td className="px-3 py-2.5 text-slate-700">
                          {formatTaka(row.AD_SPEND || 0)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">{row.FOLLOWUPS_DONE ?? 0}</td>
                        <td className="px-3 py-2.5 font-semibold text-blue-700">
                          {row.B2B_ORDERS ?? 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
