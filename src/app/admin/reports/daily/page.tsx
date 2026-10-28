'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Calendar,
  AlertCircle,
  CheckCircle2,
  Users,
  DollarSign,
  Award,
  MessageSquare,
  X,
  BarChart3,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import { formatTaka, getDhakaDateString, getDhakaOffsetDateString } from '@/lib/date';
import { useLanguage } from '@/components/LanguageContext';
import { SkeletonStatCards, SkeletonTable } from '@/components/ui/Skeleton';
import { ReportExportButtons, ReportPageSkeleton } from '@/components/admin/ReportKit';

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
  const { L } = useLanguage();
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
        throw new Error(L('দৈনিক রিপোর্ট ডাটা লোড করা যায়নি'));
      }
      const data = await res.json();
      setReportData(data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : L('ত্রুটি হয়েছে'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDailyReport(selectedDate);
  }, [selectedDate, fetchDailyReport]);

  const summary = reportData?.summary;
  const employees = reportData?.employees || [];

  const isToday = selectedDate === getDhakaDateString();
  const execRows: { label: string; value: React.ReactNode; tone?: string; note?: React.ReactNode }[] = [
    {
      label: L("নতুন লিড"),
      value: <>{reportData?.executive_table?.new_leads ?? summary?.team_new_clients ?? 0} {L("টি")}</>,
    },
    {
      label: L("নিশ্চিত অর্ডার"),
      value: <>{reportData?.executive_table?.confirmed_orders ?? summary?.team_b2b ?? 0} {L("টি")}</>,
    },
    {
      label: L("মোট বিক্রি"),
      value: formatTaka(reportData?.executive_table?.total_sales ?? summary?.team_sales ?? 0),
      tone: 'text-brand-700',
    },
    {
      label: L("বিজ্ঞাপনের খরচ"),
      value: formatTaka(reportData?.executive_table?.ad_spend ?? 0),
    },
    {
      label: L("ফলোআপ সম্পন্ন"),
      value: <>{reportData?.executive_table?.followups_done ?? summary?.team_followups ?? 0} {L("টি")}</>,
    },
    {
      label: L("বড় B2B অনুসন্ধান"),
      value: <>{reportData?.executive_table?.b2b_inquiries_count ?? summary?.team_b2b ?? 0} {L("টি")}</>,
      note: (
        <>
          {L("(সম্ভাব্য মূল্য:")} {formatTaka(reportData?.executive_table?.b2b_inquiries_value ?? 0)})
        </>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<BarChart3 className="h-5 w-5" />}
        title={L("দৈনিক রিপোর্ট")}
        subtitle={L("প্রতিটি সদস্যের লক্ষ্য অর্জন ও স্কোর")}
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <div className="segmented" role="group" aria-label={L('দ্রুত তারিখ', 'Quick dates')}>
              <button
                type="button"
                data-active={selectedDate === getDhakaDateString()}
                onClick={() => setSelectedDate(getDhakaDateString())}
              >
                {L("আজ (Today)")}
              </button>
              <button
                type="button"
                data-active={selectedDate === getDhakaOffsetDateString(1)}
                onClick={() => setSelectedDate(getDhakaOffsetDateString(1))}
              >
                {L("গতকাল (Yesterday)")}
              </button>
              <button
                type="button"
                data-active={selectedDate === getDhakaOffsetDateString(2)}
                onClick={() => setSelectedDate(getDhakaOffsetDateString(2))}
              >
                {L("পরশু")}
              </button>
            </div>

            <label className="sr-only" htmlFor="daily-date">{L("তারিখ")}</label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="daily-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input w-auto pl-9 tabular-nums"
              />
            </div>
            <ReportExportButtons
              excelHref={`/api/reports/daily/export?type=excel&date=${selectedDate}`}
              pdfHref={`/api/reports/daily/export?type=pdf&date=${selectedDate}`}
            />
          </div>
        }
      />

      {errorMsg && (
        <div className="alert alert-error" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {!summary && loading && <SkeletonStatCards count={4} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" />}

      {summary && (
        <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={L("মোট বিক্রয়")}
            value={formatTaka(summary.team_sales)}
            note={L(`লাভ: ${formatTaka(summary.team_profit)}`)}
            icon={<DollarSign className="h-4 w-4" />}
            tone="brand"
          />
          <StatCard
            label={L("কর্মীদের গড় স্কোর")}
            value={
              <span className="flex items-baseline gap-2">
                {summary.team_avg_score}
                <span className="text-sm font-medium text-slate-400">{L("/ ১০০")}</span>
                <span className={`badge self-center ${summary.team_avg_score >= 80 ? 'badge-green' : 'badge-red'}`}>
                  {summary.team_avg_score >= 80 ? L('পাস', 'Pass') : L('ফেল', 'Fail')}
                </span>
              </span>
            }
            note={L(`${summary.passing_count} পাস · ${summary.failing_count} উন্নতি প্রয়োজন`)}
            icon={<Award className="h-4 w-4" />}
            tone="gray"
          />
          <StatCard
            label={L("গ্রুপ পোস্ট")}
            value={summary.team_posts}
            note={L("অনুমোদিত গ্রুপে পোস্ট")}
            icon={<CheckCircle2 className="h-4 w-4" />}
            tone="gray"
          />
          <StatCard
            label={L("গ্রাহক ও অর্ডার")}
            value={`${summary.team_new_clients} ${L('নতুন', 'new')} / ${summary.team_b2b} B2B`}
            note={L(`রিটেনশন: ${summary.team_retention} · ফলো-আপ: ${summary.team_followups}`)}
            icon={<Users className="h-4 w-4" />}
            tone="gray"
          />
        </div>
      )}

      {/* Executive daily summary */}
      <section className="card overflow-hidden print:break-inside-avoid">
        <div className="card-header">
          <div className="min-w-0">
            <h2 className="card-title">{L("দৈনিক রিপোর্ট (সারসংক্ষেপ)")}</h2>
            <p className="card-subtitle tabular-nums">
              {L("তারিখ:")} {selectedDate} {L("· মূল ব্যবসায়িক সূচক ও অগ্রাধিকার")}
            </p>
          </div>
          {isToday && <span className="badge badge-brand">{L("আজকের তথ্য")}</span>}
        </div>

        {loading && !reportData ? (
          <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
            {execRows.map((r) => (
              <div key={r.label} className="space-y-2 bg-white px-5 py-4">
                <div className="skeleton h-3 w-24" />
                <div className="skeleton h-5 w-20" />
              </div>
            ))}
          </div>
        ) : (
          <dl className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-3">
            {execRows.map((r) => (
              <div key={r.label} className="bg-white px-5 py-4">
                <dt className="text-xs font-medium text-slate-500">{r.label}</dt>
                <dd className={`mt-1 text-lg font-semibold tabular-nums ${r.tone ?? 'text-slate-900'}`}>{r.value}</dd>
                {r.note && <dd className="mt-0.5 text-xs text-slate-500 tabular-nums">{r.note}</dd>}
              </div>
            ))}
          </dl>
        )}

        <div className="grid grid-cols-1 gap-px border-t border-slate-100 bg-slate-100 md:grid-cols-2">
          <div className="bg-white px-5 py-4">
            <h3 className="text-xs font-medium text-slate-500">{L("প্রধান সমস্যা")}</h3>
            {reportData?.executive_table?.main_issues && reportData.executive_table.main_issues.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700 marker:text-slate-300">
                {reportData.executive_table.main_issues.map((issue, idx) => (
                  <li key={idx} className="leading-relaxed">{issue}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-400">{L("কোনো প্রধান সমস্যা উল্লেখিত হয়নি")}</p>
            )}
          </div>
          <div className="bg-white px-5 py-4">
            <h3 className="text-xs font-medium text-slate-500">{L("আগামী দিনের অগ্রাধিকার")}</h3>
            {reportData?.executive_table?.next_priorities && reportData.executive_table.next_priorities.length > 0 ? (
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-slate-800 marker:text-slate-400">
                {reportData.executive_table.next_priorities.map((prio, idx) => (
                  <li key={idx} className="leading-relaxed">{prio}</li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-slate-400">{L("কোনো অগ্রাধিকার তালিকাভুক্ত হয়নি")}</p>
            )}
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="card-header">
          <div>
            <h2 className="card-title">{L("সদস্যভিত্তিক পারফরম্যান্স (")}{employees.length})</h2>
            <p className="card-subtitle tabular-nums">{L("তারিখ:")} {selectedDate}</p>
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={6} cols={6} label={L("লোড হচ্ছে...")} />
        ) : employees.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title={L("কোনো তথ্য পাওয়া যায়নি")}
            description={L("এই তারিখে কোনো রিপোর্ট নেই।")}
          />
        ) : (
          <div className="max-h-[70vh] overflow-auto print:max-h-none print:overflow-visible [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-slate-50">
            <table className="table-pro min-w-[1080px] [&_td]:whitespace-nowrap">
              <thead>
                <tr>
                  <th>{L("নাম")}</th>
                  <th>{L("সেকশন")}</th>
                  <th className="text-right">{L("পোস্ট")}</th>
                  <th className="text-right">{L("বিক্রয় (৳)")}</th>
                  <th className="text-right">{L("মুনাফা (৳)")}</th>
                  <th className="text-right">{L("নতুন ক্রেতা")}</th>
                  <th className="text-right">B2B</th>
                  <th className="text-right">{L("রিটেনশন")}</th>
                  <th className="text-right">{L("ফলো-আপ")}</th>
                  <th className="text-right">{L("স্কোর")}</th>
                  <th>{L("স্ট্যাটাস")}</th>
                  <th className="no-print text-right">{L("প্রতিফলন")}</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const isFail = emp.is_failing;
                  return (
                    <tr key={emp.employee_id}>
                      <td>
                        <span className="font-medium text-slate-900">{emp.name}</span>
                        <span className="block text-xs text-slate-500">{emp.email}</span>
                      </td>
                      <td className="max-w-[160px] truncate text-slate-600" title={emp.sections.join(', ')}>
                        {emp.sections.length > 0 ? emp.sections.join(', ') : '–'}
                      </td>
                      <td className="text-right tabular-nums">
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
                      <td className="text-right tabular-nums">{emp.metrics.NEW_CLIENTS}</td>
                      <td className="text-right tabular-nums">{emp.metrics.B2B_ORDERS}</td>
                      <td className="text-right tabular-nums">{emp.metrics.RETENTION_COUNT}</td>
                      <td className="text-right tabular-nums">{emp.metrics.FOLLOWUPS_DONE}</td>
                      <td className="text-right font-semibold tabular-nums text-slate-900">{emp.score}</td>
                      <td>
                        {isFail ? (
                          <span className="badge badge-red">{L("উন্নতি প্রয়োজন")}</span>
                        ) : (
                          <span className="badge badge-green">{L("পাস")}</span>
                        )}
                      </td>
                      <td className="no-print text-right">
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
                            {L("দেখুন")}
                          </button>
                        ) : (
                          <span className="text-slate-300">–</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedReflection && (
        <div className="modal-backdrop">
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="daily-reflection-title">
            <div className="card-header">
              <div className="min-w-0">
                <h3 id="daily-reflection-title" className="card-title">{L("দৈনিক প্রতিফলন:")} {selectedReflection.name}</h3>
                <p className="card-subtitle tabular-nums">{L("তারিখ:")} {selectedDate}</p>
              </div>
              <button
                onClick={() => setSelectedReflection(null)}
                className="btn-icon"
                aria-label={L("বন্ধ করুন")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="card-body space-y-4 text-sm">
              <div>
                <span className="label">{L("প্রধান সমস্যা / বাধা")}</span>
                <p className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 leading-relaxed text-slate-800">
                  {selectedReflection.main_issue || L('কোনো সমস্যা উল্লেখ করা হয়নি।')}
                </p>
              </div>
              <div>
                <span className="label">{L("আগামীকালের ৩টি অগ্রাধিকার")}</span>
                <p className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 leading-relaxed text-slate-800">
                  {selectedReflection.next_priorities || L('কোনো অগ্রাধিকার উল্লেখ করা হয়নি।')}
                </p>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 px-5 py-4">
              <button onClick={() => setSelectedReflection(null)} className="btn btn-secondary">
                {L("বন্ধ করুন")}
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
    <Suspense fallback={<ReportPageSkeleton />}>
      <AdminDailyReportContent />
    </Suspense>
  );
}
