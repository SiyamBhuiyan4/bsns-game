'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, AlertCircle, ArrowUp, Crown, Users } from 'lucide-react';
import { toBengaliDigits } from '@/lib/date';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import Avatar from '@/components/ui/Avatar';
import { readAvatarPrefs, type AvatarPrefs } from '@/components/ProfileMenu';
import { useLanguage } from '@/components/LanguageContext';
import { Skeleton } from '@/components/ui/Skeleton';

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

/** Solid medal colours: fixed tones with white text read well in both themes. */
const MEDALS: Record<number, string> = {
  1: '#f59e0b',
  2: '#94a3b8',
  3: '#c2410c',
};

export default function EmployeeLeaderboardPage() {
  const { L, digitStyle } = useLanguage();
  const PERIOD_OPTIONS: { id: PeriodType; label: string }[] = [
    { id: 'today', label: L('আজ', 'Today') },
    { id: 'yesterday', label: L('গতকাল', 'Yesterday') },
    { id: 'last7days', label: L('গত ৭ দিন', 'Last 7 days') },
    { id: 'thisMonth', label: L('এই মাস', 'This month') },
  ];
  const [period, setPeriod] = useState<PeriodType>('today');
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchLeaderboard = useCallback(async (selectedPeriod: PeriodType) => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetch(`/api/employee/leaderboard?period=${selectedPeriod}`);
      if (!res.ok) {
        throw new Error(L('লিডারবোর্ড তথ্য লোড করতে ব্যর্থ হয়েছে'));
      }
      const data = await res.json();
      const list: LeaderboardItem[] = Array.isArray(data) ? data : data.leaderboard || [];
      setLeaderboard(list);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : L('ত্রুটি হয়েছে'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard(period);
  }, [period, fetchLeaderboard]);

  // The signed-in person's own avatar choice, so their picture matches the sidebar.
  const [myAvatar, setMyAvatar] = useState<AvatarPrefs>({ style: 'animated', tone: null });
  useEffect(() => setMyAvatar(readAvatarPrefs()), []);

  const currentEmployee = leaderboard.find((item) => item.is_current_user);

  const SECTION_COLS: { key: keyof SectionScores; label: string; pt: string }[] = [
    { key: 'sales_profit', label: L('বিক্রি ও লাভ', 'Sales & profit'), pt: L('৩০', '30') },
    { key: 'content', label: L('পোস্ট ও কনটেন্ট', 'Posts & content'), pt: L('২০', '20') },
    { key: 'new_buyers_b2b', label: L('নতুন ক্রেতা/B2B', 'New buyers/B2B'), pt: L('২০', '20') },
    { key: 'retention', label: L('রিটেনশন', 'Retention'), pt: L('১৫', '15') },
    { key: 'inbox_followup', label: L('ফলোআপ', 'Follow-ups'), pt: L('১৫', '15') },
  ];

  const num = (v: string | number) => (digitStyle === 'bn' ? toBengaliDigits(v) : String(v));

  const first = leaderboard[0];
  const second = leaderboard[1];
  const third = leaderboard[2];

  const avatarFor = (emp: LeaderboardItem, size: number, animated = false) =>
    emp.is_current_user ? (
      <Avatar name={emp.name} size={size} animated={myAvatar.style === 'animated'} tone={myAvatar.tone} />
    ) : (
      <Avatar name={emp.name} size={size} animated={animated} />
    );

  const rankChip = (rank: number) =>
    MEDALS[rank] ? (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white tabular-nums shadow-sm"
        style={{ backgroundColor: MEDALS[rank] }}
      >
        {num(rank)}
      </span>
    ) : (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 tabular-nums">
        {num(rank)}
      </span>
    );

  const podiumSlot = (emp: LeaderboardItem | undefined, place: 1 | 2 | 3) => {
    const base = place === 1 ? 'h-28 sm:h-32' : place === 2 ? 'h-20 sm:h-24' : 'h-16 sm:h-20';
    if (!emp) return <div className={`w-full ${base}`} />;
    return (
      <div className="flex min-w-0 flex-col items-center text-center">
        <div className="relative mb-2">
          {place === 1 && (
            <Crown aria-hidden className="absolute -top-5 left-1/2 h-5 w-5 -translate-x-1/2 text-amber-500" />
          )}
          {avatarFor(emp, place === 1 ? 64 : 52, place === 1)}
        </div>
        <div className="w-full truncate px-1 text-xs font-semibold text-slate-900 sm:text-sm">{emp.name}</div>
        <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
          <span className="font-semibold text-slate-800">{num(emp.total_score.toFixed(2))}</span> {L('পয়েন্ট', 'pts')}
        </div>
        <div
          className={`mt-3 flex w-full items-start justify-center rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 pt-3 ${base}`}
          style={{ borderTopColor: MEDALS[place], borderTopWidth: 3 }}
        >
          {rankChip(place)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Trophy className="h-5 w-5" />}
        title={L('লিডারবোর্ড', 'Leaderboard')}
        subtitle={L(
          'টার্গেট পূরণ করে পয়েন্ট অর্জন করুন, লিডারবোর্ডের শীর্ষে পৌঁছান এবং চ্যাম্পিয়ন খেতাব অর্জন করুন!',
          'Hit your targets, earn points and climb to the top of the team.'
        )}
        actions={
          <div role="tablist" aria-label={L('সময়কাল', 'Period')} className="segmented grid w-full grid-cols-4 sm:inline-flex sm:w-auto">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={period === opt.id}
                data-active={period === opt.id}
                onClick={() => setPeriod(opt.id)}
                className="min-h-10 whitespace-nowrap px-2 sm:min-h-0 sm:px-3"
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      />

      {errorMsg && (
        <div className="alert alert-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Your position */}
      {loading ? (
        <div className="card flex items-center gap-4 p-5" aria-hidden>
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="hidden h-10 w-24 rounded-xl sm:block" />
        </div>
      ) : (
        currentEmployee && (
          <section className="profile-card animate-fade-up rounded-2xl p-5 shadow-[var(--shadow-card)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                {avatarFor(currentEmployee, 56)}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-base font-semibold text-slate-900">{currentEmployee.name}</span>
                    <span className="badge badge-brand">{L('আপনি', 'You')}</span>
                  </div>
                  <div className="mt-0.5 text-sm text-slate-500">
                    {L('আপনার র‍্যাঙ্ক', 'Your rank')}{' '}
                    <span className="font-semibold text-slate-900 tabular-nums">#{num(currentEmployee.rank)}</span>
                    {' · '}
                    <span className="tabular-nums">{leaderboard.length}</span> {L('জনের মধ্যে', 'in the team')}
                  </div>
                </div>
              </div>

              <div className="flex items-end gap-1.5 sm:flex-col sm:items-end sm:gap-0">
                <span className="text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
                  {num(currentEmployee.total_score.toFixed(2))}
                </span>
                <span className="pb-1 text-xs text-slate-500 sm:pb-0">{L('/ ১০০ পয়েন্ট')}</span>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3.5 py-2.5 text-sm text-slate-700">
              <ArrowUp className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span>
                {currentEmployee.gap_text ||
                  L(`পরবর্তী স্থান দখলের ব্যবধান: ${toBengaliDigits(
                    (currentEmployee.gap_to_next ?? 0).toFixed(2)
                  )} পয়েন্ট`)}
              </span>
            </div>
          </section>
        )
      )}

      {/* Top 3 */}
      {loading ? (
        <div className="card p-5" aria-hidden>
          <Skeleton className="mx-auto mb-6 h-4 w-32" />
          <div className="mx-auto grid max-w-lg grid-cols-3 items-end gap-3 sm:gap-6">
            {['h-20', 'h-28', 'h-16'].map((h, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className={`w-full rounded-b-none rounded-t-xl ${h}`} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        leaderboard.length > 0 && (
          <section className="card overflow-hidden">
            <div className="card-header justify-center">
              <h2 className="card-title flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" />
                {L('শীর্ষ ৩ জন', 'Top 3')}
              </h2>
            </div>
            <div className="mx-auto grid max-w-lg grid-cols-3 items-end gap-3 px-4 pt-8 sm:gap-6">
              {podiumSlot(second, 2)}
              {podiumSlot(first, 1)}
              {podiumSlot(third, 3)}
            </div>
          </section>
        )
      )}

      {/* Full ranking */}
      <section className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
              <Users className="h-4 w-4" />
            </span>
            <h2 className="card-title">{L('সম্পূর্ণ র‍্যাঙ্কিং', 'Full ranking')}</h2>
          </div>
          <span className="badge badge-gray tabular-nums">
            {L('মোট মার্কেটার', 'Marketers')}: {num(leaderboard.length)}
          </span>
        </div>

        {loading ? (
          <div role="status" aria-busy="true" className="divide-y divide-slate-100">
            <span className="sr-only">{L('লোড হচ্ছে...', 'Loading...')}</span>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-4 flex-1 max-w-40" />
                <Skeleton className="ml-auto h-5 w-14" />
              </div>
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-5 w-5 text-amber-500" />}
            title={L('কোনো প্রতিযোগী পাওয়া যায়নি', 'No competitors found')}
            description={L('এই সময়কালের জন্য কোনো স্কোর রেকর্ড পাওয়া যায়নি।', 'No leaderboard scores recorded for this period.')}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-pro">
              <thead>
                <tr>
                  <th className="w-14 text-center">{L('র‍্যাঙ্ক')}</th>
                  <th>{L('মার্কেটার', 'Marketer')}</th>
                  {SECTION_COLS.map((c) => (
                    <th key={c.key} className="hidden text-center md:table-cell">
                      {c.label}
                      <span className="block text-[10px] font-normal normal-case text-slate-400">
                        {c.pt} {L('পয়েন্ট', 'pts')}
                      </span>
                    </th>
                  ))}
                  <th className="text-right">
                    {L('মোট স্কোর')}
                    <span className="block text-[10px] font-normal normal-case text-slate-400">{L('(/১০০ pt)')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {leaderboard.map((emp) => {
                  const isCurrent = !!emp.is_current_user;
                  return (
                    <tr
                      key={emp.employee_id}
                      className={isCurrent ? 'bg-brand-50/60 shadow-[inset_3px_0_0_var(--color-brand-600)]' : ''}
                    >
                      <td className="text-center">
                        {rankChip(emp.rank)}
                      </td>
                      <td>
                        <div className="flex min-w-0 items-center gap-3">
                          {avatarFor(emp, 36)}
                          <span className="max-w-[9rem] truncate font-medium text-slate-900 sm:max-w-xs">{emp.name}</span>
                          {isCurrent && <span className="badge badge-brand shrink-0">{L('আপনি', 'You')}</span>}
                        </div>
                      </td>
                      {SECTION_COLS.map((c) => (
                        <td key={c.key} className="hidden text-center text-xs md:table-cell">
                          {num(emp.section_scores[c.key].toFixed(1))}
                        </td>
                      ))}
                      <td className="text-right">
                        <span className="text-base font-semibold text-slate-900">{num(emp.total_score.toFixed(2))}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
