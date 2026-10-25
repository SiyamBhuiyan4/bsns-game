'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Save,
  Send,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Package,
  Megaphone,
  Share2,
  History,
  Lock,
} from 'lucide-react';
import { formatTaka } from '@/lib/date';
import { WeeklyAutoData } from '@/lib/reports';

interface PastReportItem {
  id: string;
  week_start: string;
  week_end: string;
  status: string;
  creator?: { name: string };
}

interface WeeklyAnswer {
  question_no: number;
  question_text: string;
  answer_text: string;
}

interface WeeklyReportData {
  id: string;
  week_start: string;
  week_end: string;
  status: 'DRAFT' | 'PUBLISHED';
  published_at: string | null;
  auto_data: WeeklyAutoData;
  answers: WeeklyAnswer[];
  creator: { name: string; email: string };
}

export default function AdminWeeklyReportPage() {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [report, setReport] = useState<WeeklyReportData | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [pastReports, setPastReports] = useState<PastReportItem[]>([]);

  const fetchReport = useCallback(async (dateStr: string) => {
    try {
      setLoading(true);
      setErrorMsg('');
      setSuccessMsg('');

      const res = await fetch(`/api/reports/weekly?date=${dateStr}`);
      if (!res.ok) {
        throw new Error('সাপ্তাহিক রিপোর্ট লোড করা যায়নি');
      }

      const data = await res.json();
      setReport(data.report);

      const ansMap: Record<number, string> = {};
      (data.report?.answers || []).forEach((a: WeeklyAnswer) => {
        ansMap[a.question_no] = a.answer_text;
      });
      setAnswers(ansMap);

      // Also fetch history
      const histRes = await fetch('/api/reports/weekly?history=true');
      if (histRes.ok) {
        const histData = await histRes.json();
        setPastReports(histData.reports || []);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'ত্রুটি হয়েছে');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport(selectedDate);
  }, [selectedDate, fetchReport]);

  const handleAnswerChange = (qNo: number, text: string) => {
    setAnswers((prev) => ({ ...prev, [qNo]: text }));
  };

  const handleSave = async (publish: boolean = false) => {
    if (!report) return;

    if (publish) {
      if (!confirm('আপনি কি নিশ্চিত যে এই রিপোর্টটি প্রকাশ (Publish) করবেন? প্রকাশের পর এটি দলীয় আর্কাইভে সংরক্ষিত হবে।')) {
        return;
      }
    }

    try {
      setSaving(true);
      setErrorMsg('');
      setSuccessMsg('');

      const payload = {
        id: report.id,
        week_start: report.week_start.slice(0, 10),
        publish,
        answers: Object.entries(answers).map(([qNo, text]) => ({
          question_no: parseInt(qNo, 10),
          answer_text: text,
        })),
      };

      const res = await fetch('/api/reports/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'সংরক্ষণ ব্যর্থ হয়েছে');
      }

      setSuccessMsg(data.message || 'সফলভাবে সংরক্ষিত হয়েছে!');
      fetchReport(selectedDate);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'ত্রুটি হয়েছে');
    } finally {
      setSaving(false);
    }
  };

  const autoData = report?.auto_data;
  const isPublished = report?.status === 'PUBLISHED';

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              সাপ্তাহিক মূল্যায়ন প্রতিবেদন (Weekly Report)
            </h1>
            {report && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  isPublished
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
              >
                {isPublished ? (
                  <>
                    <Lock className="h-3 w-3" />
                    প্রকাশিত (PUBLISHED)
                  </>
                ) : (
                  'খসড়া (DRAFT)'
                )}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            স্বয়ংক্রিয় অ্যানালিটিক্স, পণ্য ও ক্যাম্পেইন পর্যালোচনা এবং কৌশলগত ৫টি প্রশ্নের উত্তর প্রদান
          </p>
        </div>

        {/* Date Selector & Action Buttons */}
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

          {report && (
            <>
              <a
                href={`/api/reports/weekly/export?type=excel&weekStart=${report.week_start.slice(0, 10)}&id=${report.id}`}
                download
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                এক্সেল
              </a>

              <a
                href={`/api/reports/weekly/export?type=pdf&weekStart=${report.week_start.slice(0, 10)}&id=${report.id}`}
                download
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition"
              >
                <Download className="h-4 w-4 text-slate-600" />
                পিডিএফ
              </a>

              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50 transition"
              >
                <Save className="h-4 w-4 text-blue-600" />
                ড্রাফট সংরক্ষণ
              </button>

              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving || isPublished}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {isPublished ? 'ইতিমধ্যে প্রকাশিত' : 'রিপোর্ট প্রকাশ করুন'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3.5 text-xs font-semibold text-red-800 border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading || !report || !autoData ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          সাপ্তাহিক রিপোর্ট তৈরি ও ডাটা লোড হচ্ছে...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Week Summary Banner */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                সপ্তাহের সময়কাল: {report.week_start.slice(0, 10)} হতে {report.week_end.slice(0, 10)} (রবিবার - শনিবার)
              </span>
              <span className="text-xs font-semibold text-slate-500">
                প্রস্তুতকারক: {report.creator?.name}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-[11px] font-bold text-slate-500 block">মোট বিক্রয়</span>
                <span className="text-base font-black text-slate-900 mt-1 block">
                  {formatTaka(autoData.summary.total_sales)}
                </span>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-[11px] font-bold text-slate-500 block">মোট মুনাফা</span>
                <span className="text-base font-black text-emerald-700 mt-1 block">
                  {formatTaka(autoData.summary.total_profit)}
                </span>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-[11px] font-bold text-slate-500 block">গ্রুপ পোস্ট</span>
                <span className="text-base font-black text-slate-900 mt-1 block">
                  {autoData.summary.total_posts} টি
                </span>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-[11px] font-bold text-slate-500 block">নতুন ক্রেতা</span>
                <span className="text-base font-black text-slate-900 mt-1 block">
                  {autoData.summary.total_new_clients} জন
                </span>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-[11px] font-bold text-slate-500 block">B2B অর্ডার</span>
                <span className="text-base font-black text-blue-700 mt-1 block">
                  {autoData.summary.total_b2b_orders} টি
                </span>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-[11px] font-bold text-slate-500 block">টিম গড় স্কোর</span>
                <span className="text-base font-black text-slate-900 mt-1 block">
                  {autoData.summary.team_avg_score}%
                </span>
              </div>
            </div>
          </div>

          {/* Section A: Automated Marketing Data (Questions 1 - 3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Auto Q1: Top Selling Products */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                <Package className="h-4 w-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900">
                  প্রশ্ন ১: কোন পণ্য সবচেয়ে বেশি বিক্রি হয়েছে?
                </h3>
              </div>

              {autoData.top_products.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">কোনো তথ্য নেই</div>
              ) : (
                <div className="space-y-3">
                  {autoData.top_products.slice(0, 4).map((p, i) => (
                    <div
                      key={p.product_id}
                      className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50"
                    >
                      <div>
                        <span className="font-bold text-slate-800 block">
                          {i + 1}. {p.product_name_bn}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {p.total_quantity} {p.unit}
                        </span>
                      </div>
                      <span className="font-bold text-slate-900">
                        {formatTaka(p.total_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Auto Q2: Campaign Performance */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                <Megaphone className="h-4 w-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900">
                  প্রশ্ন ২: কোন ক্যাম্পেইন ভালো পারফর্ম করেছে?
                </h3>
              </div>

              {autoData.campaign_performance.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">কোনো ক্যাম্পেইন সক্রিয় নেই</div>
              ) : (
                <div className="space-y-3">
                  {autoData.campaign_performance.slice(0, 4).map((c, i) => (
                    <div
                      key={c.campaign_id}
                      className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50"
                    >
                      <div>
                        <span className="font-bold text-slate-800 block">
                          {i + 1}. {c.campaign_name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {c.leads_count} লিড | কনভার্সন: {c.conversion_rate}%
                        </span>
                      </div>
                      <span className="font-bold text-slate-900">
                        {formatTaka(c.orders_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Auto Q3: Channel Breakdown */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                <Share2 className="h-4 w-4 text-purple-600" />
                <h3 className="text-xs font-bold text-slate-900">
                  প্রশ্ন ৩: কোন চ্যানেলে কত বিক্রি হয়েছে?
                </h3>
              </div>

              <div className="space-y-3">
                {autoData.channel_breakdown.map((ch) => (
                  <div
                    key={ch.channel}
                    className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50"
                  >
                    <div>
                      <span className="font-bold text-slate-800 block">{ch.channel_bn}</span>
                      <span className="text-[10px] text-slate-400">
                        লিড: {ch.leads_count} | অর্ডার: {ch.orders_count}
                      </span>
                    </div>
                    <span className="font-bold text-slate-900">
                      {formatTaka(ch.total_amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section B: Fixed 5 Marketing Questions */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-base font-bold text-slate-900">
                কৌশলগত ও মূল্যায়নমূলক প্রশ্নসমূহ (Fixed Marketing Questions)
              </h2>
              <p className="text-xs text-slate-500">
                হেড অব মার্কেটিং সাপ্তাহিক মূল্যায়নে নিচের ৫টি প্রশ্নের উত্তর প্রদান করবেন:
              </p>
            </div>

            <div className="space-y-5">
              {report.answers.map((ans) => (
                <div key={ans.question_no} className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                  <label className="block text-xs font-bold text-slate-900 mb-2">
                    প্রশ্ন {ans.question_no}: {ans.question_text}
                  </label>
                  <textarea
                    rows={3}
                    value={answers[ans.question_no] ?? ans.answer_text}
                    onChange={(e) => handleAnswerChange(ans.question_no, e.target.value)}
                    placeholder="এখানে বিস্তারিত মূল্যায়ন বা দিকনির্দেশনা লিখুন..."
                    className="w-full rounded-lg border border-slate-300 p-3 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none bg-white shadow-sm"
                  />
                </div>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50"
              >
                <Save className="h-4 w-4 text-blue-600" />
                ড্রাফট সংরক্ষণ করুন
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving || isPublished}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {isPublished ? 'ইতিমধ্যে প্রকাশিত' : 'রিপোর্ট প্রকাশ করুন'}
              </button>
            </div>
          </div>

          {/* Past Reports History */}
          {pastReports.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/50 p-4">
                <History className="h-4 w-4 text-slate-600" />
                <h3 className="text-xs font-bold text-slate-800">
                  বিগত সপ্তাহের রিপোর্ট হিস্ট্রি (Archive)
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {pastReports.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3.5 hover:bg-slate-50 text-xs transition"
                  >
                    <div>
                      <span className="font-bold text-slate-800">
                        সপ্তাহ: {r.week_start.slice(0, 10)} হতে {r.week_end.slice(0, 10)}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        প্রস্তুতকারক: {r.creator?.name} | স্ট্যাটাস: {r.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedDate(r.week_start.slice(0, 10))}
                        className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        লোড করুন
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
