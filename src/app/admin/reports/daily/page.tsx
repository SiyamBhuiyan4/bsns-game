'use client';

import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { formatTaka, getDhakaDateString } from '@/lib/date';

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

export default function AdminDailyReportPage() {
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    getDhakaDateString()
  );
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
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            দৈনিক পারফরম্যান্স রিপোর্ট (Daily Performance Report)
          </h1>
          <p className="text-sm text-slate-500">
            দলের প্রতিটি সদস্যের লক্ষ্যমাত্রা অর্জন, স্কোরিং ও দৈনন্দিন কাজের পর্যবেক্ষণ
          </p>
        </div>

        {/* Date Selector & Export Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold shadow-sm">
            <Calendar className="h-4 w-4 text-emerald-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border-none bg-transparent p-0 font-bold text-slate-800 focus:outline-none"
            />
          </div>

          <a
            href={`/api/reports/daily/export?type=excel&date=${selectedDate}`}
            download
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-sm hover:bg-emerald-100 transition"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            এক্সেল ডাউনলোড
          </a>

          <a
            href={`/api/reports/daily/export?type=pdf&date=${selectedDate}`}
            download
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <Download className="h-4 w-4 text-slate-600" />
            পিডিএফ
          </a>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3.5 text-xs font-semibold text-red-800 border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
              <span className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                মোট বিক্রয়
              </span>
              <span className="text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5 text-[10px]">
                লাভ: {formatTaka(summary.team_profit)}
              </span>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">
              {formatTaka(summary.team_sales)}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              আজকের মোট দলীয় বিক্রয়
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
              <span className="flex items-center gap-1.5">
                <Award className="h-4 w-4 text-teal-600" />
                দলের গড় স্কোর
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  summary.team_avg_score >= 80
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-red-50 text-red-800'
                }`}
              >
                {summary.team_avg_score >= 80 ? 'পাস' : 'ফেল'}
              </span>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">
              {summary.team_avg_score} <span className="text-sm font-bold text-slate-400">/ ১০০</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
              <span className="text-emerald-600 font-semibold">{summary.passing_count} পাস</span>
              <span>•</span>
              <span className="text-red-600 font-semibold">{summary.failing_count} উন্নতি প্রয়োজন</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                গ্রুপ পোস্ট সম্পন্ন
              </span>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">
              {summary.team_posts}{' '}
              <span className="text-sm font-semibold text-slate-500">টি</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              অনুমোদিত ফেসবুক গ্রুপে পোস্ট সংখ্যা
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-purple-600" />
                গ্রাহক ও অর্ডার
              </span>
            </div>
            <div className="mt-2 text-xl font-black text-slate-900">
              {summary.team_new_clients} নতুন / {summary.team_b2b} B2B
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              রিটেনশন: {summary.team_retention} | ফলো-আপ: {summary.team_followups}
            </span>
          </div>
        </div>
      )}

      {/* Employee Breakdown Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/50 p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800">
              মার্কেটারভিত্তিক দৈনিক পারফরম্যান্স ও স্কোরিং তালিকা ({employees.length})
            </h2>
          </div>
          <span className="text-xs text-slate-500">তারিখ: {selectedDate}</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">ডাটা লোড হচ্ছে...</div>
        ) : employees.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">কোনো তথ্য পাওয়া যায়নি।</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-3.5 py-3">মার্কেটার নাম</th>
                  <th className="px-3.5 py-3">সেকশন</th>
                  <th className="px-3.5 py-3 text-center">পোস্ট</th>
                  <th className="px-3.5 py-3 text-right">বিক্রয় (৳)</th>
                  <th className="px-3.5 py-3 text-right">মুনাফা (৳)</th>
                  <th className="px-3.5 py-3 text-center">নতুন ক্রেতা</th>
                  <th className="px-3.5 py-3 text-center">B2B</th>
                  <th className="px-3.5 py-3 text-center">রিটেনশন</th>
                  <th className="px-3.5 py-3 text-center">ফলো-আপ</th>
                  <th className="px-3.5 py-3 text-right">স্কোর (%)</th>
                  <th className="px-3.5 py-3 text-center">স্ট্যাটাস</th>
                  <th className="px-3.5 py-3 text-center">প্রতিফলন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {employees.map((emp) => {
                  const isFail = emp.is_failing;
                  return (
                    <tr
                      key={emp.employee_id}
                      className={`hover:bg-slate-50/70 transition ${
                        isFail ? 'bg-red-50/30' : ''
                      }`}
                    >
                      <td className="px-3.5 py-3 font-bold text-slate-900">
                        {emp.name}
                        <span className="block text-[10px] font-normal text-slate-400">
                          {emp.email}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-slate-600 max-w-[120px] truncate">
                        {emp.sections.length > 0 ? emp.sections.join(', ') : '-'}
                      </td>
                      <td className="px-3.5 py-3 text-center font-semibold text-slate-800">
                        {emp.metrics.POSTS_DONE}
                        {emp.targets.POSTS_DONE && (
                          <span className="text-[10px] text-slate-400 block">
                            /{Math.round(emp.targets.POSTS_DONE)}
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-3 text-right font-bold text-slate-900">
                        {formatTaka(emp.metrics.SALES_AMOUNT)}
                      </td>
                      <td className="px-3.5 py-3 text-right text-emerald-700 font-semibold">
                        {formatTaka(emp.metrics.PROFIT_AMOUNT)}
                      </td>
                      <td className="px-3.5 py-3 text-center text-slate-800">
                        {emp.metrics.NEW_CLIENTS}
                      </td>
                      <td className="px-3.5 py-3 text-center font-bold text-blue-700">
                        {emp.metrics.B2B_ORDERS}
                      </td>
                      <td className="px-3.5 py-3 text-center text-slate-700">
                        {emp.metrics.RETENTION_COUNT}
                      </td>
                      <td className="px-3.5 py-3 text-center text-slate-700">
                        {emp.metrics.FOLLOWUPS_DONE}
                      </td>
                      <td className="px-3.5 py-3 text-right font-black text-slate-900 text-sm">
                        {emp.score}
                      </td>
                      <td className="px-3.5 py-3 text-center">
                        {isFail ? (
                          <span className="inline-block rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800 border border-red-200">
                            উন্নতি প্রয়োজন
                          </span>
                        ) : (
                          <span className="inline-block rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                            পাস (≥৮০%)
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-3 text-center">
                        {emp.daily_text?.main_issue || emp.daily_text?.next_priorities ? (
                          <button
                            onClick={() =>
                              setSelectedReflection({
                                name: emp.name,
                                main_issue: emp.daily_text?.main_issue || null,
                                next_priorities: emp.daily_text?.next_priorities || null,
                              })
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-teal-900 hover:underline"
                          >
                            <MessageSquare className="h-3 w-3" />
                            দেখুন
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-300">-</span>
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

      {/* Reflection Modal */}
      {selectedReflection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  দৈনিক প্রতিক্রিয়া: {selectedReflection.name}
                </h3>
                <span className="text-xs text-slate-500">তারিখ: {selectedDate}</span>
              </div>
              <button
                onClick={() => setSelectedReflection(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <span className="block font-bold text-slate-700 mb-1">
                  আজকের প্রধান সমস্যা / বাধা:
                </span>
                <p className="rounded-lg bg-slate-50 p-3 text-slate-800 border border-slate-200 leading-relaxed">
                  {selectedReflection.main_issue || 'কোনো সমস্যা উল্লেখ করা হয়নি।'}
                </p>
              </div>

              <div>
                <span className="block font-bold text-slate-700 mb-1">
                  কালকের প্রধান ৩টি অগ্রাধিকার:
                </span>
                <p className="rounded-lg bg-slate-50 p-3 text-slate-800 border border-slate-200 leading-relaxed">
                  {selectedReflection.next_priorities || 'কোনো অগ্রাধিকার উল্লেখ করা হয়নি।'}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedReflection(null)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900"
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
