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
  Crown,
  Swords,
  Sparkles,
  Zap,
  Award,
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

const PERIOD_OPTIONS: { id: PeriodType; label: string; sub: string; icon: string }[] = [
  { id: 'today', label: 'আজকের যুদ্ধ', sub: "Today's Clash", icon: '🔥' },
  { id: 'yesterday', label: 'গতকাল', sub: 'Yesterday', icon: '🛡️' },
  { id: 'last7days', label: 'গত ৭ দিন', sub: 'Last 7 Days', icon: '⚔️' },
  { id: 'thisMonth', label: 'চলতি মৌসুম (মাস)', sub: 'Current Season', icon: '🏆' },
];

export default function EmployeeLeaderboardPage() {
  const { lang } = useLanguage();
  const L = (bn: string, en: string) => (lang === 'en' ? en : bn);
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

  const SECTION_COLS: { key: keyof SectionScores; bn: string; en: string; pt: string }[] = [
    { key: 'sales_profit', bn: 'বিক্রি ও লাভ', en: 'Sales & Profit', pt: '৩০' },
    { key: 'content', bn: 'পোস্ট ও কনটেন্ট', en: 'Content Raids', pt: '২০' },
    { key: 'new_buyers_b2b', bn: 'নতুন ক্রেতা/B2B', en: 'New Buyers/B2B', pt: '২০' },
    { key: 'retention', bn: 'রিটেনশন', en: 'Retention Shield', pt: '১৫' },
    { key: 'inbox_followup', bn: 'ফলোআপ স্ট্রাইক', en: 'Follow-up Blitz', pt: '১৫' },
  ];

  const first = leaderboard[0];
  const second = leaderboard[1];
  const third = leaderboard[2];

  // Arena league calculation
  const getLeagueTier = (rank: number, score: number) => {
    if (rank === 1) return { title: 'CHAMPION 👑', color: 'from-amber-400 to-yellow-500 text-amber-950' };
    if (rank === 2) return { title: 'CHALLENGER ⚔️', color: 'from-slate-200 to-slate-400 text-slate-900' };
    if (rank === 3) return { title: 'GLADIATOR 🛡️', color: 'from-amber-600 to-amber-700 text-white' };
    return { title: 'WARRIOR ⚡', color: 'from-blue-600 to-indigo-600 text-white' };
  };

  return (
    <div className="space-y-6">
      {/* ARENA STADIUM HEADER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-2xl border border-indigo-500/25">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                {L('মার্কেটার এরিনা সিজন ২০২৬', 'Marketer Arena Season 2026')}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Flame className="w-3.5 h-3.5 text-emerald-400" />
                {L('লাইভ কম্পিটিশন', 'Live Combat')}
              </span>
            </div>
            <h1 className="text-2xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-amber-200 via-white to-indigo-200 bg-clip-text text-transparent">
              {L('বিজনেস গেম এরিনা লিডারবোর্ড', 'Business Game Arena Leaderboard')}
            </h1>
            <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-xl">
              {L('টার্গেট পূরণ করে পয়েন্ট অর্জন করুন, লিডারবোর্ডের শীর্ষে পৌঁছান এবং চ্যাম্পিয়ন খেতাব অর্জন করুন!', 'Complete quests, crush targets, gain XP, and climb to the top of the battle arena!')}
            </p>
          </div>

          {/* Period selector buttons */}
          <div className="flex flex-wrap gap-1.5 bg-slate-900/80 p-1.5 rounded-xl border border-slate-700/80 backdrop-blur-md">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setPeriod(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                  period === opt.id
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md font-extrabold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>{opt.icon}</span>
                <span>{L(opt.label, opt.sub)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Current Employee HUD Card */}
        {currentEmployee && (
          <div className="relative z-10 mt-6 rounded-xl bg-slate-800/90 border border-slate-700/80 p-4 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-xl font-black text-white shadow-lg ring-2 ring-indigo-400/30">
                #{toBengaliDigits(currentEmployee.rank)}
                {currentEmployee.rank === 1 && (
                  <Crown className="absolute -top-2 -right-2 h-5 w-5 text-amber-400 filter drop-shadow" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">{currentEmployee.name}</span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    {L('আপনি (YOU)', 'YOU')}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-gradient-to-r ${getLeagueTier(currentEmployee.rank, currentEmployee.total_score).color}`}>
                    {getLeagueTier(currentEmployee.rank, currentEmployee.total_score).title}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {L('মোট স্কোর / XP', 'Arena Points / XP')}:{' '}
                  <span className="font-extrabold text-amber-400 text-sm tabular-nums">
                    {toBengaliDigits(currentEmployee.total_score.toFixed(2))}
                  </span>{' '}
                  <span className="text-slate-500">/ ১০০ পয়েন্ট</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-indigo-950/60 border border-indigo-500/30 px-3.5 py-2 text-xs text-indigo-200">
              <ArrowUp className="h-4 w-4 shrink-0 text-amber-400 animate-pulse" />
              <span>
                {currentEmployee.gap_text ||
                  `পরবর্তী স্থান দখলের ব্যবধান: ${toBengaliDigits(
                    (currentEmployee.gap_to_next ?? 0).toFixed(2)
                  )} পয়েন্ট`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* TOP 3 ARENA PODIUM */}
      {leaderboard.length > 0 && !loading && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-b from-card to-slate-50/50 dark:to-slate-900/50 p-6 shadow-sm">
          <div className="text-center mb-6">
            <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center justify-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              <span>{L('শীর্ষ ৩ অ্যারেনা চ্যাম্পিয়ন', 'Top 3 Arena Champions')}</span>
              <Crown className="w-5 h-5 text-amber-500" />
            </h2>
          </div>

          <div className="mx-auto grid max-w-xl grid-cols-3 items-end gap-3 sm:gap-6 pt-4">
            {/* 2nd Place: Silver Challenger */}
            <div className="flex flex-col items-center text-center">
              {second ? (
                <>
                  <div className="relative mb-2">
                    <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-b from-slate-200 to-slate-400 shadow-lg text-slate-900 font-extrabold text-xl ring-4 ring-slate-300">
                      🥈
                    </div>
                  </div>
                  <div className="w-full truncate text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                    {second.name}
                  </div>
                  <div className="mt-0.5 text-xs font-black text-slate-600 dark:text-slate-300 tabular-nums">
                    {toBengaliDigits(second.total_score.toFixed(2))} <span className="text-[10px] text-slate-400">XP</span>
                  </div>
                  <div className="mt-3 flex w-full h-24 sm:h-28 flex-col items-center justify-center rounded-t-2xl border-t-4 border-slate-400 bg-gradient-to-b from-slate-200/50 to-slate-300/30 dark:from-slate-800 dark:to-slate-900 shadow-inner">
                    <span className="text-lg font-black text-slate-600 dark:text-slate-300">#২</span>
                    <span className="text-[10px] font-bold uppercase text-slate-500">Challenger</span>
                  </div>
                </>
              ) : (
                <div className="h-24 w-full" />
              )}
            </div>

            {/* 1st Place: Gold Champion (Towering Podium) */}
            <div className="flex flex-col items-center text-center -mt-6">
              {first ? (
                <>
                  <div className="relative mb-2">
                    <Crown className="absolute -top-5 left-1/2 -translate-x-1/2 h-7 w-7 text-amber-400 filter drop-shadow animate-bounce" />
                    <div className="flex h-18 w-18 sm:h-20 sm:w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-300 via-amber-400 to-yellow-500 shadow-xl shadow-amber-500/20 text-amber-950 font-black text-2xl ring-4 ring-amber-300">
                      🥇
                    </div>
                  </div>
                  <div className="w-full truncate text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100">
                    {first.name}
                  </div>
                  <div className="mt-0.5 text-sm font-black text-amber-600 dark:text-amber-400 tabular-nums">
                    {toBengaliDigits(first.total_score.toFixed(2))} <span className="text-xs text-slate-400">XP</span>
                  </div>
                  <div className="mt-3 flex w-full h-32 sm:h-36 flex-col items-center justify-center rounded-t-2xl border-t-4 border-amber-400 bg-gradient-to-b from-amber-400/20 via-amber-300/10 to-transparent dark:from-amber-950/40 dark:to-slate-900 shadow-lg">
                    <span className="text-2xl font-black text-amber-600 dark:text-amber-400">#১</span>
                    <span className="text-xs font-extrabold uppercase text-amber-700 dark:text-amber-300">Champion</span>
                  </div>
                </>
              ) : (
                <div className="h-32 w-full" />
              )}
            </div>

            {/* 3rd Place: Bronze Gladiator */}
            <div className="flex flex-col items-center text-center">
              {third ? (
                <>
                  <div className="relative mb-2">
                    <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-b from-amber-600 to-amber-800 shadow-md text-amber-100 font-extrabold text-xl ring-4 ring-amber-700">
                      🥉
                    </div>
                  </div>
                  <div className="w-full truncate text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                    {third.name}
                  </div>
                  <div className="mt-0.5 text-xs font-black text-amber-700 dark:text-amber-500 tabular-nums">
                    {toBengaliDigits(third.total_score.toFixed(2))} <span className="text-[10px] text-slate-400">XP</span>
                  </div>
                  <div className="mt-3 flex w-full h-20 sm:h-22 flex-col items-center justify-center rounded-t-2xl border-t-4 border-amber-700 bg-gradient-to-b from-amber-700/20 to-amber-900/10 dark:from-slate-800 dark:to-slate-900 shadow-inner">
                    <span className="text-base font-black text-amber-700 dark:text-amber-500">#৩</span>
                    <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-500">Gladiator</span>
                  </div>
                </>
              ) : (
                <div className="h-20 w-full" />
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

      {/* FULL LEADERBOARD TABLE & CARDS */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card overflow-hidden shadow-sm">
        <div className="card-header border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Swords className="h-5 w-5 text-indigo-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {L('সকল প্রতিযোগী ও স্কোরবোর্ড', 'All Arena Competitors')}
            </h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {L('মোট যোদ্ধা', 'Total Fighters')}: {toBengaliDigits(leaderboard.length)}
          </span>
        </div>

        {loading ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-amber-500 border-t-transparent" />
            <span className="text-sm font-semibold">{L('এরিনা ডাটা লোড হচ্ছে...', 'Loading Arena Standings...')}</span>
          </div>
        ) : leaderboard.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-8 w-8 text-amber-500" />}
            title={L('কোনো প্রতিযোগী পাওয়া যায়নি', 'No competitors found')}
            description={L('এই সময়কালের জন্য কোনো স্কোর রেকর্ড পাওয়া যায়নি।', 'No leaderboard scores recorded for this period.')}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3.5 text-center w-16">র‍্যাঙ্ক</th>
                  <th className="px-4 py-3.5">মার্কেটার যোদ্ধা</th>
                  {SECTION_COLS.map((c) => (
                    <th key={c.key} className="px-3 py-3.5 text-center hidden md:table-cell">
                      {c.bn}
                      <span className="block text-[10px] font-normal lowercase text-slate-400">({c.pt} pt)</span>
                    </th>
                  ))}
                  <th className="px-4 py-3.5 text-right font-black text-amber-600 dark:text-amber-400">
                    মোট স্কোর
                    <span className="block text-[10px] font-normal lowercase text-slate-400">(/১০০ pt)</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {leaderboard.map((emp) => {
                  const isCurrent = !!emp.is_current_user;
                  return (
                    <tr
                      key={emp.employee_id}
                      className={`transition-colors ${
                        isCurrent
                          ? 'bg-amber-500/10 font-bold border-l-4 border-l-amber-500'
                          : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-extrabold ${
                            emp.rank === 1
                              ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-300'
                              : emp.rank === 2
                              ? 'bg-slate-300 text-slate-900 ring-2 ring-slate-200'
                              : emp.rank === 3
                              ? 'bg-amber-700 text-amber-100 ring-2 ring-amber-600'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          #{toBengaliDigits(emp.rank)}
                        </span>
                      </td>

                      <td className="px-4 py-4 font-sans">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {emp.name}
                          </span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500 text-white shadow-sm">
                              {L('আপনি', 'YOU')}
                            </span>
                          )}
                        </div>
                      </td>

                      {SECTION_COLS.map((c) => (
                        <td key={c.key} className="px-3 py-4 text-center hidden md:table-cell text-slate-700 dark:text-slate-300 text-xs">
                          {toBengaliDigits(emp.section_scores[c.key].toFixed(1))}
                        </td>
                      ))}

                      <td className="px-4 py-4 text-right">
                        <span className="text-base font-black text-amber-600 dark:text-amber-400">
                          {toBengaliDigits(emp.total_score.toFixed(2))}
                        </span>
                        <span className="text-xs text-slate-400 font-sans ml-1">XP</span>
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
  );
}
