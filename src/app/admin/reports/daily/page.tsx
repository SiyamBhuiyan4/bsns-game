'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  FileSpreadsheet,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Download,
  Users,
  DollarSign,
  Award,
  MessageSquare,
  X,
  BarChart3,
  Loader2,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import { formatTaka, getDhakaDateString, getDhakaOffsetDateString } from '@/lib/date';

interface DailyEmployeeReport {
  employee_id: string;
  name: string;
  email: string;
  sections: string[];
  metrics: {
    POSTS_DONE: number;
    SALES_AMOUNT: number;
    PROFIT_AMOUNT: number;
    NEW_CLIENTS: number;
    B2B_ORDERS: number;
    RETENTION_COUNT: number;
    FOLLOWUPS_DONE: number;
  };
  targets: Record<string, number>;
  score: number;
  is_failing: boolean;
  daily_text: {
    main_issue: string | null;
    next_priorities: string | null;
  } | null;
}

interface DailyReportResponse {
  date: string;
  executive_table?: {
    new_leads: number;
    confirmed_orders: number;
    total_sales: number;
    ad_spend: number;
    followups_done: number;
    b2b_inquiries_count: number;
    b2b_inquiries_value: number;
    main_issues: string[];
    next_priorities: string[];
  };
  summary: {
    total_employees: number;
    team_sales: number;
    team_profit: number;
    team_posts: number;
    team_new_clients: number;
    team_b2b: number;
    team_retention: number;
    team_followups: number;
    team_avg_score: number;
    passing_count: number;
    failing_count: number;
  };
  employees: DailyEmployeeReport[];
}

function AdminDailyReportContent() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get('date');

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('date');
      if (p && /^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
    }
    return getDhakaDateString();
  });

  useEffect(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      setSelectedDate(dateParam);
    }
  }, [dateParam]);
  const [reportData, setReportData] = useState<DailyReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedReflection, setSelectedReflection] = useState<{
    name: string;
    main_issue: string | null;
    next_priorities: string | null;
  } | null>(null);

  const fetchDailyReport = useCallback(async (date: string) => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetch(`/api/reports/daily?date=${date}`);
      if (!res.ok) {
        throw new Error('দৈনিক রিপোর্ট ডাটা লোড করা যায়নি');
      }
      const data = await res.json();
      setReportData(data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'ত্রুটি হয়েছে');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDailyReport(selectedDate);
  }, [selectedDate, fetchDailyReport]);

  const summary = reportData?.summary;
  const employees = reportData?.employees || [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<BarChart3 className="h-5 w-5" />}
        title="দৈনিক রিপোর্ট"
        subtitle="প্রতিটি সদস্যের লক্ষ্য অর্জন ও স্কোর"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setSelectedDate(getDhakaDateString())}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  selectedDate === getDhakaDateString()
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                আজ (Today)
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(getDhakaOffsetDateString(1))}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  selectedDate === getDhakaOffsetDateString(1)
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                গতকাল (Yesterday)
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(getDhakaOffsetDateString(2))}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  selectedDate === getDhakaOffsetDateString(2)
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                পরশু
              </button>
            </div>

            <label className="sr-only" htmlFor="daily-date">তারিখ</label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="daily-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input w-auto pl-9"
              />
            </div>
            <a
              href={`/api/reports/daily/export?type=excel&date=${selectedDate}`}
              download
              className="btn btn-secondary"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </a>
            <a
              href={`/api/reports/daily/export?type=pdf&date=${selectedDate}`}
              download
              className="btn btn-secondary"
            >
              <Download className="h-4 w-4" />
              PDF
            </a>
          </div>
        }
      />

      {errorMsg && (
        <div className="alert alert-error">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="মোট বিক্রয়"
            value={formatTaka(summary.team_sales)}
            note={`লাভ: ${formatTaka(summary.team_profit)}`}
            icon={<DollarSign className="h-4 w-4" />}
            tone="brand"
          />
          <StatCard
            label="কর্মীদের গড় স্কোর"
            value={
              <span className="flex items-baseline gap-2">
                {summary.team_avg_score}
                <span className="text-sm font-medium text-slate-400">/ ১০০</span>
                <span className={`badge ${summary.team_avg_score >= 80 ? 'badge-green' : 'badge-red'}`}>
                  {summary.team_avg_score >= 80 ? 'পাস' : 'ফেল'}
                </span>
              </span>
            }
            note={`${summary.passing_count} পাস · ${summary.failing_count} উন্নতি প্রয়োজন`}
            icon={<Award className="h-4 w-4" />}
            tone="blue"
          />
          <StatCard
            label="গ্রুপ পোস্ট"
            value={summary.team_posts}
            note="অনুমোদিত গ্রুপে পোস্ট"
            icon={<CheckCircle2 className="h-4 w-4" />}
            tone="amber"
          />
          <StatCard
            label="গ্রাহক ও অর্ডার"
            value={`${summary.team_new_clients} নতুন / ${summary.team_b2b} B2B`}
            note={`রিটেনশন: ${summary.team_retention} · ফলো-আপ: ${summary.team_followups}`}
            icon={<Users className="h-4 w-4" />}
            tone="violet"
          />
        </div>
      )}

      {/* Executive Daily Summary Table (দৈনিক রিপোর্টের নমুনা) */}
      <div className="card overflow-hidden">
        <div className="card-header bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="card-title text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-brand-600" />
              দৈনিক রিপোর্ট (সারসংক্ষেপ)
            </h2>
            <p className="card-subtitle text-xs text-slate-500">
              তারিখ: {selectedDate} · মূল ব্যবসায়িক সূচক ও অগ্রাধিকার
            </p>
          </div>
          <span className="badge badge-green text-xs font-semibold">আজকের তথ্য</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-pro">
            <thead>
              <tr className="bg-slate-50">
                <th className="w-1/3 text-slate-700 font-semibold">বিষয়</th>
                <th className="text-slate-700 font-semibold">আজকের তথ্য</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              <tr>
                <td className="font-medium text-slate-800">নতুন লিড</td>
                <td className="font-semibold text-slate-900 tabular-nums">
                  {reportData?.executive_table?.new_leads ?? summary?.team_new_clients ?? 0} টি
                </td>
              </tr>
              <tr>
                <td className="font-medium text-slate-800">নিশ্চিত অর্ডার</td>
                <td className="font-semibold text-brand-700 tabular-nums">
                  {reportData?.executive_table?.confirmed_orders ?? summary?.team_b2b ?? 0} টি
                </td>
              </tr>
              <tr>
                <td className="font-medium text-slate-800">মোট বিক্রি</td>
                <td className="font-bold text-brand-700 tabular-nums">
                  {formatTaka(reportData?.executive_table?.total_sales ?? summary?.team_sales ?? 0)}
                </td>
              </tr>
              <tr>
                <td className="font-medium text-slate-800">বিজ্ঞাপনের খরচ</td>
                <td className="font-semibold text-rose-600 tabular-nums">
                  {formatTaka(reportData?.executive_table?.ad_spend ?? 0)}
                </td>
              </tr>
              <tr>
                <td className="font-medium text-slate-800">ফলোআপ সম্পন্ন</td>
                <td className="font-semibold text-slate-900 tabular-nums">
                  {reportData?.executive_table?.followups_done ?? summary?.team_followups ?? 0} টি
                </td>
              </tr>
              <tr>
                <td className="font-medium text-slate-800">বড় B2B অনুসন্ধান</td>
                <td className="font-semibold text-slate-900 tabular-nums">
                  {reportData?.executive_table?.b2b_inquiries_count ?? summary?.team_b2b ?? 0} টি{' '}
                  <span className="text-xs text-slate-500 font-normal">
                    (সম্ভাব্য মূল্য: {formatTaka(reportData?.executive_table?.b2b_inquiries_value ?? 0)})
                  </span>
                </td>
              </tr>
              <tr>
                <td className="font-medium text-slate-800 align-top">প্রধান সমস্যা</td>
                <td className="text-slate-700 text-xs">
                  {reportData?.executive_table?.main_issues && reportData.executive_table.main_issues.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1">
                      {reportData.executive_table.main_issues.map((issue, idx) => (
                        <li key={idx} className="leading-relaxed">{issue}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-slate-400 italic">কোনো প্রধান সমস্যা উল্লেখিত হয়নি</span>
                  )}
                </td>
              </tr>
              <tr>
                <td className="font-medium text-slate-800 align-top">আগামী দিনের অগ্রাধিকার</td>
                <td className="text-slate-700 text-xs">
                  {reportData?.executive_table?.next_priorities && reportData.executive_table.next_priorities.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1">
                      {reportData.executive_table.next_priorities.map((prio, idx) => (
                        <li key={idx} className="leading-relaxed font-medium text-slate-800">{prio}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-slate-400 italic">কোনো অগ্রাধিকার তালিকাভুক্ত হয়নি</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">সদস্যভিত্তিক পারফরম্যান্স ({employees.length})</h2>
            <p className="card-subtitle">তারিখ: {selectedDate}</p>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">লোড হচ্ছে...</div>
        ) : employees.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="কোনো তথ্য পাওয়া যায়নি"
            description="এই তারিখে কোনো রিপোর্ট নেই।"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-pro">
              <thead>
                <tr>
                  <th>নাম</th>
                  <th>সেকশন</th>
                  <th className="text-center">পোস্ট</th>
                  <th className="text-right">বিক্রয় (৳)</th>
                  <th className="text-right">মুনাফা (৳)</th>
                  <th className="text-center">নতুন ক্রেতা</th>
                  <th className="text-center">B2B</th>
                  <th className="text-center">রিটেনশন</th>
                  <th className="text-center">ফলো-আপ</th>
                  <th className="text-right">স্কোর</th>
                  <th className="text-center">স্ট্যাটাস</th>
                  <th className="text-center">প্রতিফলন</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const isFail = emp.is_failing;
                  return (
                    <tr key={emp.employee_id}>
                      <td className="whitespace-nowrap">
                        <span className="font-medium text-slate-900">{emp.name}</span>
                        <span className="block text-xs text-slate-500">{emp.email}</span>
                      </td>
                      <td className="max-w-[140px] truncate text-slate-600">
                        {emp.sections.length > 0 ? emp.sections.join(', ') : '-'}
                      </td>
                      <td className="text-center tabular-nums">
                        {emp.metrics.POSTS_DONE}
                        {emp.targets.POSTS_DONE && (
                          <span className="text-xs text-slate-400">
                            /{Math.round(emp.targets.POSTS_DONE)}
                          </span>
                        )}
                      </td>
                      <td className="text-right font-medium tabular-nums text-slate-900">
                        {formatTaka(emp.metrics.SALES_AMOUNT)}
                      </td>
                      <td className="text-right tabular-nums">{formatTaka(emp.metrics.PROFIT_AMOUNT)}</td>
                      <td className="text-center tabular-nums">{emp.metrics.NEW_CLIENTS}</td>
                      <td className="text-center tabular-nums">{emp.metrics.B2B_ORDERS}</td>
                      <td className="text-center tabular-nums">{emp.metrics.RETENTION_COUNT}</td>
                      <td className="text-center tabular-nums">{emp.metrics.FOLLOWUPS_DONE}</td>
                      <td className="text-right font-semibold tabular-nums text-slate-900">{emp.score}</td>
                      <td className="text-center">
                        {isFail ? (
                          <span className="badge badge-red">উন্নতি প্রয়োজন</span>
                        ) : (
                          <span className="badge badge-green">পাস</span>
                        )}
                      </td>
                      <td className="text-center">
                        {emp.daily_text?.main_issue || emp.daily_text?.next_priorities ? (
                          <button
                            onClick={() =>
                              setSelectedReflection({
                                name: emp.name,
                                main_issue: emp.daily_text?.main_issue || null,
                                next_priorities: emp.daily_text?.next_priorities || null,
                              })
                            }
                            className="btn btn-ghost btn-sm"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            দেখুন
                          </button>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedReflection && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <div className="card-header">
              <div>
                <h3 className="card-title">দৈনিক প্রতিফলন: {selectedReflection.name}</h3>
                <p className="card-subtitle">তারিখ: {selectedDate}</p>
              </div>
              <button
                onClick={() => setSelectedReflection(null)}
                className="btn-icon"
                aria-label="বন্ধ করুন"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="card-body space-y-4 text-sm">
              <div>
                <span className="label">প্রধান সমস্যা / বাধা</span>
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 leading-relaxed text-slate-800">
                  {selectedReflection.main_issue || 'কোনো সমস্যা উল্লেখ করা হয়নি।'}
                </p>
              </div>
              <div>
                <span className="label">আগামীকালের ৩টি অগ্রাধিকার</span>
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 leading-relaxed text-slate-800">
                  {selectedReflection.next_priorities || 'কোনো অগ্রাধিকার উল্লেখ করা হয়নি।'}
                </p>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 px-5 py-4">
              <button onClick={() => setSelectedReflection(null)} className="btn btn-secondary">
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDailyReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      }
    >
      <AdminDailyReportContent />
    </Suspense>
  );
}
