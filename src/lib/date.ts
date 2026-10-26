import { format, parseISO, differenceInCalendarDays, subDays } from 'date-fns';

export const DHAKA_TIMEZONE = 'Asia/Dhaka';

/**
 * Returns the current date in Asia/Dhaka timezone as a YYYY-MM-DD string.
 */
export function getDhakaDateString(date: Date = new Date()): string {
  // Use Intl to format the date in Asia/Dhaka timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: DHAKA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // outputs "YYYY-MM-DD"
}

/**
 * Returns formatted date and time in Asia/Dhaka timezone as "YYYY-MM-DD HH:mm".
 */
export function formatDhakaDateTime(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: DHAKA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(d).replace(',', '');
}

/**
 * Returns a Date object anchored at 00:00:00 UTC for a given YYYY-MM-DD string.
 */
export function parseDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/**
 * Checks if a target entry date (YYYY-MM-DD) is within the allowed edit window.
 * Default editWindowDays is 1 (today and yesterday).
 */
export function isDateWithinEditWindow(
  entryDateStr: string,
  editWindowDays: number = 1,
  currentDate: Date = new Date()
): { isAllowed: boolean; todayDhaka: string; oldestAllowedDhaka: string } {
  const todayDhaka = getDhakaDateString(currentDate);
  const todayParsed = parseISO(todayDhaka);
  const entryParsed = parseISO(entryDateStr);

  const diff = differenceInCalendarDays(todayParsed, entryParsed);
  // diff 0 = today, diff 1 = yesterday. diff < 0 means future date (can also be disallow or allow)
  // For daily entry: cannot enter future dates (diff < 0), and cannot enter older than editWindowDays (diff > editWindowDays)
  const isAllowed = diff >= 0 && diff <= editWindowDays;

  const oldestAllowed = format(subDays(todayParsed, editWindowDays), 'yyyy-MM-dd');

  return {
    isAllowed,
    todayDhaka,
    oldestAllowedDhaka: oldestAllowed,
  };
}

/**
 * Converts English digits (0-9) to Bengali digits (০-৯).
 */
export function toBengaliDigits(input: string | number): string {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(input).replace(/[0-9]/g, (d) => bnDigits[parseInt(d, 10)]);
}

/**
 * Formats a number in Bangladeshi / Indian currency format (e.g. ৳ 1,00,000 or ৳ 12,34,567.00).
 */
export function formatTaka(
  amount: number | string | null | undefined,
  useBnDigits: boolean = false
): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return useBnDigits ? '৳ ০' : '৳ 0';
  }

  const num = Number(amount);
  const parts = num.toFixed(2).split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];

  const isNegative = integerPart.startsWith('-');
  if (isNegative) {
    integerPart = integerPart.slice(1);
  }

  // Bangladeshi/Indian grouping: last 3 digits, then groups of 2 digits
  let lastThree = integerPart.slice(-3);
  const otherNumbers = integerPart.slice(0, -3);

  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInteger =
    otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  let formatted = (isNegative ? '-' : '') + formattedInteger;
  if (decimalPart && decimalPart !== '00') {
    formatted += '.' + decimalPart;
  }

  const result = `৳ ${formatted}`;
  return useBnDigits ? toBengaliDigits(result) : result;
}

const BN_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

/**
 * Formats a date cleanly in Bengali or English without leaking raw ISO timestamps.
 * e.g. "২৬ অক্টোবর, ২০২৬" (bn) or "26 Oct, 2026" (en).
 */
export function formatDisplayDate(
  dateInput: string | Date | null | undefined,
  lang: 'bn' | 'en' = 'bn'
): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';

  if (lang === 'en') {
    return format(d, 'dd MMMM, yyyy');
  }

  const day = toBengaliDigits(d.getDate());
  const month = BN_MONTHS[d.getMonth()];
  const year = toBengaliDigits(d.getFullYear());
  return `${day} ${month}, ${year}`;
}
