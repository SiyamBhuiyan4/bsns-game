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
import EmptyState from '@/components/ui/EmptyState';

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

  const pctBadge = (percentage: number, steps: 'four' | 'three' = 'four') =>
    percentage >= 100
      ? 'badge-green'
      : steps === 'four'
      ? percentage >= 70
        ? 'badge-blue'
        : percentage >= 40
        ? 'badge-amber'
        : 'badge-red'
      : percentage >= 50
      ? 'badge-blue'
      : 'badge-amber';

  const openOnKey = (e: React.KeyboardEvent, open: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  };

  return (
    <section className="space-y-4">
      {/* Section header with filters & search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-slate-900">
            <BarChart3 className="h-4 w-4 text-slate-400" />
            {L('সেকশন ওভারভিউ ও অগ্রগতি', 'Section Overview & Progress')}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {L(
              'প্রতিটি সেকশনের সার্বিক কাজ, লক্ষ্যমাত্রা এবং কর্মীভিত্তিক বিস্তারিত তথ্য',
              'Review performance, target progress, and date-by-date employee history per section'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="segmented max-w-full flex-wrap" role="group">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              data-active={filterType === 'all'}
              aria-pressed={filterType === 'all'}
            >
              {L('সকল মূল মেট্রিক্স', 'All')} <span className="tabular-nums text-slate-400">{formatNum(sectionsOverview.length)}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType('core')}
              data-active={filterType === 'core'}
              aria-pressed={filterType === 'core'}
            >
              {L('কোর সেকশন', 'Core')} <span className="tabular-nums text-slate-400">{formatNum(sectionsOverview.length)}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType('groups')}
              data-active={filterType === 'groups'}
              aria-pressed={filterType === 'groups'}
            >
              {L('সাব-গ্রুপসমূহ', 'Sub-Groups')} <span className="tabular-nums text-slate-400">{formatNum(groupSectionsOverview.length)}</span>
            </button>
          </div>

          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label={
                filterType === 'groups'
                  ? L('সাব-গ্রুপ খুঁজুন...', 'Search sub-group...')
                  : L('সেকশন খুঁজুন...', 'Search section...')
              }
              placeholder={
                filterType === 'groups'
                  ? L('সাব-গ্রুপ খুঁজুন...', 'Search sub-group...')
                  : L('সেকশন খুঁজুন...', 'Search section...')
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-sm pl-8"
            />
          </div>
        </div>
      </div>

      {/* Grid of section cards */}
      {totalVisibleCount === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Layers className="h-5 w-5" />}
            title={L('কোনো সেকশন পাওয়া যায়নি', 'No matching section found')}
            description={L(
              'অনুসন্ধান শব্দ পরিবর্তন করে পুনরায় চেষ্টা করুন।',
              'Try adjusting your search query or filter selection.'
            )}
          />
        </div>
      ) : (
        <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* 1. Core performance sections */}
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
            const open = () => setSelectedSection({ type: 'standard', section: sec });

            return (
              <div
                key={sec.key}
                role="button"
                tabIndex={0}
                onClick={open}
                onKeyDown={(e) => openOnKey(e, open)}
                className="card group relative flex cursor-pointer flex-col justify-between p-5"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${styles.bgLight} ${styles.textColor} ${styles.ringColor}`}
                    >
                      {renderSectionIcon(sec.key)}
                    </div>
                    <h3 className="min-w-0 truncate text-sm font-semibold text-slate-900">
                      {title}
                    </h3>
                  </div>

                  <div className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                    {formatValue(sec)}
                  </div>

                  <div className="mt-3 border-t border-slate-100 pt-3">
                    {hasTarget ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-slate-500">
                            {L('টার্গেট:', 'Target:')}{' '}
                            <span className="font-medium text-slate-800 tabular-nums">
                              {sec.isCurrency || sec.key === 'SALES_AMOUNT' || sec.key === 'PROFIT_AMOUNT'
                                ? formatMoney(sec.totalTarget)
                                : `${formatNum(sec.totalTarget)} ${unit}`}
                            </span>
                          </span>
                          <span
                            className={`badge ${pctBadge(percentage)} tabular-nums`}
                            title={L('দায়িত্বপ্রাপ্ত কর্মীদের গড় লক্ষ্য পূরণ', 'Average achievement of assigned employees')}
                          >
                            {formatDigits(percentage)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-brand-600 transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">{L('কোনো নির্দিষ্ট টার্গেট নেই', 'No fixed target')}</p>
                    )}
                  </div>

                  {/* Sub-groups embedded in the POSTS_DONE card */}
                  {sec.key === 'POSTS_DONE' && groupSectionsOverview.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">{L('অন্তর্ভুক্ত সাব-গ্রুপসমূহ:', 'Included Sub-Groups:')}</span>
                        <span className="font-medium text-slate-700 tabular-nums">
                          {formatNum(groupSectionsOverview.length)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {groupSectionsOverview.slice(0, 3).map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSection({ type: 'group', section: g });
                            }}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100"
                            title={L('ক্লিক করে এই সাব-গ্রুপের লিঙ্ক ও কাজ দেখুন', 'Click to view links and activity in this sub-group')}
                          >
                            <span className="max-w-[85px] truncate">{g.name}</span>
                            <span className="text-slate-400 tabular-nums">
                              {formatNum(g.completedLinksCount)}/{formatNum(g.totalLinks)}
                            </span>
                          </button>
                        ))}
                        {groupSectionsOverview.length > 3 && (
                          <span className="self-center pl-0.5 text-[11px] text-slate-400">
                            +{formatNum(groupSectionsOverview.length - 3)} {L('আরও', 'more')}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      <span className="font-medium text-slate-800 tabular-nums">
                        {formatNum(sec.assignedEmployeesCount || sec.activeEmployeesCount)}
                      </span>{' '}
                      {L('জন কর্মী দায়িত্বপ্রাপ্ত', 'assigned')}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 font-medium text-slate-500 transition-colors group-hover:text-brand-700">
                    {L('বিস্তারিত দেখুন', 'View Details')}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            );
          })}

          {/* 2. Group link sections (only in the main grid when the Groups filter is chosen) */}
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
              const open = () => setSelectedSection({ type: 'group', section: groupSec });

              return (
                <div
                  key={groupSec.id}
                  role="button"
                  tabIndex={0}
                  onClick={open}
                  onKeyDown={(e) => openOnKey(e, open)}
                  className="card group relative flex cursor-pointer flex-col justify-between p-5"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${styles.bgLight} ${styles.textColor} ${styles.ringColor}`}
                      >
                        <Layers className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-slate-900">{groupSec.name}</h3>
                        <p className="text-xs text-slate-500">{L('গ্রুপ লিঙ্ক পোস্টিং', 'Group Link Posting')}</p>
                      </div>
                    </div>

                    <div className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                      {formatNum(completed)}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        / {formatNum(groupSec.totalLinks)} {L('টি লিঙ্ক', 'links')}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">{L('সম্পন্নের হার:', 'Completed:')}</span>
                        <span className={`badge ${pctBadge(percentage, 'three')} tabular-nums`}>
                          {formatDigits(percentage)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand-600 transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        <span className="font-medium text-slate-800 tabular-nums">
                          {formatNum(uniqueContributors)}
                        </span>{' '}
                        {L('কর্মী কাজ করেছেন', 'active')}
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1 font-medium text-slate-500 transition-colors group-hover:text-brand-700">
                      {L('বিস্তারিত দেখুন', 'View Details')}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Collapsible sub-groups tray in the All view */}
      {filterType === 'all' && groupSectionsOverview.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="min-w-0">
              <h3 className="card-title flex items-center gap-2">
                {L('গ্রুপ লিঙ্ক পোস্টিং এর সাব-গ্রুপসমূহ', 'Group Link Posting - Sub-Groups')}
                <span className="badge badge-gray tabular-nums">{formatNum(groupSectionsOverview.length)}</span>
              </h3>
              <p className="card-subtitle mt-0.5">
                {L(
                  'সকল নির্দিষ্ট সাব-গ্রুপের লিঙ্ক সম্পন্ন করার হার ও হিস্ট্রি',
                  'Link completion rates and employee history per sub-group'
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsSubgroupsExpanded(!isSubgroupsExpanded)}
              aria-expanded={isSubgroupsExpanded}
              className="btn btn-secondary btn-sm"
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
            <div className="stagger card-body grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groupSectionsOverview.map((groupSec) => {
                const total = groupSec.totalLinks || 1;
                const completed = groupSec.completedLinksCount || 0;
                const percentage = Math.min(100, Math.round((completed / total) * 100));
                const uniqueContributors = new Set(
                  groupSec.completionsHistory.map((c) => c.employeeId)
                ).size;
                const open = () => setSelectedSection({ type: 'group', section: groupSec });

                return (
                  <div
                    key={groupSec.id}
                    role="button"
                    tabIndex={0}
                    onClick={open}
                    onKeyDown={(e) => openOnKey(e, open)}
                    className="group flex cursor-pointer flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50/60"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="truncate text-sm font-medium text-slate-900">{groupSec.name}</h4>
                          <p className="text-xs text-slate-500">{L('সাব-গ্রুপ লিঙ্ক', 'Sub-Group Link')}</p>
                        </div>
                        <span className={`badge ${pctBadge(percentage, 'three')} shrink-0 tabular-nums`}>
                          {formatDigits(percentage)}%
                        </span>
                      </div>

                      <div className="mt-3 text-lg font-semibold text-slate-900 tabular-nums">
                        {formatNum(completed)}{' '}
                        <span className="text-xs font-normal text-slate-500">
                          / {formatNum(groupSec.totalLinks)} {L('টি লিঙ্ক', 'links')}
                        </span>
                      </div>

                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand-600 transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                      <span>
                        <span className="font-medium text-slate-700 tabular-nums">{formatNum(uniqueContributors)}</span>{' '}
                        {L('কর্মী', 'active')}
                      </span>
                      <span className="inline-flex items-center gap-0.5 font-medium transition-colors group-hover:text-brand-700">
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
