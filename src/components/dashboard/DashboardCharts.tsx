'use client';

import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  SectionTargetChartItem,
  TeamScoreShareItem,
  DailyTeamTrendItem,
  CampaignBudgetItem,
  LeadSourceItem,
} from '@/lib/dashboard';
import { toBengaliDigits, formatTaka } from '@/lib/date';
import {
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  Megaphone,
  Users2,
} from 'lucide-react';

interface Props {
  sectionTargets: SectionTargetChartItem[];
  teamScoreShare: TeamScoreShareItem[];
  dailyTeamTrend: DailyTeamTrendItem[];
  campaignBudgets: CampaignBudgetItem[];
  leadSources: LeadSourceItem[];
}

const PIE_COLORS = [
  '#10B981', // emerald
  '#0EA5E9', // sky blue
  '#8B5CF6', // violet
  '#F59E0B', // amber
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
  '#6366F1', // indigo
];

const LINE_COLORS = [
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#F59E0B',
  '#EC4899',
  '#14B8A6',
];

function EmptyChartState({ message = 'এই সময়ের কোনো তথ্য নেই (No data)' }: { message?: string }) {
  return (
    <div className="flex h-72 sm:h-80 w-full flex-col items-center justify-center rounded-xl bg-slate-50/80 border border-dashed border-slate-200 text-center p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
        <BarChart3 className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-slate-600">{message}</p>
      <p className="text-xs text-slate-400 mt-1">নির্বাচিত সময়সীমার জন্য ডাটাবেসে কোনো রেকর্ড নেই</p>
    </div>
  );
}

export default function DashboardCharts({
  sectionTargets,
  teamScoreShare,
  dailyTeamTrend,
  campaignBudgets,
  leadSources,
}: Props) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-80 rounded-2xl bg-white border border-slate-200 p-5 shadow-xs animate-pulse ${
              i === 3 ? 'lg:col-span-2' : ''
            }`}
          >
            <div className="h-5 w-40 bg-slate-200 rounded mb-4" />
            <div className="h-60 bg-slate-100 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  // 1. Check Section Targets validity
  const hasSectionData =
    sectionTargets &&
    sectionTargets.length > 0 &&
    sectionTargets.some((item) => item.target > 0 || item.achieved > 0);

  // 2. Check Team Score Share validity
  const hasTeamScoreData =
    teamScoreShare &&
    teamScoreShare.length > 0 &&
    teamScoreShare.some((item) => item.score > 0);

  // 3. Check Daily Trend validity
  const hasTrendData =
    dailyTeamTrend &&
    dailyTeamTrend.length > 0 &&
    dailyTeamTrend.some((item) => item.total > 0);

  // Extract employee keys for Line Chart (all keys except 'date' and 'total')
  const employeeNames =
    dailyTeamTrend.length > 0
      ? Object.keys(dailyTeamTrend[0]).filter((k) => k !== 'date' && k !== 'total')
      : [];

  // 4. Check Campaign Budgets validity
  const hasCampaignData =
    campaignBudgets &&
    campaignBudgets.length > 0 &&
    campaignBudgets.some((item) => item.budget > 0 || item.spend > 0);

  // 5. Check Lead Sources validity
  const hasLeadSourceData =
    leadSources &&
    leadSources.length > 0 &&
    leadSources.some((item) => item.count > 0);

  return (
    <div className="space-y-6">
      {/* 2-Column Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ========================================================= */}
        {/* 1. Bar Chart: Section Achieved vs Target */}
        {/* ========================================================= */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  ১. সেকশন ভিত্তিক লক্ষ্য বনাম অর্জন (Achieved vs Target)
                </h3>
                <p className="text-[11px] text-slate-500">
                  টার্গেট (ধূসর) বনাম অর্জিত অগ্রগতি (সবুজ)
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
              বার চার্ট
            </span>
          </div>

          <div className="w-full min-w-0 h-72 sm:h-80 overflow-hidden">
            {!hasSectionData ? (
              <EmptyChartState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sectionTargets}
                  margin={{ top: 15, right: 15, left: -10, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="name"
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => (val >= 1000 ? `${val / 1000}k` : `${val}`)}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item = payload[0].payload as SectionTargetChartItem;
                      return (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs">
                          <p className="font-bold text-slate-900 mb-1.5">{item.name}</p>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-4 text-slate-600">
                              <span className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-full bg-slate-400"></span>
                                লক্ষ্য (Target):
                              </span>
                              <span className="font-semibold text-slate-800">
                                {item.unit === '৳' ? formatTaka(item.target) : `${item.target.toLocaleString()} ${item.unit}`}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-slate-600">
                              <span className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                                অর্জিত (Achieved):
                              </span>
                              <span className="font-semibold text-emerald-700">
                                {item.unit === '৳' ? formatTaka(item.achieved) : `${item.achieved.toLocaleString()} ${item.unit}`}
                              </span>
                            </div>
                            <div className="pt-1 mt-1 border-t border-slate-100 flex items-center justify-between font-bold">
                              <span>অর্জন হার:</span>
                              <span className={item.percent >= 100 ? 'text-emerald-600' : 'text-blue-600'}>
                                {toBengaliDigits(item.percent)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                  />
                  <Bar
                    dataKey="target"
                    name="টার্গেট (Target)"
                    fill="#94A3B8"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="achieved"
                    name="অর্জিত (Achieved)"
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. Pie Chart: Team Score Share by Employee */}
        {/* ========================================================= */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                <PieIcon className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  ২. টিমের স্কোর অনুপাত (Team Score Share)
                </h3>
                <p className="text-[11px] text-slate-500">
                  কর্মীভিত্তিক পারফরম্যান্স অবদান ও শতকরা ভাগ
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full">
              পাই চার্ট
            </span>
          </div>

          <div className="w-full min-w-0 h-72 sm:h-80 overflow-hidden">
            {!hasTeamScoreData ? (
              <EmptyChartState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item = payload[0].payload as TeamScoreShareItem;
                      return (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs">
                          <p className="font-bold text-slate-900">{item.name}</p>
                          <p className="text-slate-600 mt-1">
                            মোট স্কোর: <strong className="text-slate-800">{toBengaliDigits(item.score)} পয়েন্ট</strong>
                          </p>
                          <p className="text-slate-600">
                            টিমে অবদান: <strong className="text-emerald-700">{toBengaliDigits(item.percent)}%</strong>
                          </p>
                          {item.sales > 0 && (
                            <p className="text-slate-500 mt-1">
                              বিক্রয়: {formatTaka(item.sales)}
                            </p>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    iconType="circle"
                    formatter={(value: string) => {
                      const item = teamScoreShare.find((t) => t.name === value);
                      return (
                        <span className="text-[11px] text-slate-700 font-medium">
                          {value} ({item?.percent ? toBengaliDigits(item.percent) : '০'}%)
                        </span>
                      );
                    }}
                  />
                  <Pie
                    data={teamScoreShare}
                    dataKey="score"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={45}
                    outerRadius={85}
                    paddingAngle={3}
                    label={({ percent }: { percent?: number }) =>
                      percent && percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                    }
                    labelLine={false}
                  >
                    {teamScoreShare.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. Line Chart: Daily Team Trend (Last 30 Days) Full Width */}
      {/* ========================================================= */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 mb-4 gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                ৩. দৈনিক টিম অগ্রগতি ট্রেন্ড (Daily Team Trend — Last 30 Days)
              </h3>
              <p className="text-[11px] text-slate-500">
                প্রতি কর্মীর দৈনিক পারফরম্যান্স ও টিম মোট সেলস লাইন
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full self-start sm:self-auto">
            লাইন চার্ট (৩০ দিন)
          </span>
        </div>

        <div className="w-full min-w-0 h-72 sm:h-80 overflow-hidden">
          {!hasTrendData ? (
            <EmptyChartState />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={dailyTeamTrend}
                margin={{ top: 15, right: 20, left: -10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="date"
                  stroke="#64748B"
                  fontSize={10}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => (val >= 1000 ? `${val / 1000}k` : `${val}`)}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs max-w-xs">
                        <p className="font-bold text-slate-900 mb-1.5 border-b border-slate-100 pb-1">
                          তারিখ: {label}
                        </p>
                        <div className="space-y-1">
                          {payload.map((entry, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-3 text-slate-700"
                            >
                              <span className="flex items-center gap-1.5 truncate">
                                <span
                                  className="h-2 w-2 rounded-full shrink-0"
                                  style={{ backgroundColor: entry.color }}
                                />
                                <span className="truncate">{entry.name}:</span>
                              </span>
                              <span className="font-semibold shrink-0">
                                {formatTaka(Number(entry.value))}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="plainline"
                  wrapperStyle={{ fontSize: '11px', paddingBottom: '12px' }}
                />

                {/* Team Total line */}
                <Line
                  type="monotone"
                  dataKey="total"
                  name="টিম মোট (Team Total)"
                  stroke="#0F172A"
                  strokeWidth={2.5}
                  strokeDasharray="4 4"
                  dot={false}
                />

                {/* Individual Employee Lines */}
                {employeeNames.map((name, idx) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    name={name}
                    stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                    strokeWidth={1.8}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 2-Column Responsive Grid for Chart 4 & 5 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ========================================================= */}
        {/* 4. Bar Chart: Ad Spend vs Budget per Campaign */}
        {/* ========================================================= */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Megaphone className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  ৪. ক্যাম্পেইন বাজেট বনাম খরচ (Ad Spend vs Budget)
                </h3>
                <p className="text-[11px] text-slate-500">
                  নির্ধারিত বাজেট (নীল) বনাম খরচকৃত বিজ্ঞাপন ব্যয় (লাল/গোলাপী)
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">
              ক্যাম্পেইন বার
            </span>
          </div>

          <div className="w-full min-w-0 h-72 sm:h-80 overflow-hidden">
            {!hasCampaignData ? (
              <EmptyChartState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={campaignBudgets}
                  margin={{ top: 15, right: 15, left: -10, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="name"
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis
                    stroke="#64748B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => (val >= 1000 ? `${val / 1000}k` : `${val}`)}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item = payload[0].payload as CampaignBudgetItem;
                      return (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs">
                          <p className="font-bold text-slate-900 mb-1">{item.name}</p>
                          <span className="inline-block text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-sm mb-2">
                            {item.channelBn}
                          </span>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-4 text-slate-600">
                              <span className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500"></span>
                                বাজেট:
                              </span>
                              <span className="font-semibold text-slate-800">
                                {formatTaka(item.budget)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-slate-600">
                              <span className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                                খরচ:
                              </span>
                              <span className="font-semibold text-rose-700">
                                {formatTaka(item.spend)}
                              </span>
                            </div>
                            <div className="pt-1 mt-1 border-t border-slate-100 flex items-center justify-between font-bold">
                              <span>ব্যবহার হার:</span>
                              <span className={item.usagePercent > 100 ? 'text-rose-600' : 'text-emerald-600'}>
                                {toBengaliDigits(item.usagePercent)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                  />
                  <Bar
                    dataKey="budget"
                    name="বাজেট (Budget)"
                    fill="#6366F1"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="spend"
                    name="বিজ্ঞাপন খরচ (Spend)"
                    fill="#F43F5E"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* 5. Pie Chart: Lead Sources Distribution */}
        {/* ========================================================= */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Users2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  ৫. লিড উৎস বণ্টন (Lead Sources Distribution)
                </h3>
                <p className="text-[11px] text-slate-500">
                  বিভিন্ন ডিজিটাল মার্কেটিং চ্যানেল থেকে সংগৃহীত ক্রেতার উৎস
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
              উৎস চার্ট
            </span>
          </div>

          <div className="w-full min-w-0 h-72 sm:h-80 overflow-hidden">
            {!hasLeadSourceData ? (
              <EmptyChartState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item = payload[0].payload as LeadSourceItem;
                      return (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs">
                          <p className="font-bold text-slate-900">{item.name}</p>
                          <p className="text-slate-600 mt-1">
                            মোট লিড: <strong className="text-slate-800">{toBengaliDigits(item.count)} জন</strong>
                          </p>
                          <p className="text-slate-600">
                            শতকরা হার: <strong className="text-amber-700">{toBengaliDigits(item.percent)}%</strong>
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    iconType="circle"
                    formatter={(value: string) => {
                      const item = leadSources.find((l) => l.name === value);
                      return (
                        <span className="text-[11px] text-slate-700 font-medium">
                          {value} ({item?.percent ? toBengaliDigits(item.percent) : '০'}%)
                        </span>
                      );
                    }}
                  />
                  <Pie
                    data={leadSources}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={45}
                    outerRadius={85}
                    paddingAngle={3}
                    label={({ percent }: { percent?: number }) =>
                      percent && percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                    }
                    labelLine={false}
                  >
                    {leadSources.map((_, index) => (
                      <Cell
                        key={`cell-lead-${index}`}
                        fill={PIE_COLORS[(index + 2) % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
