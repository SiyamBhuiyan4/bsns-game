'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Search,
  Users,
  Target,
  Calendar,
  ExternalLink,
  Award,
  Clock,
  FileText,
  CheckCircle2,
  Share2,
  ShoppingBag,
  MessageSquare,
  UserPlus,
  DollarSign,
  Layers,
  ArrowUpDown,
  Download,
  TrendingUp,
  ArrowLeft,
  ArrowRight,
  MapPin,
  Phone,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import {
  SectionOverviewItem,
  GroupSectionOverviewItem,
} from '@/lib/dashboard';
import { toBengaliDigits } from '@/lib/formatter';

export type DetailSectionData =
  | { type: 'standard'; section: SectionOverviewItem }
  | { type: 'group'; section: GroupSectionOverviewItem };

interface SectionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selected: DetailSectionData | null;
  groupSectionsOverview?: GroupSectionOverviewItem[];
  onSelectGroupSection?: (groupSec: GroupSectionOverviewItem) => void;
  onSelectStandardSection?: (standardSec: SectionOverviewItem) => void;
  standardGroupSection?: SectionOverviewItem;
}

const AVATAR_COLORS = [
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-sky-100 text-sky-800 border-sky-200',
  'bg-indigo-100 text-indigo-800 border-indigo-200',
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-violet-100 text-violet-800 border-violet-200',
  'bg-rose-100 text-rose-800 border-rose-200',
  'bg-teal-100 text-teal-800 border-teal-200',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function SectionDetailModal({
  isOpen,
  onClose,
  selected,
  groupSectionsOverview = [],
  onSelectGroupSection,
  onSelectStandardSection,
  standardGroupSection,
}: SectionDetailModalProps) {
  const router = useRouter();
  const { lang, digitStyle, formatNum, formatMoney, L } = useLanguage();
  const [activeTab, setActiveTab] = useState<'employees' | 'subgroups' | 'history'>('employees');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [employeeFilter, setEmployeeFilter] = useState<'assigned' | 'all'>('assigned');

  // Customer Profile creation state (for NEW_CLIENTS section)
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custBuyerType, setCustBuyerType] = useState('RETAIL');
  const [custOwnerId, setCustOwnerId] = useState('');
  const [custNote, setCustNote] = useState('');
  const [custSubmitting, setCustSubmitting] = useState(false);
  const [custError, setCustError] = useState<string | null>(null);
  const [custSuccess, setCustSuccess] = useState<string | null>(null);
  const [phoneWarning, setPhoneWarning] = useState<string | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [addedLogs, setAddedLogs] = useState<SectionOverviewItem['historyLogs']>([]);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAddCustomerOpen) {
          setIsAddCustomerOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isAddCustomerOpen, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Reset filters when selected section changes
  useEffect(() => {
    setSearchTerm('');
    setActiveTab('employees');
    setSortOrder('desc');
    setEmployeeFilter('assigned');
    setAddedLogs([]);
    setCustSuccess(null);
    setCustError(null);
    setIsAddCustomerOpen(false);
  }, [selected]);


  const formatDigits = (val: string | number) => {
    return digitStyle === 'bn' ? toBengaliDigits(val) : String(val);
  };

  const isStandard = selected?.type === 'standard';
  const standardSec = isStandard ? selected.section : null;
  const groupSec = !isStandard ? selected?.section : null;

  // Title and labels
  const title = isStandard
    ? lang === 'bn'
      ? standardSec?.labelBn || ''
      : standardSec?.labelEn || ''
    : groupSec?.name || '';

  const unit = isStandard
    ? lang === 'bn'
      ? standardSec?.unitBn || ''
      : standardSec?.unitEn || ''
    : L('টি', 'links');

  // Renders section-specific icon
  const renderIcon = () => {
    const iconClass = 'h-6 w-6';
    if (!isStandard) {
      return <Layers className={iconClass} />;
    }
    switch (standardSec?.key) {
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

  // Format value depending on SALES_AMOUNT or normal numeric count
  const formatSectionValue = (val: number) => {
    if (isStandard && (standardSec?.key === 'SALES_AMOUNT' || standardSec?.key === 'PROFIT_AMOUNT' || standardSec?.isCurrency)) {
      return formatMoney(val);
    }
    return `${formatNum(val)} ${unit}`;
  };

  // Group section derived employee breakdown
  const groupEmployeesBreakdown = useMemo(() => {
    if (isStandard || !groupSec) return [];

    const map = new Map<
      string,
      {
        employeeId: string;
        name: string;
        total: number;
        lastDate: string;
      }
    >();

    for (const comp of groupSec.completionsHistory) {
      const existing = map.get(comp.employeeId) || {
        employeeId: comp.employeeId,
        name: comp.employeeName || 'Unknown',
        total: 0,
        lastDate: comp.date,
      };
      existing.total += 1;
      if (comp.date > existing.lastDate) {
        existing.lastDate = comp.date;
      }
      map.set(comp.employeeId, existing);
    }

    const totalLinks = groupSec.totalLinks || 1;

    return Array.from(map.values()).map((emp) => ({
      employeeId: emp.employeeId,
      name: emp.name,
      email: '',
      total: emp.total,
      target: 0,
      percentage: Math.min(100, Math.round((emp.total / totalLinks) * 100)),
      hasTarget: false,
      lastDate: emp.lastDate,
    }));
  }, [isStandard, groupSec]);

  // Combined employee breakdown
  const rawEmployeeList = useMemo(() => {
    if (isStandard) {
      return standardSec?.employeeBreakdown || [];
    }
    if (groupSec?.employeeBreakdown && groupSec.employeeBreakdown.length > 0) {
      return groupSec.employeeBreakdown;
    }
    return groupEmployeesBreakdown;
  }, [isStandard, standardSec, groupSec, groupEmployeesBreakdown]);

  // Filtered and sorted employee list
  const filteredEmployees = useMemo(() => {
    let list = [...rawEmployeeList];

    // If 'assigned' filter is chosen, show only assigned (has target or achieved total)
    // If no one is assigned, fallback to all employees so the view is never empty
    const hasAssigned = list.some((emp) => emp.hasTarget || emp.target > 0 || emp.total > 0);
    if (employeeFilter === 'assigned' && hasAssigned) {
      list = list.filter((emp) => emp.hasTarget || emp.target > 0 || emp.total > 0);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (emp) =>
          emp.name.toLowerCase().includes(q) ||
          emp.email.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortOrder === 'asc') {
        return a.total - b.total;
      }
      return b.total - a.total;
    });
    return list;
  }, [rawEmployeeList, employeeFilter, searchTerm, sortOrder]);

  // Handle phone input change with duplicate check
  const handlePhoneChange = async (val: string) => {
    setCustPhone(val);
    const cleaned = val.replace(/[\s-]/g, '');
    if (cleaned.length >= 11) {
      setCheckingPhone(true);
      try {
        const res = await fetch(`/api/leads/check-phone?phone=${encodeURIComponent(cleaned)}`);
        const data = await res.json();
        if (data.exists) {
          if (data.ownerName) {
            setPhoneWarning(
              L(
                `সতর্কতা: এই নম্বরটি ইতোমধ্যে "${data.leadName}" নামে রয়েছে (যুক্ত করেছেন: ${data.ownerName})।`,
                `Warning: Phone already exists for "${data.leadName}" (Added by: ${data.ownerName}).`
              )
            );
          } else {
            setPhoneWarning(
              L(
                `সতর্কতা: এই নম্বরটি ইতোমধ্যে অন্য একটি কাস্টমার প্রোফাইলে বিদ্যমান।`,
                `Warning: Phone already exists in the system.`
              )
            );
          }
        } else {
          setPhoneWarning(null);
        }
      } catch {
        // ignore
      } finally {
        setCheckingPhone(false);
      }
    } else {
      setPhoneWarning(null);
    }
  };

  // Create new customer profile and attribute to creator employee
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custPhone.trim()) {
      setCustError(L('কাস্টমারের নাম এবং মোবাইল নম্বর পূরণ করা আবশ্যক', 'Name and phone are required'));
      return;
    }
    if (phoneWarning) {
      setCustError(L('এই মোবাইল নম্বরটি ইতিমধ্যে ডেটাবেসে বিদ্যমান (পুরাতন কাস্টমার)। ডুপ্লিকেট কাস্টমার যোগ করা যাবে না।', 'This phone number already exists in database (Old customer). Duplicate customers cannot be added.'));
      return;
    }
    setCustSubmitting(true);
    setCustError(null);

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: custName.trim(),
          phone: custPhone.trim(),
          address: custAddress.trim() || null,
          buyer_type: custBuyerType,
          source_channel: 'ড্যাশবোর্ড - নতুন ক্লায়েন্ট',
          owner_id: custOwnerId || null,
          initial_note: custNote.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCustError(data.error || L('কাস্টমার প্রোফাইল তৈরি ব্যর্থ হয়েছে', 'Failed to create customer'));
        return;
      }

      const chosenEmp = rawEmployeeList.find((emp) => emp.employeeId === custOwnerId);
      const chosenName = chosenEmp?.name || L('বর্তমান কর্মী', 'Current Employee');

      const todayStr = new Date().toISOString().split('T')[0];
      const buyerTypeLabel =
        custBuyerType === 'WHOLESALER' ? L('পাইকারি') :
        custBuyerType === 'DEALER' ? L('ডিলার') :
        custBuyerType === 'RESTAURANT' ? L('রেস্টুরেন্ট') :
        custBuyerType === 'FARMER' ? L('খামারি') :
        custBuyerType === 'RETAIL' ? L('খুচরা') : L('অন্যান্য');

      const newLog = {
        date: todayStr,
        employeeId: custOwnerId || 'new',
        employeeName: chosenName,
        value: 1,
        note: `${custName.trim()} (${custPhone.trim()})${custAddress.trim() ? ` • ${custAddress.trim()}` : ''} • ধরন: ${buyerTypeLabel} • তৈরি করেছেন: ${chosenName}`,
      };

      setAddedLogs((prev) => [newLog, ...prev]);
      setCustSuccess(
        L(
          `কাস্টমার "${custName.trim()}" এর প্রোফাইল যুক্ত হয়েছে এবং ${chosenName} এর নতুন ক্লায়েন্ট সংখ্যায় +১ বৃদ্ধি পেয়েছে!`,
          `Customer "${custName.trim()}" created and +1 added to ${chosenName}'s new clients count!`
        )
      );

      setCustName('');
      setCustPhone('');
      setCustAddress('');
      setCustBuyerType('RETAIL');
      setCustNote('');
      setPhoneWarning(null);
      setIsAddCustomerOpen(false);

      setActiveTab('history');
      router.refresh();
    } catch {
      setCustError(L('একটি সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।', 'An error occurred. Please try again.'));
    } finally {
      setCustSubmitting(false);
    }
  };

  // Filtered sub-groups list for POSTS_DONE modal
  const filteredSubgroups = useMemo(() => {
    if (!groupSectionsOverview) return [];
    if (!searchTerm.trim()) return groupSectionsOverview;
    const q = searchTerm.toLowerCase();
    return groupSectionsOverview.filter((g) => g.name.toLowerCase().includes(q));
  }, [groupSectionsOverview, searchTerm]);

  // Standard History Logs
  const filteredHistoryLogs = useMemo(() => {
    if (!isStandard || !standardSec) return [];
    let list = [...addedLogs, ...(standardSec.historyLogs || [])];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (log) =>
          log.employeeName.toLowerCase().includes(q) ||
          (log.note && log.note.toLowerCase().includes(q)) ||
          log.date.includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortOrder === 'asc') {
        return a.date.localeCompare(b.date);
      }
      return b.date.localeCompare(a.date);
    });
    return list;
  }, [isStandard, standardSec, addedLogs, searchTerm, sortOrder]);

  // Group Completions History Logs
  const filteredGroupCompletions = useMemo(() => {
    if (isStandard || !groupSec) return [];
    let list = [...(groupSec.completionsHistory || [])];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (comp) =>
          comp.employeeName.toLowerCase().includes(q) ||
          (comp.linkTitle && comp.linkTitle.toLowerCase().includes(q)) ||
          comp.linkUrl.toLowerCase().includes(q) ||
          comp.date.includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortOrder === 'asc') {
        return a.date.localeCompare(b.date);
      }
      return b.date.localeCompare(a.date);
    });
    return list;
  }, [isStandard, groupSec, searchTerm, sortOrder]);

  // Export CSV
  const handleExportCSV = () => {
    if (isStandard && standardSec) {
      const headers = [
        L('তারিখ', 'Date'),
        L('কর্মী', 'Employee'),
        L('পরিমাণ', 'Value'),
        L('মন্তব্য', 'Notes'),
      ];
      const rows = standardSec.historyLogs.map((l) => [
        l.date,
        `"${l.employeeName}"`,
        l.value,
        `"${l.note || ''}"`,
      ]);
      const csvContent =
        'data:text/csv;charset=utf-8,\uFEFF' +
        [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `${standardSec.key}_history.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (groupSec) {
      const headers = [
        L('তারিখ ও সময়', 'Date & Time'),
        L('কর্মী', 'Employee'),
        L('লিঙ্ক শিরোনাম', 'Link Title'),
        L('ইউআরএল', 'URL'),
      ];
      const rows = groupSec.completionsHistory.map((c) => [
        c.date,
        `"${c.employeeName}"`,
        `"${c.linkTitle || ''}"`,
        `"${c.linkUrl}"`,
      ]);
      const csvContent =
        'data:text/csv;charset=utf-8,\uFEFF' +
        [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `${groupSec.name}_links_history.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Safe fallback if not open or no selected section
  if (!isOpen || !selected) {
    return null;
  }

  // Summary Metrics calculations
  const totalAchievedDisplay = isStandard
    ? formatSectionValue(standardSec!.totalAchieved + addedLogs.length)
    : `${formatNum(groupSec!.completedLinksCount)} / ${formatNum(groupSec!.totalLinks)} ${L('টি', 'links')}`;

  const targetPercentage = isStandard
    ? standardSec!.averagePercentage !== undefined
      ? standardSec!.averagePercentage
      : standardSec!.totalTarget > 0
      ? Math.round(((standardSec!.totalAchieved + addedLogs.length) / standardSec!.totalTarget) * 100)
      : null
    : groupSec?.averagePercentage !== undefined
    ? groupSec.averagePercentage
    : groupSec!.totalLinks > 0
    ? Math.round((groupSec!.completedLinksCount / groupSec!.totalLinks) * 100)
    : null;

  const assignedEmployeesCount = isStandard
    ? standardSec!.assignedEmployeesCount || standardSec!.activeEmployeesCount
    : (groupSec?.assignedEmployeesCount ?? rawEmployeeList.filter((e) => e.hasTarget || e.target > 0 || e.total > 0).length);

  const activeEmployeesCount = isStandard
    ? standardSec!.activeEmployeesCount
    : rawEmployeeList.filter((e) => e.total > 0).length;

  const totalLogsCount = isStandard
    ? standardSec!.historyLogs.length + addedLogs.length
    : groupSec!.completionsHistory.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Content */}
      <div className="relative z-10 flex flex-col w-full max-w-4xl max-h-[92vh] rounded-2xl bg-white shadow-2xl border border-slate-200/90 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/70 px-6 py-4.5">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-600/20 shadow-sm">
              {renderIcon()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 truncate tracking-tight">
                  {title}
                </h3>
                <span className="badge badge-gray shrink-0 font-normal">
                  {isStandard
                    ? L('কোর সেকশন', 'Core Metric')
                    : L('গ্রুপ লিঙ্ক', 'Group Links')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {isStandard
                  ? L(
                      'নির্দিষ্ট সময়কালে এই সেকশনের সার্বিক পরিসংখ্যান ও কর্মীভিত্তিক লগ',
                      'Overall performance and date-by-date employee logs for this period'
                    )
                  : L(
                      'গ্রুপ লিঙ্ক সম্পন্ন করার অগ্রগতি এবং বিস্তারিত ইতিহাস',
                      'Group links completion progress and employee activity history'
                    )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isStandard && standardSec?.key === 'NEW_CLIENTS' && (
              <button
                onClick={() => {
                  setIsAddCustomerOpen(true);
                  setCustError(null);
                  setPhoneWarning(null);
                }}
                className="btn btn-primary btn-sm inline-flex items-center gap-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white font-medium shadow-sm"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>{L('নতুন কাস্টমার প্রোফাইল', 'Add Customer Profile')}</span>
              </button>
            )}
            {!isStandard && standardGroupSection && onSelectStandardSection && (
              <button
                onClick={() => onSelectStandardSection(standardGroupSection)}
                className="btn btn-secondary btn-sm inline-flex items-center gap-1 text-xs text-indigo-700 hover:text-indigo-800 border-indigo-200"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {L('গ্রুপ ওভারভিউতে ফিরুন', 'Back to Group')}
                </span>
              </button>
            )}
            <button
              onClick={handleExportCSV}
              title={L('সিএসভি ডাউনলোড করুন', 'Export CSV')}
              className="btn btn-secondary btn-sm inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {L('এক্সপোর্ট', 'Export CSV')}
              </span>
            </button>
            <button
              onClick={onClose}
              className="btn-icon rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
              aria-label={L('বন্ধ করুন', 'Close')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Success Alert Banner (for Customer Creation) */}
        {custSuccess && (
          <div className="mx-6 mt-4 flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs text-emerald-800 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{custSuccess}</span>
            </div>
            <button
              onClick={() => setCustSuccess(null)}
              className="text-emerald-600 hover:text-emerald-900 font-bold ml-2 text-sm leading-none"
            >
              ×
            </button>
          </div>
        )}

        {/* Quick Highlights Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-white border-b border-slate-100">
          {/* Card 1: Total Done */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>{L('মোট সম্পন্ন', 'Total Achieved')}</span>
              <CheckCircle2 className="h-4 w-4 text-brand-600" />
            </div>
            <div className="text-lg font-bold text-slate-900 tracking-tight">
              {totalAchievedDisplay}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {L('এই সময়কালে', 'in this period')}
            </div>
          </div>

          {/* Card 2: Target / Goal */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>{isStandard ? L('লক্ষ্যমাত্রা', 'Target') : L('মোট লিঙ্ক', 'Total Links')}</span>
              <Target className="h-4 w-4 text-sky-600" />
            </div>
            <div className="text-lg font-bold text-slate-900 tracking-tight">
              {isStandard
                ? standardSec!.totalTarget > 0
                  ? formatSectionValue(standardSec!.totalTarget)
                  : '—'
                : `${formatNum(groupSec!.totalLinks)} ${L('টি', 'links')}`}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {targetPercentage !== null
                ? `${formatDigits(targetPercentage)}% ${L('গড় লক্ষ্য পূরণ', 'avg achieved')}`
                : L('কোনো টার্গেট নেই', 'No target set')}
            </div>
          </div>

          {/* Card 3: Assigned / Active Employees */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>{L('দায়িত্বপ্রাপ্ত কর্মী', 'Assigned Employees')}</span>
              <Users className="h-4 w-4 text-violet-600" />
            </div>
            <div className="text-lg font-bold text-slate-900 tracking-tight">
              {formatNum(assignedEmployeesCount)} <span className="text-xs font-normal text-slate-500">{L('জন কর্মী', 'employees')}</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {isStandard
                ? `${formatNum(activeEmployeesCount)} ${L('জন সক্রিয়ভাবে কাজ করেছেন', 'active contributors')}`
                : L('কাজ সম্পাদনকারী কর্মী', 'contributors')}
            </div>
          </div>

          {/* Card 4: Total Log Entries */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>{L('মোট রেকর্ড', 'Total Entries')}</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-lg font-bold text-slate-900 tracking-tight">
              {formatNum(totalLogsCount)} <span className="text-xs font-normal text-slate-500">{L('টি', 'records')}</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {L('হিস্ট্রি এন্ট্রি সংখ্যা', 'logged updates')}
            </div>
          </div>
        </div>

        {/* Tab Selection Bar & Search Input */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3 border-b border-slate-100 bg-white">
          {/* Segmented Tab Switcher */}
          <div className="segmented">
            <button
              onClick={() => setActiveTab('employees')}
              data-active={activeTab === 'employees'}
              className="flex items-center gap-1.5"
            >
              <Users className="h-3.5 w-3.5" />
              <span>{L('কর্মী অনুযায়ী বিশ্লেষণ', 'Employee Breakdown')}</span>
              <span className="ml-1 rounded-full bg-slate-200/80 px-1.5 py-0.2 text-[10px] font-semibold text-slate-700">
                {formatNum(rawEmployeeList.length)}
              </span>
            </button>
            {isStandard && standardSec?.key === 'POSTS_DONE' && (
              <button
                onClick={() => setActiveTab('subgroups')}
                data-active={activeTab === 'subgroups'}
                className="flex items-center gap-1.5"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>{L('সাব-গ্রুপসমূহ', 'Sub-Groups')}</span>
                <span className="ml-1 rounded-full bg-indigo-100 px-1.5 py-0.2 text-[10px] font-semibold text-indigo-700">
                  {formatNum(groupSectionsOverview?.length || 0)}
                </span>
              </button>
            )}
            <button
              onClick={() => setActiveTab('history')}
              data-active={activeTab === 'history'}
              className="flex items-center gap-1.5"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>{L('সম্পূর্ণ হিস্ট্রি লগ', 'Full History Log')}</span>
              <span className="ml-1 rounded-full bg-slate-200/80 px-1.5 py-0.2 text-[10px] font-semibold text-slate-700">
                {formatNum(totalLogsCount)}
              </span>
            </button>
          </div>

          {/* Search Box & Sort Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder={
                  activeTab === 'employees'
                    ? L('কর্মী খুঁজুন (নাম বা ইমেইল)...', 'Search employee...')
                    : L('হিস্ট্রি খুঁজুন (কর্মী, নোট, লিংক)...', 'Search logs...')
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-9 py-1 text-xs"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              title={
                sortOrder === 'desc'
                  ? L('সর্বোচ্চ থেকে সর্বনিম্ন', 'Highest first')
                  : L('সর্বনিম্ন থেকে সর্বোচ্চ', 'Lowest first')
              }
              className="btn btn-secondary btn-sm p-1.5 text-slate-600"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/40">
          {activeTab === 'employees' ? (
            /* TAB 1: EMPLOYEE BREAKDOWN */
            <div>
              {/* Assignment filter pills */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setEmployeeFilter('assigned')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      employeeFilter === 'assigned'
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {L('দায়িত্বপ্রাপ্ত কর্মী', 'Assigned Employees')} ({formatNum(rawEmployeeList.filter(e => e.target > 0 || e.total > 0).length || rawEmployeeList.length)})
                  </button>
                  <button
                    onClick={() => setEmployeeFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      employeeFilter === 'all'
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {L('সকল কর্মী', 'All Employees')} ({formatNum(rawEmployeeList.length)})
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  {L('প্রতিটি কর্মীর অর্জিত কাজ ও লক্ষ্যমাত্রা পূরণের অগ্রগতি', 'Individual target, progress % and achievements')}
                </p>
              </div>

              {filteredEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-10 text-center bg-white rounded-xl border border-dashed border-slate-200">
                  <Users className="h-10 w-10 text-slate-300 mb-2" />
                  <p className="text-sm font-medium text-slate-700">
                    {L('কোনো কর্মী পাওয়া যায়নি', 'No employee records found')}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    {searchTerm
                      ? L(
                          'অনুসন্ধানের সাথে মিল পাওয়া যায়নি। অন্য কীওয়ার্ড দিয়ে চেষ্টা করুন।',
                          'No match found for your search query. Try another keyword.'
                        )
                      : L(
                          'এই সময়ে কোনো কর্মী এই সেকশনে কোনো কাজ করেননি।',
                          'No employee has performed any work in this section during this period.'
                        )}
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
                  <table className="table-pro">
                    <thead>
                      <tr>
                        <th>{L('কর্মী', 'Employee')}</th>
                        <th className="text-right">{L('অর্জিত পরিমাণ', 'Achieved')}</th>
                        {isStandard && (
                          <th className="text-right">{L('টার্গেট', 'Target')}</th>
                        )}
                        <th className="w-44">{L('অগ্রগতি / হার', 'Progress')}</th>
                        <th className="text-center">{L('স্ট্যাটাস', 'Status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmployees.map((emp, idx) => {
                        const pct = Math.min(100, Math.max(0, emp.percentage || 0));
                        const hasTarget = isStandard && emp.target > 0;
                        const isGoalMet = hasTarget && emp.total >= emp.target;

                        let badgeColorClass = 'badge-gray';
                        let badgeText = L('চলমান', 'In Progress');

                        if (isGoalMet) {
                          badgeColorClass = 'badge-green';
                          badgeText = L('লক্ষ্য পূরণ', 'Target Met');
                        } else if (pct >= 75) {
                          badgeColorClass = 'badge-blue';
                          badgeText = L('উন্নত', 'Great');
                        } else if (pct >= 40) {
                          badgeColorClass = 'badge-amber';
                          badgeText = L('চলমান', 'In Progress');
                        } else if (emp.total > 0) {
                          badgeColorClass = 'badge-violet';
                          badgeText = L('শুরু হয়েছে', 'Started');
                        } else {
                          badgeColorClass = 'badge-gray';
                          badgeText = L('অনির্ধারিত', 'None');
                        }

                        let barColor = 'bg-brand-600';
                        if (pct >= 100) barColor = 'bg-emerald-600';
                        else if (pct >= 70) barColor = 'bg-sky-600';
                        else if (pct >= 40) barColor = 'bg-amber-500';
                        else barColor = 'bg-rose-500';

                        return (
                          <tr key={emp.employeeId || idx} className="transition-colors">
                            {/* Employee column */}
                            <td>
                              <div className="flex items-center gap-3">
                                <div
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold border ${getAvatarColor(
                                    emp.name
                                  )}`}
                                >
                                  {getInitials(emp.name)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900 truncate">
                                    {emp.name}
                                  </div>
                                  {emp.email ? (
                                    <div className="text-xs text-slate-400 truncate">
                                      {emp.email}
                                    </div>
                                  ) : (
                                    <div className="text-[11px] text-slate-400">
                                      ID: {emp.employeeId.slice(0, 8)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Achieved column */}
                            <td className="text-right">
                              <span className="font-semibold text-slate-900 tabular-nums">
                                {formatSectionValue(emp.total)}
                              </span>
                              {isStandard && standardSec?.key === 'NEW_CLIENTS' && (emp as any).bankedSurplus && (emp as any).bankedSurplus > 0 ? (
                                <div className="text-[10px] text-emerald-600 font-medium">
                                  +{formatNum((emp as any).bankedSurplus)} {L('জন জমা (রোলওভার)', 'banked surplus')}
                                </div>
                              ) : null}
                            </td>

                            {/* Target column (Standard only) */}
                            {isStandard && (
                              <td className="text-right text-slate-600 tabular-nums">
                                {emp.target > 0 ? (
                                  formatSectionValue(emp.target)
                                ) : (
                                  <span className="text-xs text-slate-400 italic">
                                    {standardSec?.key === 'NEW_CLIENTS' && emp.total > 0
                                      ? L('টার্গেট নেই (জমা আছে)', 'Unassigned (Banked)')
                                      : '—'}
                                  </span>
                                )}
                              </td>
                            )}

                            {/* Progress bar column */}
                            <td>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-slate-800 tabular-nums">
                                    {formatDigits(pct)}%
                                  </span>
                                  {hasTarget && (
                                    <span className="text-[11px] text-slate-400">
                                      {formatNum(emp.total)} / {formatNum(emp.target)}
                                    </span>
                                  )}
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* Status badge */}
                            <td className="text-center">
                              <span className={`badge ${badgeColorClass}`}>
                                {isGoalMet && <Award className="h-3 w-3 mr-0.5" />}
                                {badgeText}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : activeTab === 'subgroups' ? (
            /* TAB 2: SUB-GROUPS BREAKDOWN */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-indigo-600" />
                    {L('গ্রুপ লিঙ্ক পোস্টিং - অন্তর্ভুক্ত সাব-গ্রুপসমূহ', 'Group Link Posting - Sub-Groups')}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {L(
                      'প্রতিটি নির্দিষ্ট গ্রুপে লিঙ্ক পোস্টিং কাজের অগ্রগতি ও সক্রিয় কর্মীর সংখ্যা',
                      'Progress and active contributors for each specific posting sub-group'
                    )}
                  </p>
                </div>
                <span className="badge badge-violet text-xs font-semibold">
                  {formatNum(filteredSubgroups.length)} {L('টি সাব-গ্রুপ', 'sub-groups')}
                </span>
              </div>

              {filteredSubgroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-10 text-center bg-white rounded-xl border border-dashed border-slate-200">
                  <Layers className="h-10 w-10 text-slate-300 mb-2" />
                  <p className="text-sm font-medium text-slate-700">
                    {L('কোনো সাব-গ্রুপ পাওয়া যায়নি', 'No sub-groups found')}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {L('অনুসন্ধান শব্দ পরিবর্তন করে পুনরায় চেষ্টা করুন।', 'Try adjusting your search criteria.')}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {filteredSubgroups.map((g) => {
                    const total = g.totalLinks || 1;
                    const comp = g.completedLinksCount || 0;
                    const pct = Math.min(100, Math.round((comp / total) * 100));
                    const uniqueUsers = new Set(g.completionsHistory.map((c) => c.employeeId)).size;

                    return (
                      <div
                        key={g.id}
                        onClick={() => {
                          if (onSelectGroupSection) {
                            onSelectGroupSection(g);
                          }
                        }}
                        className="card p-4.5 cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all duration-200 group flex flex-col justify-between bg-white border border-slate-200/90"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/60 shadow-xs group-hover:scale-105 transition-transform">
                                <Layers className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors truncate">
                                  {g.name}
                                </h4>
                                <p className="text-[11px] text-slate-400">
                                  {L('সাব-গ্রুপ লিঙ্ক পোস্টিং', 'Sub-Group Posting')}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`badge ${
                                pct >= 100 ? 'badge-green' : pct >= 50 ? 'badge-blue' : 'badge-amber'
                              } font-semibold tabular-nums text-[11px]`}
                            >
                              {formatDigits(pct)}%
                            </span>
                          </div>

                          <div className="mt-3.5">
                            <div className="text-xl font-bold text-slate-900 tabular-nums">
                              {formatNum(comp)}{' '}
                              <span className="text-xs font-normal text-slate-500">
                                / {formatNum(g.totalLinks)} {L('টি লিঙ্ক সম্পন্ন', 'links')}
                              </span>
                            </div>
                          </div>

                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                          <span className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-slate-400" />
                            <span>
                              <strong className="text-slate-800 font-semibold">{formatNum(uniqueUsers)}</strong>{' '}
                              {L('কর্মী সক্রিয়', 'active')}
                            </span>
                          </span>
                          <span className="inline-flex items-center gap-1 font-medium text-indigo-600 group-hover:text-indigo-800 transition-colors">
                            {L('লিঙ্ক ও বিস্তারিত দেখুন', 'View Details')}
                            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* TAB 3: FULL HISTORY LOG */
            <div>
              {isStandard ? (
                /* Standard Section History Logs */
                filteredHistoryLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-10 text-center bg-white rounded-xl border border-dashed border-slate-200">
                    <Clock className="h-10 w-10 text-slate-300 mb-2" />
                    <p className="text-sm font-medium text-slate-700">
                      {L('কোনো হিস্ট্রি লগ পাওয়া যায়নি', 'No history logs found')}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      {searchTerm
                        ? L(
                            'অনুসন্ধানের সাথে মিল পাওয়া যায়নি।',
                            'No logs match your filter criteria.'
                          )
                        : L(
                            'এই সেকশনে এখনও কোনো দৈনিক কাজের হিস্ট্রি এন্ট্রি রেকর্ড হয়নি।',
                            'No daily entries recorded for this section in the selected timeframe.'
                          )}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
                    <table className="table-pro">
                      <thead>
                        <tr>
                          <th className="w-36">{L('তারিখ', 'Date')}</th>
                          <th>
                            {standardSec?.key === 'NEW_CLIENTS'
                              ? L('যুক্ত করেছেন (কর্মী)', 'Added by (Employee)')
                              : L('কর্মী', 'Employee')}
                          </th>
                          <th className="text-right">
                            {standardSec?.key === 'NEW_CLIENTS'
                              ? L('কাউন্ট', 'Count')
                              : L('সম্পন্ন পরিমাণ', 'Quantity / Value')}
                          </th>
                          <th>
                            {standardSec?.key === 'NEW_CLIENTS'
                              ? L('কাস্টমার প্রোফাইল ও বিবরণ', 'Customer Profile & Details')
                              : L('নোট / মন্তব্য', 'Notes / Remarks')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHistoryLogs.map((log, idx) => (
                          <tr key={`${log.date}_${log.employeeId}_${idx}`} className="transition-colors">
                            <td className="font-mono text-xs text-slate-700 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span>{formatDigits(log.date)}</span>
                              </div>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <div
                                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold border ${getAvatarColor(
                                    log.employeeName
                                  )}`}
                                >
                                  {getInitials(log.employeeName)}
                                </div>
                                <div>
                                  <span className="font-semibold text-slate-900 truncate block">
                                    {log.employeeName}
                                  </span>
                                  {standardSec?.key === 'NEW_CLIENTS' && (
                                    <span className="badge badge-blue text-[9px] py-0 px-1 font-medium">
                                      {L('যুক্ত করেছেন', 'Added by')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="text-right">
                              <span className="font-semibold text-brand-700 tabular-nums">
                                {formatSectionValue(log.value)}
                              </span>
                            </td>
                            <td>
                              {log.note ? (
                                standardSec?.key === 'NEW_CLIENTS' ? (
                                  <div className="flex items-center gap-2 max-w-lg">
                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                      <UserPlus className="h-3 w-3" />
                                    </div>
                                    <span className="text-xs text-slate-800 font-medium leading-relaxed">
                                      {log.note}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-2.5 py-1 text-xs text-slate-700 border border-slate-200/70 max-w-md truncate">
                                    <FileText className="h-3 w-3 text-slate-400 shrink-0" />
                                    <span className="truncate">{log.note}</span>
                                  </span>
                                )
                              ) : (
                                <span className="text-xs text-slate-400 italic">
                                  {L('কোনো নোট নেই', 'No notes')}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                /* Group Section Completions History */
                filteredGroupCompletions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-10 text-center bg-white rounded-xl border border-dashed border-slate-200">
                    <Layers className="h-10 w-10 text-slate-300 mb-2" />
                    <p className="text-sm font-medium text-slate-700">
                      {L('কোনো গ্রুপ লিঙ্ক হিস্ট্রি পাওয়া যায়নি', 'No link completion history')}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      {L(
                        'এই গ্রুপ সেকশনে এখনো কোনো লিঙ্ক সম্পূর্ণ করা হয়নি।',
                        'No group links completed in this section during this period.'
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
                    <table className="table-pro">
                      <thead>
                        <tr>
                          <th className="w-40">{L('তারিখ ও সময়', 'Date & Time')}</th>
                          <th>{L('কর্মী', 'Employee')}</th>
                          <th>{L('গ্রুপ লিঙ্ক ও শিরোনাম', 'Group Link & Title')}</th>
                          <th className="text-center w-28">{L('স্ট্যাটাস', 'Status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredGroupCompletions.map((comp, idx) => (
                          <tr key={`${comp.employeeId}_${comp.date}_${idx}`} className="transition-colors">
                            <td className="font-mono text-xs text-slate-700 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span>{formatDigits(comp.date)}</span>
                              </div>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <div
                                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold border ${getAvatarColor(
                                    comp.employeeName
                                  )}`}
                                >
                                  {getInitials(comp.employeeName)}
                                </div>
                                <span className="font-medium text-slate-900 truncate">
                                  {comp.employeeName}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="min-w-0 max-w-lg">
                                {comp.linkTitle && (
                                  <div className="font-medium text-slate-900 text-xs truncate mb-0.5">
                                    {comp.linkTitle}
                                  </div>
                                )}
                                <a
                                  href={comp.linkUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 hover:underline max-w-full truncate"
                                >
                                  <span className="truncate">{comp.linkUrl}</span>
                                  <ExternalLink className="h-3 w-3 shrink-0" />
                                </a>
                              </div>
                            </td>
                            <td className="text-center">
                              <span className="badge badge-green">
                                <CheckCircle2 className="h-3 w-3" />
                                {L('সম্পন্ন', 'Done')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-3.5">
          <div className="text-xs text-slate-500">
            {activeTab === 'employees' ? (
              <span>
                {L('মোট সক্রিয় কর্মী:', 'Active Contributors:')}{' '}
                <strong className="text-slate-800 font-semibold">{formatNum(filteredEmployees.length)}</strong>
              </span>
            ) : (
              <span>
                {L('প্রদর্শিত লগ সংখ্যা:', 'Showing Entries:')}{' '}
                <strong className="text-slate-800 font-semibold">
                  {formatNum(
                    isStandard
                      ? filteredHistoryLogs.length
                      : filteredGroupCompletions.length
                  )}
                </strong>
              </span>
            )}
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm">
            {L('বন্ধ করুন', 'Close')}
          </button>
        </div>
      </div>

      {/* Add Customer Profile Modal */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setIsAddCustomerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700 border border-brand-200">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {L('নতুন কাস্টমার প্রোফাইল তৈরি', 'Create Customer Profile')}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {L('কাস্টমার তথ্য ও সংশ্লিষ্ট কর্মীর নাম যুক্ত করুন', 'Add customer details and creator employee')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCustomerOpen(false)}
                className="btn-icon text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-5 space-y-3.5">
              {custError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{custError}</span>
                </div>
              )}

              <div>
                <label className="label text-xs font-semibold text-slate-700">
                  {L('কাস্টমারের নাম *', 'Customer Name *')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={L('যেমন: মো: আরিফুল ইসলাম', 'e.g. John Doe')}
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="input text-xs py-1.5"
                />
              </div>

              <div>
                <label className="label text-xs font-semibold text-slate-700">
                  {L('মোবাইল নম্বর (১১ ডিজিট) *', 'Phone Number (11 Digits) *')}
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    placeholder="01XXXXXXXXX"
                    value={custPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="input text-xs py-1.5 tabular-nums pr-8"
                  />
                  {checkingPhone && (
                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-slate-400" />
                  )}
                </div>
                {phoneWarning && (
                  <div className="mt-1 text-[11px] text-amber-700 bg-amber-50 rounded p-1.5 border border-amber-200 flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
                    <span>{phoneWarning}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs font-semibold text-slate-700">
                    {L('ক্রেতার ধরন', 'Buyer Type')}
                  </label>
                  <select
                    value={custBuyerType}
                    onChange={(e) => setCustBuyerType(e.target.value)}
                    className="input text-xs py-1.5"
                  >
                    <option value="RETAIL">{L('খুচরা (Retail)', 'Retail')}</option>
                    <option value="WHOLESALER">{L('পাইকারি (Wholesale)', 'Wholesale')}</option>
                    <option value="DEALER">{L('ডিলার (Dealer)', 'Dealer')}</option>
                    <option value="RESTAURANT">{L('রেস্টুরেন্ট (Restaurant)', 'Restaurant')}</option>
                    <option value="FARMER">{L('খামারি / কৃষক (Farmer)', 'Farmer')}</option>
                    <option value="OTHER">{L('অন্যান্য (Other)', 'Other')}</option>
                  </select>
                </div>

                <div>
                  <label className="label text-xs font-semibold text-slate-700">
                    {L('তৈরি করেছেন (কর্মী)', 'Created by (Employee)')}
                  </label>
                  <select
                    value={custOwnerId}
                    onChange={(e) => setCustOwnerId(e.target.value)}
                    className="input text-xs py-1.5"
                  >
                    <option value="">{L('বর্তমান ইউজার', 'Current User')}</option>
                    {rawEmployeeList.map((emp) => (
                      <option key={emp.employeeId} value={emp.employeeId}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label text-xs font-semibold text-slate-700">
                  {L('ঠিকানা / এলাকা', 'Address / Area')}
                </label>
                <input
                  type="text"
                  placeholder={L('যেমন: মিরপুর ১০, ঢাকা', 'e.g. Mirpur 10, Dhaka')}
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  className="input text-xs py-1.5"
                />
              </div>

              <div>
                <label className="label text-xs font-semibold text-slate-700">
                  {L('মন্তব্য বা প্রাথমিক নোট', 'Initial Notes')}
                </label>
                <textarea
                  rows={2}
                  placeholder={L('পণ্য আগ্রহ বা অতিরিক্ত তথ্য...', 'Notes or product interest...')}
                  value={custNote}
                  onChange={(e) => setCustNote(e.target.value)}
                  className="input text-xs py-1.5"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="btn btn-secondary btn-sm text-xs"
                >
                  {L('বাতিল', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={custSubmitting}
                  className="btn btn-primary btn-sm text-xs bg-brand-600 hover:bg-brand-700 text-white flex items-center gap-1.5"
                >
                  {custSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>{L('সংরক্ষণ হচ্ছে...', 'Saving...')}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{L('সংরক্ষণ করুন', 'Save Profile')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
