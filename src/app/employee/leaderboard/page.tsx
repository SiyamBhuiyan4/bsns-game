'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Medal,
  ShieldCheck,
  TrendingUp,
  Flame,
  AlertCircle,
  ArrowUp,
} from 'lucide-react';
import { toBengaliDigits } from '@/lib/date';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { useLanguage } from '@/components/LanguageContext';

interface SectionScores {
  sales_profit: number;
  content: number;
  new_buyers_b2b: number;
  retention: number;
  inbox_followup: number;
}

interface LeaderboardItem {
  rank: number;
  employee_id: string;
  name: string;
  total_score: number;
  section_scores: SectionScores;
  is_current_user?: boolean;
  gap_to_next?: number;
  gap_text?: string;
}

type PeriodType = 'thisMonth' | 'today' | 'yesterday' | 'last7days';

const PERIOD_OPTIONS: { id: PeriodType; label: string; sub: string }[] = [
  { id: 'thisMonth', label: 'এই মাস', sub: 'Current Month' },
  { id: 'today', label: 'আজ', sub: 'Today' },
  { id: 'yesterday', label: 'গতকাল', sub: 'Yesterday' },
  { id: 'last7days', label: 'গত ৭ দিন', sub: 'Last 7 Days' },
];

export default function EmployeeLeaderboardPage() {
  const { lang } = useLanguage();
  const L = (bn: string, en: string) => (lang === 'en' ? en : bn);
  const [period, setPeriod] = useState<PeriodType>('thisMonth');
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchLeaderboard = useCallback(async (selectedPeriod: PeriodType) => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetch(`/api/employee/leaderboard?period=${selectedPeriod}`);
      if (!res.ok) {
        throw new Error('লিডারবোর্ড তথ্য লোড করতে ব্যর্থ হয়েছে');
      }
      const data = await res.json();
      const list: LeaderboardItem[] = Array.isArray(data) ? data : data.leaderboard || [];
      setLeaderboard(list);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'ত্রুটি হয়েছে');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard(period);
  }, [period, fetchLeaderboard]);

  const currentEmployee = leaderboard.find((item) => item.is_current_user);

  const renderRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="badge badge-amber">
          <Trophy className="h-3 w-3" />
          ১ম
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="badge badge-gray">
          <Medal className="h-3 w-3" />
          ২য়
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="badge badge-amber">
          <Medal className="h-3 w-3" />
          ৩য়
        </span>
      );
    }
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">
        {toBengaliDigits(rank)}
      </span>
    );
  };

  const SECTION_COLS: { key: keyof SectionScores; bn: string; en: string; pt: string }[] = [
    { key: 'sales_profit', bn: 'বিক্রি ও লাভ', en: 'Sales', pt: '৩০' },
    { key: 'content', bn: 'কনটেন্ট', en: 'Content', pt: '২০' },
    { key: 'new_buyers_b2b', bn: 'নতুন ক্রেতা/B2B', en: 'New/B2B', pt: '২০' },
    { key: 'retention', bn: 'রিটেনশন', en: 'Retention', pt: '১৫' },
    { key: 'inbox_followup', bn: 'ইনবক্স ও ফলোআপ', en: 'Follow-up', pt: '১৫' },
  ];

  const podium = [
    { item: leaderboard[1], place: '২য়', height: 'h-16 sm:h-20', icon: <Medal className="h-5 w-5 text-slate-500" /> },
    { item: leaderboard[0], place: '১ম', height: 'h-24 sm:h-28', icon: <Trophy className="h-5 w-5 text-amber-500" /> },
    { item: leaderboard[2], place: '৩য়', height: 'h-12 sm:h-14', icon: <Medal className="h-5 w-5 text-amber-700" /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Trophy className="h-5 w-5" />}
        title={L('লিডারবোর্ড', 'Leaderboard')}
        subtitle={L('টিমের পয়েন্ট র‍্যাঙ্কিং; শুধু পয়েন্ট দেখানো হয়।', 'Team ranking by points only.')}
        actions={
          <div className="segmented">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  data-active={period === opt.id}
                  onClick={() => setPeriod(opt.id)}
                  className="whitespace-nowrap"
                  title={opt.sub}
                >
                  {L(opt.label, opt.sub)}
                </button>
              ))}
          </div>
        }
      />

      {/* Current employee standing */}
      {currentEmployee && (
        <div className="card card-body flex flex-col gap-4 border-brand-200 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-base font-semibold text-brand-700 ring-1 ring-brand-600/10">
              #{toBengaliDigits(currentEmployee.rank)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-[15px] font-semibold text-slate-900">{currentEmployee.name}</span>
                <span className="badge badge-green">{L('আপনি', 'You')}</span>
              </div>
              <div className="mt-0.5 text-sm text-slate-500">
                {L('মোট পয়েন্ট', 'Points')}:{' '}
                <span className="font-semibold text-slate-900 tabular-nums">
                  {toBengaliDigits(currentEmployee.total_score.toFixed(2))}
                </span>{' '}
                / ১০০
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <ArrowUp className="h-4 w-4 shrink-0 text-brand-600" />
            <span>
              {currentEmployee.gap_text ||
                `আপনার পরের র্যাঙ্ক থেকে ব্যবধান: ${toBengaliDigits(
                  (currentEmployee.gap_to_next ?? 0).toFixed(2)
                )} পয়েন্ট`}
            </span>
          </div>
        </div>
      )}

      {/* Podium */}
      {leaderboard.length > 0 && !loading && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">{L('সেরা ৩', 'Top 3')}</h2>
          </div>
          <div className="card-body">
            <div className="mx-auto grid max-w-lg grid-cols-3 items-end gap-2 sm:gap-4">
              {podium.map(({ item, place, height, icon }) =>
                item ? (
                  <div key={place} className="flex min-w-0 flex-col items-center text-center">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 ring-1 ring-slate-200">
                      {icon}
                    </div>
                    <div className="w-full truncate text-xs font-medium text-slate-900 sm:text-sm">{item.name}</div>
                    <div className="mt-0.5 text-xs font-semibold text-brand-700 tabular-nums">
                      {toBengaliDigits(item.total_score.toFixed(2))} <span className="font-normal text-slate-400">pt</span>
                    </div>
                    <div
                      className={`mt-2 flex w-full items-center justify-center rounded-t-lg border border-b-0 border-slate-200 bg-slate-50 text-sm font-semibold text-slate-600 ${height}`}
                    >
                      {place}
                    </div>
                  </div>
                ) : (
                  <div key={place} />
                )
              )}
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="alert alert-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Ranking list */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-slate-400" />
            <h2 className="card-title">{L('র‍্যাঙ্কিং', 'Ranking')}</h2>
          </div>
          <span className="card-subtitle">
            {L('সদস্য', 'Members')}: {toBengaliDigits(leaderboard.length)}
          </span>
        </div>

        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-500">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            <span className="text-sm">{L('লোড হচ্ছে...', 'Loading...')}</span>
          </div>
        ) : leaderboard.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-5 w-5" />}
            title={L('কোনো তথ্য নেই', 'No data')}
            description={L('এই সময়কালের লিডারবোর্ড পাওয়া যায়নি', 'No leaderboard for this period')}
          />
        ) : (
          <>
            {/* Phone: stacked rows */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {leaderboard.map((emp) => {
                const isCurrent = !!emp.is_current_user;
                return (
                  <li
                    key={emp.employee_id}
                    className={`px-4 py-3 ${isCurrent ? 'bg-brand-50/60 shadow-[inset_3px_0_0_var(--color-brand-600)]' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="shrink-0">{renderRankBadge(emp.rank)}</div>
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate text-sm font-medium text-slate-900">{emp.name}</span>
                        {isCurrent && <span className="badge badge-green">আপনি</span>}
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-sm font-semibold text-slate-900 tabular-nums">
                          {toBengaliDigits(emp.total_score.toFixed(2))}
                        </span>
                        <span className="text-xs text-slate-400"> / ১০০</span>
                      </div>
                    </div>
                    <dl className="mt-2 grid grid-cols-5 gap-1 text-center text-[11px]">
                      {SECTION_COLS.map((c) => (
                        <div key={c.key} className="min-w-0 rounded-md bg-slate-50 px-1 py-1">
                          <dt className="truncate text-slate-400">{c.en}</dt>
                          <dd className="font-medium text-slate-700 tabular-nums">
                            {toBengaliDigits(emp.section_scores[c.key].toFixed(2))}
                          </dd>
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
                    <th scope="col">র‍্যাঙ্ক</th>
                    <th scope="col">মার্কেটার</th>
                    {SECTION_COLS.map((c) => (
                      <th key={c.key} scope="col" className="text-center">
                        {c.bn}
                        <span className="block text-[10px] font-normal normal-case text-slate-400">({c.pt} pt)</span>
                      </th>
                    ))}
                    <th scope="col" className="text-right">
                      মোট
                      <span className="block text-[10px] font-normal normal-case text-slate-400">(/১০০ pt)</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {leaderboard.map((emp) => {
                    const isCurrent = !!emp.is_current_user;
                    return (
                      <tr
                        key={emp.employee_id}
                        className={isCurrent ? 'bg-brand-50/60 [&>td:first-child]:shadow-[inset_3px_0_0_var(--color-brand-600)]' : ''}
                      >
                        <td className="whitespace-nowrap">{renderRankBadge(emp.rank)}</td>
                        <td className="whitespace-nowrap font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{emp.name}</span>
                            {isCurrent && <span className="badge badge-green">{L('আপনি', 'You')}</span>}
                          </div>
                        </td>
                        {SECTION_COLS.map((c) => (
                          <td key={c.key} className="whitespace-nowrap text-center">
                            {toBengaliDigits(emp.section_scores[c.key].toFixed(2))}
                          </td>
                        ))}
                        <td className="whitespace-nowrap text-right">
                          <span className="font-semibold text-slate-900">{toBengaliDigits(emp.total_score.toFixed(2))}</span>
                          <span className="text-xs text-slate-400"> / ১০০</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* How it works */}
      <div className="card card-body">
        <h2 className="card-title mb-3">{L('কীভাবে কাজ করে', 'How it works')}</h2>
        <ul className="grid grid-cols-1 gap-4 text-sm text-slate-600 md:grid-cols-3">
          <li className="flex gap-2.5">
            <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>
              টার্গেট বনাম অর্জন থেকে পয়েন্ট হিসাব হয়; টার্গেট না থাকলে বাকি মেট্রিক ১০০-তে পুনর্গণনা হয়।
            </span>
          </li>
          <li className="flex gap-2.5">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>
              ১ নম্বর দেখেন কত পয়েন্টে এগিয়ে; অন্যরা দেখেন উপরের র্যাঙ্কে যেতে কত পয়েন্ট লাগবে।
            </span>
          </li>
          <li className="flex gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>শুধু পয়েন্ট দেখানো হয়; কারো বিক্রি বা ক্লায়েন্টের তথ্য নয়।</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
