import { getDhakaDateString, getDhakaOffsetDateString } from '@/lib/date';

const MONTH_MAP: Record<string, string> = {
  jan: '01', january: '01', januari: '01', 'জানুয়ারি': '01', 'জানুয়ারি': '01',
  feb: '02', february: '02', februari: '02', 'ফেব্রুয়ারি': '02', 'ফেব্রুয়ারি': '02',
  mar: '03', march: '03', 'মার্চ': '03',
  apr: '04', april: '04', 'এপ্রিল': '04',
  may: '05', 'মে': '05',
  jun: '06', june: '06', 'জুন': '06',
  jul: '07', july: '07', 'জুলাই': '07',
  aug: '08', august: '08', 'আগস্ট': '08', 'আগষ্ট': '08',
  sep: '09', sept: '09', september: '09', 'সেপ্টেম্বর': '09',
  oct: '10', october: '10', aktober: '10', 'অক্টোবর': '10',
  nov: '11', november: '11', nobembor: '11', nobember: '11', 'নভেম্বর': '11',
  dec: '12', december: '12', disembor: '12', disember: '12', 'ডিসেম্বর': '12',
};

const MONTH_NAMES_PATTERN =
  'jan(?:uary|uari)?|feb(?:ruary|ruari)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|aktober|nov(?:ember)?|nobembor|nobember|dec(?:ember)?|disembor|disember|জানুয়ারি|জানুয়ারি|ফেব্রুয়ারি|ফেব্রুয়ারি|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট|আগষ্ট|সেপ্টেম্বর|অক্টোবর|নভেম্বর|ডিসেম্বর';

/**
 * Resolves natural language date inputs (English, Bengali, Banglish) or formatted date strings
 * into a standard "YYYY-MM-DD" date in the Asia/Dhaka timezone.
 *
 * Supported inputs:
 * - Offset 1: "kalker", "kalke", "yesterday", "গতকাল", "ager din", "কালকে"
 * - Offset 0: "ajker", "aj", "today", "আজ", "আজকে", "current day"
 * - Offset 2: "poroshur", "poroshu", "day before yesterday", "গত পরশু", "dui din age"
 * - Offset N: "3 days ago", "৩ দিন আগে", "5 din age"
 * - Formatted dates: "2026-10-28", "28 oct", "oct 28", "28/10/2026", "28/10", "২৮ অক্টোবর", "28 tarikh"
 */
export function resolveDateString(input?: string | null): string {
  const todayDhaka = getDhakaDateString();
  if (!input || typeof input !== 'string' || !input.trim()) {
    return todayDhaka;
  }

  // 1. Convert Bengali numerals (০-৯) to ASCII digits (0-9)
  const normalized = input.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6)).trim();
  const lower = normalized.toLowerCase();

  const [currentYearStr, currentMonthStr] = todayDhaka.split('-');

  // 2. Relative: Day before yesterday (offset 2)
  if (
    /(?:^|[^\p{L}\p{N}])(?:day\s*before\s*yesterday|2\s*days?\s*ago|two\s*days?\s*ago|পরশু|পরশুর|গত\s*পরশু|গতপরশু|poroshu|poroshur|parshu|parshur|gotoporoshu|goto\s*poroshu|2\s*din\s*age|dui\s*din\s*age|২\s*দিন\s*আগে|দুই\s*দিন\s*আগে)(?:[^\p{L}\p{N}]|$)/iu.test(
      lower
    )
  ) {
    return getDhakaOffsetDateString(2);
  }

  // 3. Relative: N days ago / N din age / N দিন আগে
  const nDaysMatch = /(\d+)\s*(?:din|দিন|days?)\s*(?:ago|age|ager|আগে|আগের)/iu.exec(lower);
  if (nDaysMatch) {
    const n = Math.min(Math.max(parseInt(nDaysMatch[1], 10), 0), 365);
    return getDhakaOffsetDateString(n);
  }

  // 4. Relative: Yesterday (offset 1)
  if (
    /(?:^|[^\p{L}\p{N}])(?:yesterday|yesterdays|last\s*day|previous\s*day|কালকের|কালকে|কালকার|গতকাল|গত\s*কাল|গতকালকের|গতকালকার|kalker|kalke|kal\s*ke|kalkar|kalkr|gotokal|gotokaler|ager\s*din|ager\s*diner|prev\s*day|kalekr|klaker)(?:[^\p{L}\p{N}]|$)/iu.test(
      lower
    )
  ) {
    return getDhakaOffsetDateString(1);
  }

  // 5. Relative: Today (offset 0)
  if (
    /(?:^|[^\p{L}\p{N}])(?:today|todays|current\s*day|আজ|আজকে|আজকের|aj|ajke|ajker|aaj|aajke|aajker|ajk|ajekr)(?:[^\p{L}\p{N}]|$)/iu.test(
      lower
    )
  ) {
    return todayDhaka;
  }

  // 6. Explicit ISO Format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = /\b(20\d\d)[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/.exec(lower);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 7. Explicit DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY
  const dmyMatch = /\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d\d|\d{2})\b/.exec(lower);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    let y = dmyMatch[3];
    if (y.length === 2) {
      y = `20${y}`;
    }
    return `${y}-${m}-${d}`;
  }

  // 8. Day + Month Name (+ optional Year), e.g. "28 oct", "28th october 2026", "২৮ অক্টোবর"
  const dayMonthRegex = new RegExp(
    `(?:^|[^\\p{L}\\p{N}])(0?[1-9]|[12]\\d|3[01])\\s*(?:th|st|nd|rd|শে|ই|এ)?\\s*(${MONTH_NAMES_PATTERN})(?:\\s*[,/]?\\s*(20\\d\\d))?(?:[^\\p{L}\\p{N}]|$)`,
    'iu'
  );
  const dmMatch = dayMonthRegex.exec(lower);
  if (dmMatch) {
    const d = dmMatch[1].padStart(2, '0');
    const m = MONTH_MAP[dmMatch[2].toLowerCase()];
    const y = dmMatch[3] || currentYearStr;
    if (m) {
      return `${y}-${m}-${d}`;
    }
  }

  // 9. Month Name + Day (+ optional Year), e.g. "oct 28", "october 28, 2026", "অক্টোবর ২৮"
  const monthDayRegex = new RegExp(
    `(?:^|[^\\p{L}\\p{N}])(${MONTH_NAMES_PATTERN})\\s*(0?[1-9]|[12]\\d|3[01])(?:th|st|nd|rd|শে|ই|এ)?(?:\\s*[,/]?\\s*(20\\d\\d))?(?:[^\\p{L}\\p{N}]|$)`,
    'iu'
  );
  const mdMatch = monthDayRegex.exec(lower);
  if (mdMatch) {
    const m = MONTH_MAP[mdMatch[1].toLowerCase()];
    const d = mdMatch[2].padStart(2, '0');
    const y = mdMatch[3] || currentYearStr;
    if (m) {
      return `${y}-${m}-${d}`;
    }
  }

  // 10. DD/MM or DD-MM (without year, defaults to current Dhaka year)
  const dmShortMatch = /\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])\b/.exec(lower);
  if (dmShortMatch) {
    const d = dmShortMatch[1].padStart(2, '0');
    const m = dmShortMatch[2].padStart(2, '0');
    return `${currentYearStr}-${m}-${d}`;
  }

  // 11. Day only with "tarikh" / "তারিখ" (e.g. "28 tarikh", "২৮ তারিখ")
  const dayTarikhMatch = /(?:^|[^\p{L}\p{N}])(0?[1-9]|[12]\d|3[01])\s*(?:tarikh|tarik|তারিখ|তারিখের|er|এর)(?:[^\p{L}\p{N}]|$)/iu.exec(lower);
  if (dayTarikhMatch) {
    const d = dayTarikhMatch[1].padStart(2, '0');
    return `${currentYearStr}-${currentMonthStr}-${d}`;
  }

  return todayDhaka;
}
