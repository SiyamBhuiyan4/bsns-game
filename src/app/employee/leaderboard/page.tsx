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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900 border border-amber-300 shadow-sm">
          <Trophy className="h-4 w-4 text-amber-600 animate-bounce" />
          ১ম স্থান
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-3 py-1 text-xs font-black text-slate-800 border border-slate-300 shadow-sm">
          <Medal className="h-4 w-4 text-slate-600" />
          ২য় স্থান
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-900 border border-orange-300 shadow-sm">
          <Medal className="h-4 w-4 text-orange-600" />
          ৩য় স্থান
        </span>
      );
    }
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 border border-slate-200">
        {toBengaliDigits(rank)}
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
      {/* Header section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">টিম লিডারবোর্ড</h1>
              <p className="text-xs sm:text-sm text-slate-500">
                মার্কেটিং টিমের অর্জন ও পয়েন্ট র্যাঙ্কিং
              </p>
            </div>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100 p-1.5 border border-slate-200">
          {PERIOD_OPTIONS.map((opt) => {
            const active = period === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setPeriod(opt.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  active
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'text-slate-600 hover:text-teal-900 hover:bg-white/60'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Privacy guarantee badge */}
      <div className="flex items-start sm:items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-900 shadow-xs">
        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
        <div className="leading-relaxed">
          <span className="font-bold">তথ্য নিরাপত্তা:</span> এখানে শুধুমাত্র অর্জিত পয়েন্ট প্রদর্শিত হয়। কারো ব্যক্তিগত বিক্রি বা ক্লায়েন্ট ডাটা দৃশ্যমান নয়।
        </div>
      </div>

      {/* Current Employee Standings Highlight (if available) */}
      {currentEmployee && (
        <div className="rounded-2xl border-2 border-teal-500 bg-gradient-to-r from-teal-50 via-teal-100/40 to-emerald-50 p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600 text-white font-black text-lg shadow-sm">
                #{toBengaliDigits(currentEmployee.rank)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-slate-900">{currentEmployee.name}</span>
                  <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    আপনি (You)
                  </span>
                </div>
                <div className="text-xs font-semibold text-teal-900 mt-0.5">
                  মোট অর্জিত পয়েন্ট: <span className="font-extrabold text-teal-700 text-sm">{toBengaliDigits(currentEmployee.total_score.toFixed(2))}</span> / ১০০
                </div>
              </div>
            </div>

            {/* Gap Card */}
            <div className="rounded-xl border border-teal-300 bg-white/95 px-4 py-2.5 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500">র্যাঙ্কিং অগ্রগতি</div>
              <div className="text-xs sm:text-sm font-bold text-teal-900 flex items-center gap-1.5 mt-0.5">
                <ArrowUp className="h-4 w-4 text-teal-600" />
                <span>
                  {currentEmployee.gap_text ||
                    `আপনার পরের র্যাঙ্ক থেকে ব্যবধান: ${toBengaliDigits(
                      (currentEmployee.gap_to_next ?? 0).toFixed(2)
                    )} পয়েন্ট`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rank Podium for Top 3 Performers */}
      {leaderboard.length > 0 && !loading && (
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/60 to-white p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">সেরা ৩ পারফরমার পোডিয়াম</h2>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">র্যাঙ্ক পোডিয়াম</span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end max-w-xl mx-auto pt-4 pb-1">
            {/* 2nd Place Podium */}
            {leaderboard[1] ? (
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-2">
                  <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-slate-100 border-2 border-slate-300 text-slate-700 shadow-sm">
                    <Medal className="h-6 w-6 sm:h-7 sm:w-7 text-slate-500" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-600 text-[10px] font-black text-white">
                    ২
                  </span>
                </div>
                <div className="font-bold text-xs sm:text-sm text-slate-800 line-clamp-1 max-w-[120px]">
                  {leaderboard[1].name}
                </div>
                <div className="text-[11px] font-extrabold text-teal-700 mt-0.5">
                  {toBengaliDigits(leaderboard[1].total_score.toFixed(2))} <span className="text-[9px] text-slate-400">pt</span>
                </div>
                <div className="w-full mt-2 h-20 sm:h-24 rounded-t-xl bg-gradient-to-t from-slate-200 to-slate-100 border border-slate-300 flex items-center justify-center font-black text-slate-600 text-sm sm:text-base shadow-xs">
                  ২য়
                </div>
              </div>
            ) : (
              <div />
            )}

            {/* 1st Place Podium (Elevated in Center) */}
            {leaderboard[0] ? (
              <div className="flex flex-col items-center text-center -mt-4">
                <div className="relative mb-2">
                  <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-amber-50 border-2 border-amber-400 text-amber-600 shadow-md ring-4 ring-amber-100">
                    <Trophy className="h-7 w-7 sm:h-8 sm:w-8 text-amber-500 animate-pulse" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-[11px] font-black text-white shadow">
                    ১
                  </span>
                </div>
                <div className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1 max-w-[140px]">
                  {leaderboard[0].name}
                </div>
                <div className="text-xs sm:text-sm font-black text-amber-700 mt-0.5">
                  {toBengaliDigits(leaderboard[0].total_score.toFixed(2))} <span className="text-[10px] text-amber-600 font-normal">pt</span>
                </div>
                <div className="w-full mt-2 h-28 sm:h-32 rounded-t-xl bg-gradient-to-t from-amber-200 via-amber-100 to-amber-50 border-2 border-b-0 border-amber-300 flex items-center justify-center font-black text-amber-900 text-base sm:text-lg shadow-sm">
                  ১ম স্থান
                </div>
              </div>
            ) : (
              <div />
            )}

            {/* 3rd Place Podium */}
            {leaderboard[2] ? (
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-2">
                  <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-orange-50 border-2 border-orange-300 text-orange-600 shadow-sm">
                    <Medal className="h-6 w-6 sm:h-7 sm:w-7 text-orange-500" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-[10px] font-black text-white">
                    ৩
                  </span>
                </div>
                <div className="font-bold text-xs sm:text-sm text-slate-800 line-clamp-1 max-w-[120px]">
                  {leaderboard[2].name}
                </div>
                <div className="text-[11px] font-extrabold text-teal-700 mt-0.5">
                  {toBengaliDigits(leaderboard[2].total_score.toFixed(2))} <span className="text-[9px] text-slate-400">pt</span>
                </div>
                <div className="w-full mt-2 h-16 sm:h-20 rounded-t-xl bg-gradient-to-t from-orange-200 to-orange-100 border border-orange-300 flex items-center justify-center font-black text-orange-800 text-sm sm:text-base shadow-xs">
                  ৩য়
                </div>
              </div>
            ) : (
              <div />
            )}
          </div>
        </div>
      )}

      {/* Error notification */}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-4 text-xs font-semibold text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Table / Leaderboard Container */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-500" />
            <h2 className="text-xs sm:text-sm font-bold text-slate-800">
              সর্বোচ্চ স্কোরধারী মার্কেটার তালিকা
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            মোট সদস্য: {toBengaliDigits(leaderboard.length)} জন
          </span>
        </div>

        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-400">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
            <span className="text-xs font-medium">লিডারবোর্ড তথ্য লোড হচ্ছে...</span>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            এই সময়কালের জন্য কোনো লিডারবোর্ড তথ্য পাওয়া যায়নি।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3.5 sm:px-6">র্যাঙ্ক</th>
                  <th scope="col" className="px-4 py-3.5">মার্কেটার</th>
                  <th scope="col" className="px-3 py-3.5 text-center">
                    বিক্রি ও লাভ
                    <span className="block text-[10px] font-normal text-slate-400">(৩০ pt)</span>
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-center">
                    কনটেন্ট
                    <span className="block text-[10px] font-normal text-slate-400">(২০ pt)</span>
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-center">
                    নতুন ক্রেতা/B2B
                    <span className="block text-[10px] font-normal text-slate-400">(২০ pt)</span>
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-center">
                    রিটেনশন
                    <span className="block text-[10px] font-normal text-slate-400">(১৫ pt)</span>
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-center">
                    ইনবক্স ও ফলোআপ
                    <span className="block text-[10px] font-normal text-slate-400">(১৫ pt)</span>
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right font-black sm:px-6">
                    মোট পয়েন্ট
                    <span className="block text-[10px] font-normal text-slate-400">(/১০০ pt)</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {leaderboard.map((emp) => {
                  const isCurrent = !!emp.is_current_user;
                  return (
                    <tr
                      key={emp.employee_id}
                      className={`transition-colors ${
                        isCurrent
                          ? 'bg-teal-50/90 font-medium border-l-4 border-l-teal-600'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Rank */}
                      <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                        {renderRankBadge(emp.rank)}
                      </td>

                      {/* Employee Name */}
                      <td className="whitespace-nowrap px-4 py-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{emp.name}</span>
                          {isCurrent && (
                            <span className="inline-flex items-center rounded-md bg-teal-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                              আপনি (You)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Section 1: Sales & Profit */}
                      <td className="whitespace-nowrap px-3 py-4 text-center font-semibold text-slate-700">
                        {toBengaliDigits(emp.section_scores.sales_profit.toFixed(2))}
                      </td>

                      {/* Section 2: Content */}
                      <td className="whitespace-nowrap px-3 py-4 text-center font-semibold text-slate-700">
                        {toBengaliDigits(emp.section_scores.content.toFixed(2))}
                      </td>

                      {/* Section 3: New Buyers & B2B */}
                      <td className="whitespace-nowrap px-3 py-4 text-center font-semibold text-slate-700">
                        {toBengaliDigits(emp.section_scores.new_buyers_b2b.toFixed(2))}
                      </td>

                      {/* Section 4: Retention */}
                      <td className="whitespace-nowrap px-3 py-4 text-center font-semibold text-slate-700">
                        {toBengaliDigits(emp.section_scores.retention.toFixed(2))}
                      </td>

                      {/* Section 5: Inbox & Follow-up */}
                      <td className="whitespace-nowrap px-3 py-4 text-center font-semibold text-slate-700">
                        {toBengaliDigits(emp.section_scores.inbox_followup.toFixed(2))}
                      </td>

                      {/* Total Score */}
                      <td className="whitespace-nowrap px-4 py-4 text-right sm:px-6">
                        <span className="text-sm font-black text-teal-800">
                          {toBengaliDigits(emp.total_score.toFixed(2))}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400"> / ১০০</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Explanatory cards / Legend */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs text-slate-600">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-1">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <Trophy className="h-4 w-4 text-amber-500" />
            স্কোরিং নিয়মাবলী
          </div>
          <p className="text-slate-500 leading-relaxed text-[11px]">
            টার্গেটের সাথে বাস্তব কাজের অর্জনের ভিত্তিতে স্কেলড পয়েন্ট হিসাব করা হয়। কোনো নির্দিষ্ট মেট্রিকের টার্গেট না থাকলে অবশিষ্ট মেট্রিকগুলোর ১০০ পয়েন্টে প্রোপোরশনাল রিক্যালকুলেশন হয়।
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-1">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-teal-600" />
            র্যাঙ্ক ব্যবধান
          </div>
          <p className="text-slate-500 leading-relaxed text-[11px]">
            শীর্ষ ১ নম্বর ব্যক্তি তার পরবর্তী প্রতিযোগীর চেয়ে কত পয়েন্টে এগিয়ে তা দেখেন। অন্যান্যরা তাদের ঠিক উপরের র্যাঙ্কে পৌঁছাতে কত পয়েন্ট লাগবে তা জানতে পারেন।
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-1 sm:col-span-2 lg:col-span-1">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            গোপনীয়তা ও নিরাপত্তা
          </div>
          <p className="text-slate-500 leading-relaxed text-[11px]">
            টিমের সুস্থ প্রতিযোগিতা বজায় রাখতে কারো সংবেদনশীল আর্থিক তথ্য বা ক্লায়েন্টের নাম উন্মুক্ত করা হয় না। কেবল পারফরম্যান্স পয়েন্ট প্রদর্শিত হয়।
          </p>
        </div>
      </div>
    </div>
  );
}
