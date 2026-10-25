import { CampaignChannel } from '@prisma/client';

export const VALID_CAMPAIGN_CHANNELS: CampaignChannel[] = [
  CampaignChannel.FACEBOOK_GROUP,
  CampaignChannel.FACEBOOK_AD,
  CampaignChannel.GOOGLE_AD,
  CampaignChannel.YOUTUBE,
  CampaignChannel.OTHER,
];

export const CHANNEL_DISPLAY_CONFIG: Record<
  CampaignChannel,
  { labelBn: string; labelEn: string; badgeClass: string }
> = {
  FACEBOOK_GROUP: {
    labelBn: 'ফেসবুক গ্রুপ',
    labelEn: 'FB Group',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  FACEBOOK_AD: {
    labelBn: 'ফেসবুক বিজ্ঞাপন',
    labelEn: 'FB Ad',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  GOOGLE_AD: {
    labelBn: 'গুগল বিজ্ঞাপন',
    labelEn: 'Google Ad',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  YOUTUBE: {
    labelBn: 'ইউটিউব',
    labelEn: 'YouTube',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  OTHER: {
    labelBn: 'অন্যান্য',
    labelEn: 'Other',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

/**
 * Calculate ROAS (Return On Ad Spend)
 * ROAS = Revenue / Ad Spend
 * Example: ৳50,000 revenue with ৳10,000 ad spend = 5.0x
 */
export function calculateROAS(revenue: number, adSpend: number, fallbackBudget: number = 0): number {
  if (adSpend > 0) {
    return Number((revenue / adSpend).toFixed(2));
  }
  if (revenue > 0 && fallbackBudget > 0) {
    return Number((revenue / fallbackBudget).toFixed(2));
  }
  return 0;
}

export interface CampaignBudgetEvaluation {
  budgetAmount: number;
  actualSpend: number;
  spendPercentage: number;
  status: 'SAFE' | 'WARNING' | 'EXCEEDED';
  color: 'emerald' | 'amber' | 'rose';
  isApproaching: boolean;
  isExceeded: boolean;
  warningMessage: string | null;
}

/**
 * Evaluates budget limit vs ad spend:
 * SAFE: spend < 80% of budget
 * WARNING (Approaching limit): spend between 80% and 100% of budget
 * EXCEEDED (Over budget limit): spend > 100% of budget
 */
export function evaluateCampaignBudget(
  budgetAmount: number,
  actualSpend: number
): CampaignBudgetEvaluation {
  const spendPercentage = budgetAmount > 0 ? Number(((actualSpend / budgetAmount) * 100).toFixed(1)) : 0;
  let status: 'SAFE' | 'WARNING' | 'EXCEEDED' = 'SAFE';
  let color: 'emerald' | 'amber' | 'rose' = 'emerald';
  let isApproaching = false;
  let isExceeded = false;
  let warningMessage: string | null = null;

  if (spendPercentage > 100) {
    status = 'EXCEEDED';
    color = 'rose';
    isExceeded = true;
    const overSpend = actualSpend - budgetAmount;
    warningMessage = `বাজেট সীমা অতিক্রম করেছে (${spendPercentage}%)! অতিরিক্ত খরচ: ৳${overSpend.toLocaleString('en-IN')}`;
  } else if (spendPercentage >= 80) {
    status = 'WARNING';
    color = 'amber';
    isApproaching = true;
    const remaining = budgetAmount - actualSpend;
    warningMessage = `বাজেট প্রায় শেষ (${spendPercentage}%)! অবশিষ্ট: ৳${remaining.toLocaleString('en-IN')}`;
  }

  return {
    budgetAmount,
    actualSpend,
    spendPercentage,
    status,
    color,
    isApproaching,
    isExceeded,
    warningMessage,
  };
}
