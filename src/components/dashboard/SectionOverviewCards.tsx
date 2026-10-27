'use client';

import React, { useState, useMemo } from 'react';
import {
  Share2,
  ShoppingBag,
  MessageSquare,
  UserPlus,
  DollarSign,
  Layers,
  Users,
  ArrowRight,
  Search,
  BarChart3,
  TrendingUp,
  ChevronDown,
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import {
  SectionOverviewItem,
  GroupSectionOverviewItem,
  SectionOverviewKey,
} from '@/lib/dashboard';
import { toBengaliDigits } from '@/lib/formatter';
import SectionDetailModal, { DetailSectionData } from './SectionDetailModal';

export interface SectionOverviewCardsProps {
  sectionsOverview?: SectionOverviewItem[];
  groupSectionsOverview?: GroupSectionOverviewItem[];
}

interface SectionStyleConfig {
  bgLight: string;
  textColor: string;
  borderColor: string;
  ringColor: string;
  progressBarColor: string;
}

const SECTION_STYLES: Record<string, SectionStyleConfig> = {
  POSTS_DONE: {
    bgLight: 'bg-sky-50',
    textColor: 'text-sky-700',
    borderColor: 'border-sky-200',
    ringColor: 'ring-sky-600/20',
    progressBarColor: 'bg-sky-600',
  },
  NEW_LEADS: {
    bgLight: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    ringColor: 'ring-amber-600/20',
    progressBarColor: 'bg-amber-500',
  },
  CONFIRMED_ORDERS: {
    bgLight: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    ringColor: 'ring-emerald-600/20',
    progressBarColor: 'bg-emerald-600',
  },
  ORDERS_CONFIRMED: {
    bgLight: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    ringColor: 'ring-emerald-600/20',
    progressBarColor: 'bg-emerald-600',
  },
  SALES_AMOUNT: {
    bgLight: 'bg-brand-50',
    textColor: 'text-brand-800',
    borderColor: 'border-brand-200',
    ringColor: 'ring-brand-600/20',
    progressBarColor: 'bg-brand-600',
  },
  NEW_CLIENTS: {
    bgLight: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    ringColor: 'ring-emerald-600/20',
    progressBarColor: 'bg-emerald-600',
  },
  FOLLOWUPS_DONE: {
    bgLight: 'bg-violet-50',
    textColor: 'text-violet-700',
    borderColor: 'border-violet-200',
    ringColor: 'ring-violet-600/20',
    progressBarColor: 'bg-violet-600',
  },
  MESSAGES_REPLIED: {
    bgLight: 'bg-violet-50',
    textColor: 'text-violet-700',
    borderColor: 'border-violet-200',
    ringColor: 'ring-violet-600/20',
    progressBarColor: 'bg-violet-600',
  },
  PROFIT_AMOUNT: {
    bgLight: 'bg-violet-50',
    textColor: 'text-violet-800',
    borderColor: 'border-violet-200',
    ringColor: 'ring-violet-600/20',
    progressBarColor: 'bg-violet-600',
  },
  GROUP_DEFAULT: {
    bgLight: 'bg-sky-50',
    textColor: 'text-sky-700',
    borderColor: 'border-sky-200',
    ringColor: 'ring-sky-600/20',
    progressBarColor: 'bg-sky-600',
  },
};

export default function SectionOverviewCards({
  sectionsOverview = [],
  groupSectionsOverview = [],
}: SectionOverviewCardsProps) {
  const { lang, digitStyle, formatNum, formatMoney } = useLanguage();
  const [selectedSection, setSelectedSection] = useState<DetailSectionData | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'core' | 'groups'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubgroupsExpanded, setIsSubgroupsExpanded] = useState(false);

  const postsDoneSection = useMemo(() => {
    return sectionsOverview.find((s) => s.key === 'POSTS_DONE');
  }, [sectionsOverview]);

  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);

  const formatDigits = (val: string | number) => {
    return digitStyle === 'bn' ? toBengaliDigits(val) : String(val);
  };

  // Helper to render icon for section
  const renderSectionIcon = (key?: SectionOverviewKey) => {
    const iconClass = 'h-5 w-5';
    switch (key) {
      case 'POSTS_DONE':
        return <Share2 className={iconClass} />;
      case 'NEW_LEADS':
        return <UserPlus className={iconClass} />;
      case 'CONFIRMED_ORDERS':
        return <ShoppingBag className={iconClass} />;
      case 'SALES_AMOUNT':
        return <DollarSign className={iconClass} />;
      case 'NEW_CLIENTS':
        return <Users className={iconClass} />;
      case 'FOLLOWUPS_DONE':
        return <MessageSquare className={iconClass} />;
      case 'PROFIT_AMOUNT':
        return <TrendingUp className={iconClass} />;
      default:
        return <Layers className={iconClass} />;
    }
  };

  // Format value with unit or taka
  const formatValue = (sec: SectionOverviewItem) => {
    if (sec.isCurrency || sec.key === 'SALES_AMOUNT' || sec.key === 'PROFIT_AMOUNT') {
      return formatMoney(sec.totalAchieved);
    }
    const unit = lang === 'bn' ? sec.unitBn : sec.unitEn;
    return (
      <>
        {formatNum(sec.totalAchieved)}{' '}
        <span className="text-xs font-normal text-slate-500">{unit}</span>
      </>
    );
  };

  // Filtered lists
  const filteredCoreSections = useMemo(() => {
    if (filterType === 'groups') return [];
    if (!searchQuery.trim()) return sectionsOverview;
    const q = searchQuery.toLowerCase();
    return sectionsOverview.filter(
      (sec) =>
        sec.labelBn.toLowerCase().includes(q) ||
        sec.labelEn.toLowerCase().includes(q) ||
        sec.key.toLowerCase().includes(q)
    );
  }, [sectionsOverview, filterType, searchQuery]);

  const filteredGroupSections = useMemo(() => {
    if (filterType === 'core') return [];
    if (!searchQuery.trim()) return groupSectionsOverview;
    const q = searchQuery.toLowerCase();
    return groupSectionsOverview.filter((sec) =>
      sec.name.toLowerCase().includes(q)
    );
  }, [groupSectionsOverview, filterType, searchQuery]);

  const totalVisibleCount =
    filterType === 'groups'
      ? filteredGroupSections.length
      : filteredCoreSections.length;

  return (
    <section className="space-y-4">
      {/* Component Header with Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-brand-600" />
              {L('সেকশন ওভারভিউ ও অগ্রগতি', 'Section Overview & Progress')}
            </h2>
            <span className="badge badge-green font-mono text-[11px]">
              {formatNum(sectionsOverview.length)} {L('টি কোর সেকশন', 'core metrics')}
              {groupSectionsOverview.length > 0 &&
                ` • ${formatNum(groupSectionsOverview.length)} ${L('টি সাব-গ্রুপ', 'sub-groups')}`}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {L(
              'প্রতিটি সেকশনের সার্বিক কাজ, লক্ষ্যমাত্রা এবং কর্মীভিত্তিক বিস্তারিত তথ্য',
              'Review performance, target progress, and date-by-date employee history per section'
            )}
          </p>
        </div>

        {/* Filter segment and search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented view controls */}
          <div className="segmented">
            <button
              onClick={() => setFilterType('all')}
              data-active={filterType === 'all'}
            >
              {L('সকল মূল মেট্রিক্স', 'All')} ({formatNum(sectionsOverview.length)})
            </button>
            <button
              onClick={() => setFilterType('core')}
              data-active={filterType === 'core'}
            >
              {L('কোর সেকশন', 'Core')} ({formatNum(sectionsOverview.length)})
            </button>
            <button
              onClick={() => setFilterType('groups')}
              data-active={filterType === 'groups'}
            >
              {L('সাব-গ্রুপসমূহ', 'Sub-Groups')} ({formatNum(groupSectionsOverview.length)})
            </button>
          </div>

          {/* Search box */}
          <div className="relative w-44 sm:w-52">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={
                filterType === 'groups'
                  ? L('সাব-গ্রুপ খুঁজুন...', 'Search sub-group...')
                  : L('সেকশন খুঁজুন...', 'Search section...')
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-8 py-1 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Grid of Section Cards */}
      {totalVisibleCount === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl border border-dashed border-slate-200">
          <Layers className="h-9 w-9 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-700">
            {L('কোনো সেকশন পাওয়া যায়নি', 'No matching section found')}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {L(
              'অনুসন্ধান শব্দ পরিবর্তন করে পুনরায় চেষ্টা করুন।',
              'Try adjusting your search query or filter selection.'
            )}
          </p>
        </div>
      ) : (
        <div className="stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Core Performance Sections */}
          {filteredCoreSections.map((sec) => {
            const styles = SECTION_STYLES[sec.key] || SECTION_STYLES.GROUP_DEFAULT;
            const hasTarget = sec.totalTarget > 0;
            const percentage = sec.averagePercentage !== undefined
              ? sec.averagePercentage
              : hasTarget
              ? Math.min(100, Math.round((sec.totalAchieved / sec.totalTarget) * 100))
              : 0;

            const unit = lang === 'bn' ? sec.unitBn : sec.unitEn;
            const title = lang === 'bn' ? sec.labelBn : sec.labelEn;

            return (
              <div
                key={sec.key}
                onClick={() => setSelectedSection({ type: 'standard', section: sec })}
                className="card hover-lift press group relative flex flex-col justify-between p-4.5 cursor-pointer hover:border-slate-300/90"
              >
                <div>
                  {/* Top Header Row: Icon, Title, and Badge */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${styles.bgLight} ${styles.textColor} ${styles.borderColor} shadow-xs transition-transform group-hover:scale-105`}
                      >
                        {renderSectionIcon(sec.key)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate group-hover:text-brand-700 transition-colors">
                          {title}
                        </h3>
                        <p className="text-[11px] text-slate-400 truncate">
                          {sec.key}
                        </p>
                      </div>
                    </div>

                    <span className="badge badge-gray shrink-0 text-[10px]">
                      {L('কোর', 'Core')}
                    </span>
                  </div>

                  {/* Stat Number */}
                  <div className="mt-4">
                    <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                      {formatValue(sec)}
                    </div>
                  </div>

                  {/* Target and Progress Bar */}
                  <div className="mt-3 pt-3 border-t border-slate-100/90">
                    {hasTarget ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">
                            {L('টার্গেট:', 'Target:')}{' '}
                            <span className="text-slate-800 font-semibold tabular-nums">
                              {sec.isCurrency || sec.key === 'SALES_AMOUNT' || sec.key === 'PROFIT_AMOUNT'
                                ? formatMoney(sec.totalTarget)
                                : `${formatNum(sec.totalTarget)} ${unit}`}
                            </span>
                          </span>
                          <span
                            className={`badge ${
                              percentage >= 100
                                ? 'badge-green'
                                : percentage >= 70
                                ? 'badge-blue'
                                : percentage >= 40
                                ? 'badge-amber'
                                : 'badge-red'
                            } font-semibold tabular-nums`}
                            title={L('দায়িত্বপ্রাপ্ত কর্মীদের গড় লক্ষ্য পূরণ', 'Average achievement of assigned employees')}
                          >
                            {formatDigits(percentage)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${styles.progressBarColor}`}
                            style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>{L('গড় লক্ষ্য পূরণ:', 'Avg Progress:')}</span>
                          <span className="font-semibold text-slate-600">{formatDigits(percentage)}%</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{L('কোনো নির্দিষ্ট টার্গেট নেই', 'No fixed target')}</span>
                        <span className="text-[11px] italic text-slate-400">
                          {L('স্বাভাবিক এন্ট্রি', 'Standard')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Embedded Sub-Groups in POSTS_DONE card */}
                  {sec.key === 'POSTS_DONE' && groupSectionsOverview.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5 text-violet-600" />
                          <span>{L('অন্তর্ভুক্ত সাব-গ্রুপসমূহ:', 'Included Sub-Groups:')}</span>
                        </span>
                        <span className="badge badge-violet text-[10px] font-semibold">
                          {formatNum(groupSectionsOverview.length)} {L('টি সাব-গ্রুপ', 'sub-groups')}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {groupSectionsOverview.slice(0, 3).map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSection({ type: 'group', section: g });
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-violet-50/80 hover:bg-violet-100 text-violet-700 px-2 py-0.5 text-[11px] font-medium transition-colors border border-violet-200/60"
                            title={L('ক্লিক করে এই সাব-গ্রুপের লিঙ্ক ও কাজ দেখুন', 'Click to view links and activity in this sub-group')}
                          >
                            <span className="truncate max-w-[85px]">{g.name}</span>
                            <span className="text-[10px] text-violet-500 font-semibold tabular-nums">
                              ({formatNum(g.completedLinksCount)}/{formatNum(g.totalLinks)})
                            </span>
                          </button>
                        ))}
                        {groupSectionsOverview.length > 3 && (
                          <span className="text-[11px] text-slate-400 self-center pl-0.5 font-medium">
                            +{formatNum(groupSectionsOverview.length - 3)} {L('আরও', 'more')}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Action Strip */}
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      <strong className="text-slate-800 font-semibold tabular-nums">
                        {formatNum(sec.assignedEmployeesCount || sec.activeEmployeesCount)}
                      </strong>{' '}
                      {L('জন কর্মী দায়িত্বপ্রাপ্ত', 'assigned')}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 font-medium text-brand-700 group-hover:text-brand-800 transition-colors">
                    {L('বিস্তারিত দেখুন', 'View Details')}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            );
          })}

          {/* 2. Group Link Sections (Only shown in main grid when Groups filter is chosen) */}
          {filterType === 'groups' &&
            filteredGroupSections.map((groupSec) => {
              const styles = SECTION_STYLES.GROUP_DEFAULT;
              const total = groupSec.totalLinks || 1;
              const completed = groupSec.completedLinksCount || 0;
              const percentage = Math.min(100, Math.round((completed / total) * 100));

              // Unique employees who completed links in this group
              const uniqueContributors = new Set(
                groupSec.completionsHistory.map((c) => c.employeeId)
              ).size;

              return (
                <div
                  key={groupSec.id}
                  onClick={() =>
                    setSelectedSection({ type: 'group', section: groupSec })
                  }
                  className="card hover-lift press group relative flex flex-col justify-between p-4.5 cursor-pointer hover:border-slate-300/90"
                >
                  <div>
                    {/* Top Header Row */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${styles.bgLight} ${styles.textColor} ${styles.borderColor} shadow-xs transition-transform group-hover:scale-105`}
                        >
                          <Layers className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-900 truncate group-hover:text-violet-700 transition-colors">
                            {groupSec.name}
                          </h3>
                          <p className="text-[11px] text-slate-400">
                            {L('গ্রুপ লিঙ্ক পোস্টিং', 'Group Link Posting')}
                          </p>
                        </div>
                      </div>

                      <span className="badge badge-violet shrink-0 text-[10px]">
                        {L('গ্রুপ', 'Group')}
                      </span>
                    </div>

                    {/* Stat Number */}
                    <div className="mt-4">
                      <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                        {formatNum(completed)}{' '}
                        <span className="text-xs font-normal text-slate-500">
                          / {formatNum(groupSec.totalLinks)} {L('টি লিঙ্ক', 'links')}
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3 pt-3 border-t border-slate-100/90 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">
                          {L('সম্পন্নের হার:', 'Completed:')}
                        </span>
                        <span
                          className={`badge ${
                            percentage >= 100
                              ? 'badge-green'
                              : percentage >= 50
                              ? 'badge-blue'
                              : 'badge-amber'
                          } font-semibold tabular-nums`}
                        >
                          {formatDigits(percentage)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${styles.progressBarColor}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer Action Strip */}
                  <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        <strong className="text-slate-800 font-semibold tabular-nums">
                          {formatNum(uniqueContributors)}
                        </strong>{' '}
                        {L('কর্মী কাজ করেছেন', 'active')}
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1 font-medium text-violet-600 group-hover:text-violet-800 transition-colors">
                      {L('বিস্তারিত দেখুন', 'View Details')}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Collapsible Sub-Groups Tray in All View */}
      {filterType === 'all' && groupSectionsOverview.length > 0 && (
        <div className="rounded-2xl border border-violet-100 bg-linear-to-r from-violet-50/40 via-sky-50/20 to-white p-4 transition-all">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                <Layers className="h-4.5 w-4.5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>{L('গ্রুপ লিঙ্ক পোস্টিং এর সাব-গ্রুপসমূহ', 'Group Link Posting - Sub-Groups')}</span>
                  <span className="badge badge-violet text-[10px]">
                    {formatNum(groupSectionsOverview.length)} {L('টি সাব-গ্রুপ', 'sub-groups')}
                  </span>
                </h4>
                <p className="text-xs text-slate-500">
                  {L(
                    'সকল নির্দিষ্ট সাব-গ্রুপের লিঙ্ক সম্পন্ন করার হার ও হিস্ট্রি',
                    'Link completion rates and employee history per sub-group'
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSubgroupsExpanded(!isSubgroupsExpanded)}
              className="btn btn-secondary btn-sm text-xs inline-flex items-center gap-1.5 font-medium text-violet-700 hover:text-violet-800"
            >
              <span>
                {isSubgroupsExpanded
                  ? L('সাব-গ্রুপ লুকিয়ে রাখুন', 'Hide Sub-Groups')
                  : L('সকল সাব-গ্রুপ দেখুন', 'View All Sub-Groups')}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  isSubgroupsExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>

          {isSubgroupsExpanded && (
            <div className="stagger animate-fade-in mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-3.5 border-t border-violet-100/70">
              {groupSectionsOverview.map((groupSec) => {
                const styles = SECTION_STYLES.GROUP_DEFAULT;
                const total = groupSec.totalLinks || 1;
                const completed = groupSec.completedLinksCount || 0;
                const percentage = Math.min(100, Math.round((completed / total) * 100));
                const uniqueContributors = new Set(
                  groupSec.completionsHistory.map((c) => c.employeeId)
                ).size;

                return (
                  <div
                    key={groupSec.id}
                    onClick={() =>
                      setSelectedSection({ type: 'group', section: groupSec })
                    }
                    className="card hover-lift press group relative flex flex-col justify-between p-4 cursor-pointer hover:border-violet-300 bg-white"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${styles.bgLight} ${styles.textColor} ${styles.borderColor} shadow-xs group-hover:scale-105 transition-transform`}
                          >
                            <Layers className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <h5 className="font-semibold text-slate-900 truncate text-xs group-hover:text-violet-700 transition-colors">
                              {groupSec.name}
                            </h5>
                            <p className="text-[10px] text-slate-400">
                              {L('সাব-গ্রুপ লিঙ্ক', 'Sub-Group Link')}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`badge ${
                            percentage >= 100
                              ? 'badge-green'
                              : percentage >= 50
                              ? 'badge-blue'
                              : 'badge-amber'
                          } font-semibold tabular-nums text-[10px]`}
                        >
                          {formatDigits(percentage)}%
                        </span>
                      </div>

                      <div className="mt-3">
                        <div className="text-lg font-bold text-slate-900 tabular-nums">
                          {formatNum(completed)}{' '}
                          <span className="text-xs font-normal text-slate-500">
                            / {formatNum(groupSec.totalLinks)} {L('টি লিঙ্ক', 'links')}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-violet-600 transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] flex items-center justify-between text-slate-500">
                      <span>
                        <strong>{formatNum(uniqueContributors)}</strong> {L('কর্মী', 'active')}
                      </span>
                      <span className="font-medium text-violet-600 group-hover:text-violet-800 inline-flex items-center gap-0.5">
                        {L('বিস্তারিত', 'Details')}
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Section Deep-Dive Modal */}
      <SectionDetailModal
        isOpen={Boolean(selectedSection)}
        onClose={() => setSelectedSection(null)}
        selected={selectedSection}
        groupSectionsOverview={groupSectionsOverview}
        onSelectGroupSection={(groupSec) =>
          setSelectedSection({ type: 'group', section: groupSec })
        }
        onSelectStandardSection={(sec) =>
          setSelectedSection({ type: 'standard', section: sec })
        }
        standardGroupSection={postsDoneSection}
      />
    </section>
  );
}
