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
 * Returns formatted BST (Asia/Dhaka UTC+6) date and time display string.
 * Example: "26 Oct 2026, 07:30 PM (BST)" or with Bengali digits.
 */
export function formatBstDateTime(
  dateInput: Date | string | null | undefined,
  lang: 'bn' | 'en' = 'bn'
): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';

  const options: Intl.DateTimeFormatOptions = {
    timeZone: DHAKA_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  };

  const formatted = new Intl.DateTimeFormat('en-US', options).format(d);
  if (lang === 'bn') {
    return `${toBengaliDigits(formatted)} (BST)`;
  }
  return `${formatted} (BST)`;
}

/**
 * Returns UTC Date object corresponding to start of day (00:00:00.000) in Asia/Dhaka.
 */
export function getDhakaStartOfDay(date: Date = new Date()): Date {
  const dhakaDateStr = getDhakaDateString(date);
  return new Date(`${dhakaDateStr}T00:00:00+06:00`);
}

/**
 * Returns UTC Date object corresponding to end of day (23:59:59.999) in Asia/Dhaka.
 */
export function getDhakaEndOfDay(date: Date = new Date()): Date {
  const dhakaDateStr = getDhakaDateString(date);
  return new Date(`${dhakaDateStr}T23:59:59.999+06:00`);
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

export const BN_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

/**
 * Returns a date string in Asia/Dhaka timezone offset by a number of days.
 * E.g. daysAgo = 1 returns yesterday's YYYY-MM-DD in Dhaka.
 */
export function getDhakaOffsetDateString(daysAgo: number): string {
  const todayStr = getDhakaDateString(new Date());
  const [y, m, d] = todayStr.split('-').map(Number);
  const targetDate = new Date(Date.UTC(y, m - 1, d - daysAgo, 12, 0, 0));
  return getDhakaDateString(targetDate);
}

export interface ExtractedDateInfo {
  dateStr: string;
  labelBn: string;
  labelEn: string;
  isYesterday: boolean;
  isToday: boolean;
  daysAgo?: number;
}

const MONTH_MAP: Record<string, string> = {
  jan: '01', january: '01', 'জানুয়ারি': '01',
  feb: '02', february: '02', 'ফেব্রুয়ারি': '02',
  mar: '03', march: '03', 'মার্চ': '03',
  apr: '04', april: '04', 'এপ্রিল': '04',
  may: '05', 'মে': '05',
  jun: '06', june: '06', 'জুন': '06',
  jul: '07', july: '07', 'জুলাই': '07',
  aug: '08', august: '08', 'আগস্ট': '08',
  sep: '09', sept: '09', september: '09', 'সেপ্টেম্বর': '09',
  oct: '10', october: '10', 'অক্টোবর': '10',
  nov: '11', november: '11', 'নভেম্বর': '11',
  dec: '12', december: '12', 'ডিসেম্বর': '12',
};

/**
 * Parses natural language date references (English, Bengali, and Banglish) from a message.
 * Supports: yesterday / kalker / gotokal, today / ajker, 2 days ago / poroshu, N days ago,
 * ISO dates (2026-10-25), DD-MM-YYYY (25-10-2026), and day+month (25 October, 25 tarikh).
 */
export function extractDateFromQuery(query: string): ExtractedDateInfo | null {
  if (!query) return null;
  // Convert Bengali digits to ASCII
  const text = query.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6));
  const lower = text.toLowerCase();

  // 1. Yesterday (gotokal / kalker / yesterday / previous day / ager din)
  if (
    /(?:^|[^\p{L}\p{N}])(?:yesterday|yesterdays|last\s*day|previous\s*day|কালকের|কালকে|কালকার|গতকাল|গতকালকের|গতকালকার|kalker|kalke|kal\s*ke|kalkar|kalkr|gotokal|gotokaler|ager\s*din|ager\s*diner|prev\s*day|kalekr|klaker)(?:[^\p{L}\p{N}]|$)/iu.test(
      lower
    )
  ) {
    const dateStr = getDhakaOffsetDateString(1);
    return {
      dateStr,
      labelBn: 'গতকালকের',
      labelEn: 'Yesterday',
      isYesterday: true,
      isToday: false,
      daysAgo: 1,
    };
  }

  // 2. Day before yesterday / 2 days ago (poroshu / poroshur)
  if (
    /(?:^|[^\p{L}\p{N}])(?:day\s*before\s*yesterday|2\s*days?\s*ago|two\s*days?\s*ago|পরশু|পরশুর|গত\s*পরশু|poroshu|poroshur|gotoporoshu|2\s*din\s*age|dui\s*din\s*age)(?:[^\p{L}\p{N}]|$)/iu.test(
      lower
    )
  ) {
    const dateStr = getDhakaOffsetDateString(2);
    return {
      dateStr,
      labelBn: 'পরশুর',
      labelEn: 'Day before yesterday',
      isYesterday: false,
      isToday: false,
      daysAgo: 2,
    };
  }

  // 3. N days ago (e.g. 3 din age / 5 days ago)
  const nDaysMatch = /(\d+)\s*(?:din|দিন|days?)\s*(?:age|ager|আগে|আগের)/iu.exec(lower);
  if (nDaysMatch) {
    const n = Math.min(Math.max(parseInt(nDaysMatch[1], 10), 1), 365);
    const dateStr = getDhakaOffsetDateString(n);
    return {
      dateStr,
      labelBn: `${n} দিন আগের`,
      labelEn: `${n} days ago`,
      isYesterday: n === 1,
      isToday: false,
      daysAgo: n,
    };
  }

  // 4. Today (aj / ajke / ajker / today)
  if (/(?:^|[^\p{L}\p{N}])(?:today|todays|current\s*day|আজ|আজকে|আজকের|aj|ajke|ajker|aaj|aajke|aajker|ajk|ajekr)(?:[^\p{L}\p{N}]|$)/iu.test(lower)) {
    const dateStr = getDhakaDateString();
    return {
      dateStr,
      labelBn: 'আজকের',
      labelEn: 'Today',
      isYesterday: false,
      isToday: true,
      daysAgo: 0,
    };
  }

  // 5. ISO Format: YYYY-MM-DD
  const isoMatch = /\b(202\d)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/.exec(lower);
  if (isoMatch) {
    const dateStr = isoMatch[0];
    const todayStr = getDhakaDateString();
    const isToday = dateStr === todayStr;
    const isYesterday = dateStr === getDhakaOffsetDateString(1);
    return {
      dateStr,
      labelBn: `${dateStr} তারিখের`,
      labelEn: dateStr,
      isYesterday,
      isToday,
    };
  }

  // 6. DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = /\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](202\d)\b/.exec(lower);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    const dateStr = `${year}-${month}-${day}`;
    const todayStr = getDhakaDateString();
    return {
      dateStr,
      labelBn: `${dateStr} তারিখের`,
      labelEn: dateStr,
      isYesterday: dateStr === getDhakaOffsetDateString(1),
      isToday: dateStr === todayStr,
    };
  }

  // 7. Day + Month (e.g. "25 October", "25th oct", "২৫ অক্টোবর")
  const dayMonthMatch = /(?:^|[^\p{L}\p{N}])(0?[1-9]|[12]\d|3[01])\s*(?:th|st|nd|rd)?\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|জানুয়ারি|ফেব্রুয়ারি|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট|সেপ্টেম্বর|অক্টোবর|নভেম্বর|ডিসেম্বর)(?:[^\p{L}\p{N}]|$)/iu.exec(lower);
  if (dayMonthMatch) {
    const day = dayMonthMatch[1].padStart(2, '0');
    const mStr = dayMonthMatch[2].toLowerCase();
    const month = MONTH_MAP[mStr];
    if (month) {
      const year = getDhakaDateString().slice(0, 4);
      const dateStr = `${year}-${month}-${day}`;
      return {
        dateStr,
        labelBn: `${dateStr} তারিখের`,
        labelEn: dateStr,
        isYesterday: dateStr === getDhakaOffsetDateString(1),
        isToday: dateStr === getDhakaDateString(),
      };
    }
  }

  // 8. Day only with "tarikh" / "তারিখ" (e.g. "25 tarikh", "২৫ তারিখ")
  const dayTarikhMatch = /(?:^|[^\p{L}\p{N}])(0?[1-9]|[12]\d|3[01])\s*(?:tarikh|tarik|তারিখ|তারিখের|er|এর)(?:[^\p{L}\p{N}]|$)/iu.exec(lower);
  if (dayTarikhMatch) {
    const day = dayTarikhMatch[1].padStart(2, '0');
    const todayStr = getDhakaDateString();
    const [year, month] = todayStr.split('-');
    const dateStr = `${year}-${month}-${day}`;
    return {
      dateStr,
      labelBn: `${day} তারিখের`,
      labelEn: `${dateStr}`,
      isYesterday: dateStr === getDhakaOffsetDateString(1),
      isToday: dateStr === todayStr,
    };
  }

  return null;
}

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
