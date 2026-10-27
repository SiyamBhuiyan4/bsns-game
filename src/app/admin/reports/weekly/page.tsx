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
  CalendarRange,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { formatTaka } from '@/lib/date';
import { WeeklyAutoData } from '@/lib/reports';
import { useLanguage } from '@/components/LanguageContext';
import { Skeleton, SkeletonStatCards } from '@/components/ui/Skeleton';

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
  const { L } = useLanguage();
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
        throw new Error(L('সাপ্তাহিক রিপোর্ট লোড করা যায়নি'));
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
      setErrorMsg(err instanceof Error ? err.message : L('ত্রুটি হয়েছে'));
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
      if (!confirm(L('আপনি কি নিশ্চিত যে এই রিপোর্টটি প্রকাশ (Publish) করবেন? প্রকাশের পর এটি দলীয় আর্কাইভে সংরক্ষিত হবে।'))) {
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
        throw new Error(data.error || L('সংরক্ষণ ব্যর্থ হয়েছে'));
      }

      setSuccessMsg(data.message || L('সফলভাবে সংরক্ষিত হয়েছে!'));
      fetchReport(selectedDate);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : L('ত্রুটি হয়েছে'));
    } finally {
      setSaving(false);
    }
  };

  const autoData = report?.auto_data;
  const isPublished = report?.status === 'PUBLISHED';

  const publishNote = isPublished
    ? L('প্রকাশিত রিপোর্ট আর খসড়ায় ফেরানো যায় না।')
    : L('প্রকাশ চূড়ান্ত: এরপর আর খসড়ায় ফেরানো যাবে না, রিপোর্টটি আর্কাইভে যাবে।');

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<CalendarRange className="h-5 w-5" />}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {L("সাপ্তাহিক রিপোর্ট")}
            {report && (
              <span className={`badge ${isPublished ? 'badge-green' : 'badge-amber'}`}>
                {isPublished ? (
                  <>
                    <Lock className="h-3 w-3" />
                    {L("প্রকাশিত")}
                  </>
                ) : (
                  L('খসড়া')
                )}
              </span>
            )}
          </span>
        }
        subtitle={L("স্বয়ংক্রিয় বিশ্লেষণ ও ৫টি কৌশলগত প্রশ্ন")}
        actions={
          <>
            <label className="sr-only" htmlFor="weekly-date">{L("তারিখ")}</label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="weekly-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input w-auto pl-9"
              />
            </div>
            {report && (
              <>
                <a
                  href={`/api/reports/weekly/export?type=excel&weekStart=${report.week_start.slice(0, 10)}&id=${report.id}`}
                  download
                  className="btn btn-secondary"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </a>
                <a
                  href={`/api/reports/weekly/export?type=pdf&weekStart=${report.week_start.slice(0, 10)}&id=${report.id}`}
                  download
                  className="btn btn-secondary"
                >
                  <Download className="h-4 w-4" />
                  PDF
                </a>
              </>
            )}
          </>
        }
      />

      {errorMsg && (
        <div className="alert alert-error">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading || !report || !autoData ? (
        <div className="space-y-6" role="status" aria-busy="true">
          <span className="sr-only">{L("লোড হচ্ছে...")}</span>
          <SkeletonStatCards count={4} />
          <div className="card p-5">
            <Skeleton className="mb-4 h-4 w-40" />
            <Skeleton className="h-56 w-full" />
          </div>
          <div className="card p-5 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">{L("সপ্তাহের সারাংশ")}</h2>
                <p className="card-subtitle">
                  {report.week_start.slice(0, 10)} – {report.week_end.slice(0, 10)} {L("(রবি–শনি)")}
                </p>
              </div>
              <span className="text-xs text-slate-500">{L("প্রস্তুতকারক:")} {report.creator?.name}</span>
            </div>
            <div className="card-body grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              {[
                { label: L('মোট বিক্রয়'), value: formatTaka(autoData.summary.total_sales) },
                { label: L('মোট মুনাফা'), value: formatTaka(autoData.summary.total_profit) },
                { label: L('গ্রুপ পোস্ট'), value: `${autoData.summary.total_posts} টি` },
                { label: L('নতুন ক্রেতা'), value: `${autoData.summary.total_new_clients} জন` },
                { label: L('B2B অর্ডার'), value: `${autoData.summary.total_b2b_orders} টি` },
                { label: L('গড় স্কোর'), value: `${autoData.summary.team_avg_score}%` },
              ].map((m) => (
                <div key={m.label} className="min-w-0">
                  <span className="block text-xs text-slate-500">{m.label}</span>
                  <span className="mt-1 block truncate text-lg font-semibold tabular-nums text-slate-900">
                    {m.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="card">
              <div className="card-header">
                <h3 className="card-title flex items-center gap-2">
                  <Package className="h-4 w-4 text-slate-400" />
                  {L("শীর্ষ বিক্রিত পণ্য")}
                </h3>
              </div>
              {autoData.top_products.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">{L("কোনো তথ্য নেই")}</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {autoData.top_products.slice(0, 4).map((p, i) => (
                    <li key={p.product_id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <div className="min-w-0">
                        <span className="block truncate font-medium text-slate-800">
                          {i + 1}. {p.product_name_bn}
                        </span>
                        <span className="text-xs text-slate-500">
                          {p.total_quantity} {p.unit}
                        </span>
                      </div>
                      <span className="shrink-0 font-medium tabular-nums text-slate-900">
                        {formatTaka(p.total_amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-slate-400" />
                  {L("ক্যাম্পেইন পারফরম্যান্স")}
                </h3>
              </div>
              {autoData.campaign_performance.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">{L("কোনো ক্যাম্পেইন সক্রিয় নেই")}</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {autoData.campaign_performance.slice(0, 4).map((c, i) => (
                    <li key={c.campaign_id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <div className="min-w-0">
                        <span className="block truncate font-medium text-slate-800">
                          {i + 1}. {c.campaign_name}
                        </span>
                        <span className="text-xs text-slate-500">
                          {c.leads_count} {L("লিড · কনভার্সন")} {c.conversion_rate}%
                        </span>
                      </div>
                      <span className="shrink-0 font-medium tabular-nums text-slate-900">
                        {formatTaka(c.orders_amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-slate-400" />
                  {L("চ্যানেলভিত্তিক বিক্রয়")}
                </h3>
              </div>
              <ul className="divide-y divide-slate-100">
                {autoData.channel_breakdown.map((ch) => (
                  <li key={ch.channel} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <span className="block truncate font-medium text-slate-800">{ch.channel_bn}</span>
                      <span className="text-xs text-slate-500">
                        {L("লিড")} {ch.leads_count} {L("· অর্ডার")} {ch.orders_count}
                      </span>
                    </div>
                    <span className="shrink-0 font-medium tabular-nums text-slate-900">
                      {formatTaka(ch.total_amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">{L("কৌশলগত প্রশ্নসমূহ")}</h2>
                <p className="card-subtitle">{L("হেড অব মার্কেটিং নিচের ৫টি প্রশ্নের উত্তর দেবেন")}</p>
              </div>
            </div>
            <div className="card-body space-y-5">
              {report.answers.map((ans) => (
                <div key={ans.question_no}>
                  <label className="label" htmlFor={`weekly-q-${ans.question_no}`}>
                    {ans.question_no}. {ans.question_text}
                  </label>
                  <textarea
                    id={`weekly-q-${ans.question_no}`}
                    rows={3}
                    value={answers[ans.question_no] ?? ans.answer_text}
                    onChange={(e) => handleAnswerChange(ans.question_no, e.target.value)}
                    placeholder={L("মূল্যায়ন বা দিকনির্দেশনা লিখুন...")}
                    className="input"
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className={`flex items-start gap-2 text-xs ${isPublished ? 'text-slate-500' : 'text-amber-800'}`}>
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {publishNote}
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="btn btn-secondary"
                >
                  <Save className="h-4 w-4" />
                  {isPublished ? L('সংরক্ষণ') : L('খসড়া সংরক্ষণ')}
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={saving || isPublished}
                  className="btn btn-primary"
                >
                  <Send className="h-4 w-4" />
                  {isPublished ? L('প্রকাশিত') : L('প্রকাশ করুন')}
                </button>
              </div>
            </div>
          </div>

          {pastReports.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title flex items-center gap-2">
                  <History className="h-4 w-4 text-slate-400" />
                  {L("আগের রিপোর্ট")}
                </h3>
              </div>
              <ul className="divide-y divide-slate-100">
                {pastReports.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <span className="block font-medium text-slate-800">
                        {r.week_start.slice(0, 10)} – {r.week_end.slice(0, 10)}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {r.creator?.name}
                        <span className={`badge ${r.status === 'PUBLISHED' ? 'badge-green' : 'badge-amber'}`}>
                          {r.status === 'PUBLISHED' ? L('প্রকাশিত') : L('খসড়া')}
                        </span>
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedDate(r.week_start.slice(0, 10))}
                      className="btn btn-secondary btn-sm"
                    >
                      {L("খুলুন")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
