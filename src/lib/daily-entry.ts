export interface DailyEntryMetrics {
  SALES_AMOUNT?: number;
  PROFIT_AMOUNT?: number;
  CONFIRMED_ORDERS?: number;
  NEW_LEADS?: number;
  NEW_CLIENTS?: number;
  RETENTION_COUNT?: number;
  AD_SPEND?: number;
  FOLLOWUPS_DONE?: number;
  B2B_ORDERS?: number;
  B2B_INQUIRIES?: number;
  B2B_INQUIRY_VALUE?: number;
  POSTS_DONE?: number;
}

export interface BusinessWarning {
  code: 'PROFIT_EXCEEDS_SALES' | 'ORDERS_EXCEED_LEADS' | 'B2B_ORDERS_EXCEED_INQUIRIES';
  message: string;
}

export const WARNING_MESSAGES = {
  PROFIT_EXCEEDS_SALES: 'সতর্কতা: লাভের পরিমাণ মোট বিক্রির চেয়ে বেশি।',
  ORDERS_EXCEED_LEADS: 'সতর্কতা: নিশ্চিত অর্ডারের সংখ্যা নতুন লিডের চেয়ে বেশি।',
  B2B_ORDERS_EXCEED_INQUIRIES: 'সতর্কতা: B2B অর্ডারের সংখ্যা B2B অনুসন্ধানের চেয়ে বেশি।',
} as const;

export const LOCK_NOTICE = 'এই তারিখের entry এখন বন্ধ (Locked)।';
export const SAVE_SUCCESS_MESSAGE = 'সংরক্ষিত হয়েছে (Saved)';

/**
 * Checks business logic warning rules for employee daily entry (Section 7.2):
 * - Profit > Sales: "সতর্কতা: লাভের পরিমাণ মোট বিক্রির চেয়ে বেশি।"
 * - Confirmed Orders > New Leads: "সতর্কতা: নিশ্চিত অর্ডারের সংখ্যা নতুন লিডের চেয়ে বেশি।"
 * - B2B Orders > B2B Inquiries: "সতর্কতা: B2B অর্ডারের সংখ্যা B2B অনুসন্ধানের চেয়ে বেশি।"
 */
export function checkDailyEntryWarnings(metrics: DailyEntryMetrics): BusinessWarning[] {
  const warnings: BusinessWarning[] = [];

  const sales = Number(metrics.SALES_AMOUNT) || 0;
  const profit = Number(metrics.PROFIT_AMOUNT) || 0;
  const confirmedOrders = Number(metrics.CONFIRMED_ORDERS) || 0;
  const newLeads = Number(metrics.NEW_LEADS) || 0;
  const b2bOrders = Number(metrics.B2B_ORDERS) || 0;
  const b2bInquiries = Number(metrics.B2B_INQUIRIES) || 0;

  // Rule 1: Profit > Sales
  if (profit > sales) {
    warnings.push({
      code: 'PROFIT_EXCEEDS_SALES',
      message: WARNING_MESSAGES.PROFIT_EXCEEDS_SALES,
    });
  }

  // Rule 2: Confirmed Orders > New Leads
  if (confirmedOrders > newLeads) {
    warnings.push({
      code: 'ORDERS_EXCEED_LEADS',
      message: WARNING_MESSAGES.ORDERS_EXCEED_LEADS,
    });
  }

  // Rule 3: B2B Orders > B2B Inquiries
  if (b2bOrders > b2bInquiries) {
    warnings.push({
      code: 'B2B_ORDERS_EXCEED_INQUIRIES',
      message: WARNING_MESSAGES.B2B_ORDERS_EXCEED_INQUIRIES,
    });
  }

  return warnings;
}
