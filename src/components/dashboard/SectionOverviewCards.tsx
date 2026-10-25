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
  ORDERS_CONFIRMED: {
    bgLight: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    ringColor: 'ring-emerald-600/20',
    progressBarColor: 'bg-emerald-600',
  },
  MESSAGES_REPLIED: {
    bgLight: 'bg-violet-50',
    textColor: 'text-violet-700',
    borderColor: 'border-violet-200',
    ringColor: 'ring-violet-600/20',
    progressBarColor: 'bg-violet-600',
  },
  LEADS_COLLECTED: {
    bgLight: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    ringColor: 'ring-amber-600/20',
    progressBarColor: 'bg-amber-500',
  },
  SALES_AMOUNT: {
    bgLight: 'bg-brand-50',
    textColor: 'text-brand-800',
    borderColor: 'border-brand-200',
    ringColor: 'ring-brand-600/20',
    progressBarColor: 'bg-brand-600',
  },
  GROUP_DEFAULT: {
    bgLight: 'bg-indigo-50',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-200',
    ringColor: 'ring-indigo-600/20',
    progressBarColor: 'bg-indigo-600',
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
      case 'ORDERS_CONFIRMED':
        return <ShoppingBag className={iconClass} />;
      case 'MESSAGES_REPLIED':
        return <MessageSquare className={iconClass} />;
      case 'LEADS_COLLECTED':
        return <UserPlus className={iconClass} />;
      case 'SALES_AMOUNT':
        return <DollarSign className={iconClass} />;
      default:
        return <Layers className={iconClass} />;
    }
  };

  // Format value with unit or taka
  const formatValue = (sec: SectionOverviewItem) => {
    if (sec.key === 'SALES_AMOUNT') {
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

  const totalVisibleCount = filteredCoreSections.length + filteredGroupSections.length;

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
              {formatNum(sectionsOverview.length + groupSectionsOverview.length)}{' '}
              {L('টি সেকশন', 'sections')}
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
              {L('সকল সেকশন', 'All')} ({formatNum(sectionsOverview.length + groupSectionsOverview.length)})
            </button>
            <button
              onClick={() => setFilterType('core')}
              data-active={filterType === 'core'}
            >
              {L('মূল মেট্রিক্স', 'Core')} ({formatNum(sectionsOverview.length)})
            </button>
            <button
              onClick={() => setFilterType('groups')}
              data-active={filterType === 'groups'}
            >
              {L('গ্রুপ লিঙ্ক', 'Groups')} ({formatNum(groupSectionsOverview.length)})
            </button>
          </div>

          {/* Search box */}
          <div className="relative w-44 sm:w-52">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={L('সেকশন খুঁজুন...', 'Search section...')}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Core Performance Sections */}
          {filteredCoreSections.map((sec) => {
            const styles = SECTION_STYLES[sec.key] || SECTION_STYLES.GROUP_DEFAULT;
            const hasTarget = sec.totalTarget > 0;
            const percentage = hasTarget
              ? Math.min(100, Math.round((sec.totalAchieved / sec.totalTarget) * 100))
              : 0;

            const unit = lang === 'bn' ? sec.unitBn : sec.unitEn;
            const title = lang === 'bn' ? sec.labelBn : sec.labelEn;

            return (
              <div
                key={sec.key}
                onClick={() => setSelectedSection({ type: 'standard', section: sec })}
                className="card group relative flex flex-col justify-between p-4.5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300/90"
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
                              {sec.key === 'SALES_AMOUNT'
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
                    ) : (
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{L('কোনো নির্দিষ্ট টার্গেট নেই', 'No fixed target')}</span>
                        <span className="text-[11px] italic text-slate-400">
                          {L('স্বাভাবিক এন্ট্রি', 'Standard')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action Strip */}
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      <strong className="text-slate-800 font-semibold tabular-nums">
                        {formatNum(sec.activeEmployeesCount)}
                      </strong>{' '}
                      {L('জন সক্রিয়', 'active')}
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

          {/* 2. Group Link Sections */}
          {filteredGroupSections.map((groupSec) => {
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
                className="card group relative flex flex-col justify-between p-4.5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300/90"
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
                        <h3 className="font-semibold text-slate-900 truncate group-hover:text-indigo-700 transition-colors">
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

                  <span className="inline-flex items-center gap-1 font-medium text-indigo-600 group-hover:text-indigo-800 transition-colors">
                    {L('বিস্তারিত দেখুন', 'View Details')}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Section Deep-Dive Modal */}
      <SectionDetailModal
        isOpen={Boolean(selectedSection)}
        onClose={() => setSelectedSection(null)}
        selected={selectedSection}
      />
    </section>
  );
}
