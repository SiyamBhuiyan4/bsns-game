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
import { BarChart3 } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';

interface Props {
  sectionTargets: SectionTargetChartItem[];
  teamScoreShare: TeamScoreShareItem[];
  dailyTeamTrend: DailyTeamTrendItem[];
  campaignBudgets: CampaignBudgetItem[];
  leadSources: LeadSourceItem[];
}

// Brand green first, then sky, amber, violet, slate.
const PALETTE = ['#059669', '#0EA5E9', '#F59E0B', '#8B5CF6', '#64748B'];
const PIE_COLORS = PALETTE;
const LINE_COLORS = PALETTE;

// CSS variables, so the charts follow the light/dark theme.
const GRID = 'var(--color-slate-200)';
const AXIS = 'var(--color-slate-400)';
const TARGET = '#CBD5E1';

function EmptyChartState({ message = 'এই সময়ে কোনো তথ্য নেই' }: { message?: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 p-6 text-center">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <BarChart3 className="h-5 w-5" />
      </div>
      <p className="text-sm text-slate-500">{message}</p>
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
  const { L } = useLanguage();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`card h-80 p-5 animate-pulse ${
              i === 3 ? 'lg:col-span-2' : ''
            }`}
          >
            <div className="mb-4 h-4 w-40 rounded bg-slate-200" />
            <div className="h-60 rounded-lg bg-slate-100" />
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
    <div className="space-y-4">
      {/* 2-Column Responsive Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ========================================================= */}
        {/* 1. Bar Chart: Section Achieved vs Target */}
        {/* ========================================================= */}
        <div className="card flex min-w-0 flex-col">
          <div className="card-header">
            <div className="min-w-0">
              <h3 className="card-title">{L("সেকশন অনুযায়ী লক্ষ্য ও অর্জন")}</h3>
              <p className="card-subtitle">Target vs achieved, by section</p>
            </div>
          </div>

          <div className="h-72 w-full min-w-0 overflow-hidden p-4 sm:h-80 sm:p-5">
            {!hasSectionData ? (
              <EmptyChartState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sectionTargets}
                  margin={{ top: 15, right: 15, left: -10, bottom: 25 }}
                >
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis
                    dataKey="name"
                    stroke={AXIS}
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis
                    stroke={AXIS}
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
                        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-md">
                          <p className="font-bold text-slate-900 mb-1.5">{item.name}</p>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-4 text-slate-600">
                              <span className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-full bg-slate-300"></span>
                                {L("লক্ষ্য:")}
                              </span>
                              <span className="font-semibold text-slate-800">
                                {item.unit === '৳' ? formatTaka(item.target) : `${item.target.toLocaleString()} ${item.unit}`}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-slate-600">
                              <span className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-full bg-brand-600"></span>
                                {L("অর্জন:")}
                              </span>
                              <span className="font-semibold text-brand-700">
                                {item.unit === '৳' ? formatTaka(item.achieved) : `${item.achieved.toLocaleString()} ${item.unit}`}
                              </span>
                            </div>
                            <div className="pt-1 mt-1 border-t border-slate-100 flex items-center justify-between font-bold">
                              <span>{L("অর্জন হার:")}</span>
                              <span className={item.percent >= 100 ? 'text-brand-700' : 'text-slate-700'}>
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
                    name={L("লক্ষ্য")}
                    fill={TARGET}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="achieved"
                    name={L("অর্জন")}
                    fill={PALETTE[0]}
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
        <div className="card flex min-w-0 flex-col">
          <div className="card-header">
            <div className="min-w-0">
              <h3 className="card-title">{L("কর্মীদের স্কোর ভাগ")}</h3>
              <p className="card-subtitle">Score share by employee</p>
            </div>
          </div>

          <div className="h-72 w-full min-w-0 overflow-hidden p-4 sm:h-80 sm:p-5">
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
                        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-md">
                          <p className="font-bold text-slate-900">{item.name}</p>
                          <p className="text-slate-600 mt-1">
                            {L("মোট স্কোর:")} <strong className="text-slate-800">{toBengaliDigits(item.score)} {L("পয়েন্ট")}</strong>
                          </p>
                          <p className="text-slate-600">
                            {L("টিমে অবদান:")} <strong className="text-brand-700">{toBengaliDigits(item.percent)}%</strong>
                          </p>
                          {item.sales > 0 && (
                            <p className="text-slate-500 mt-1">
                              {L("বিক্রয়:")} {formatTaka(item.sales)}
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
                        <span className="text-[11px] text-slate-700 ">
                          {value} ({item?.percent ? toBengaliDigits(item.percent) : L('০')}%)
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
      <div className="card min-w-0">
        <div className="card-header">
            <div className="min-w-0">
              <h3 className="card-title">{L("কর্মীদের দৈনিক পারফরম্যান্স (৩০ দিন)")}</h3>
              <p className="card-subtitle">Daily score per employee, overall total</p>
            </div>
          </div>

        <div className="h-72 w-full min-w-0 overflow-hidden p-4 sm:h-80 sm:p-5">
          {!hasTrendData ? (
            <EmptyChartState />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={dailyTeamTrend}
                margin={{ top: 15, right: 20, left: -10, bottom: 20 }}
              >
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis
                  dataKey="date"
                  stroke={AXIS}
                  fontSize={10}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke={AXIS}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => (val >= 1000 ? `${val / 1000}k` : `${val}`)}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-md max-w-xs">
                        <p className="font-bold text-slate-900 mb-1.5 border-b border-slate-100 pb-1">
                          {L("তারিখ:")} {label}
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
                  name={L("টিম মোট")}
                  stroke="var(--color-slate-600)"
                  strokeWidth={2}
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ========================================================= */}
        {/* 4. Bar Chart: Ad Spend vs Budget per Campaign */}
        {/* ========================================================= */}
        <div className="card flex min-w-0 flex-col">
          <div className="card-header">
            <div className="min-w-0">
              <h3 className="card-title">{L("ক্যাম্পেইন বাজেট বনাম খরচ")}</h3>
              <p className="card-subtitle">Budget vs ad spend, per campaign</p>
            </div>
          </div>

          <div className="h-72 w-full min-w-0 overflow-hidden p-4 sm:h-80 sm:p-5">
            {!hasCampaignData ? (
              <EmptyChartState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={campaignBudgets}
                  margin={{ top: 15, right: 15, left: -10, bottom: 25 }}
                >
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis
                    dataKey="name"
                    stroke={AXIS}
                    fontSize={11}
                    tickLine={false}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis
                    stroke={AXIS}
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
                        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-md">
                          <p className="font-bold text-slate-900 mb-1">{item.name}</p>
                          <span className="badge badge-gray mb-2">
                            {item.channelBn}
                          </span>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-4 text-slate-600">
                              <span className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-full bg-sky-500"></span>
                                {L("বাজেট:")}
                              </span>
                              <span className="font-semibold text-slate-800">
                                {formatTaka(item.budget)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-slate-600">
                              <span className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                                {L("খরচ:")}
                              </span>
                              <span className="font-semibold text-slate-800">
                                {formatTaka(item.spend)}
                              </span>
                            </div>
                            <div className="pt-1 mt-1 border-t border-slate-100 flex items-center justify-between font-bold">
                              <span>{L("ব্যবহার হার:")}</span>
                              <span className={item.usagePercent > 100 ? 'text-rose-600' : 'text-brand-700'}>
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
                    name={L("বাজেট")}
                    fill={PALETTE[1]}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="spend"
                    name={L("খরচ")}
                    fill={PALETTE[2]}
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
        <div className="card flex min-w-0 flex-col">
          <div className="card-header">
            <div className="min-w-0">
              <h3 className="card-title">{L("লিড উৎস")}</h3>
              <p className="card-subtitle">Where leads came from</p>
            </div>
          </div>

          <div className="h-72 w-full min-w-0 overflow-hidden p-4 sm:h-80 sm:p-5">
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
                        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-md">
                          <p className="font-bold text-slate-900">{item.name}</p>
                          <p className="text-slate-600 mt-1">
                            {L("মোট লিড:")} <strong className="text-slate-800">{toBengaliDigits(item.count)} {L("জন")}</strong>
                          </p>
                          <p className="text-slate-600">
                            {L("শতকরা হার:")} <strong className="text-slate-800">{toBengaliDigits(item.percent)}%</strong>
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
                        <span className="text-[11px] text-slate-700 ">
                          {value} ({item?.percent ? toBengaliDigits(item.percent) : L('০')}%)
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
    </div>
  );
}
