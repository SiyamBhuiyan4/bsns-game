/**
 * Task quota scheduling.
 *
 * An admin gives an employee a quota of tasks per DAILY, WEEKLY or MONTHLY
 * period, plus the weekdays they are off. Every day this turns into:
 *
 * - mandatory: the even daily share (`floor(quota / working days)`, at least 1),
 *   which must be done today;
 * - normal: the rest of the week's remaining quota, optional today.
 *
 * Doing more than the mandatory share counts toward the week, so later days get
 * lighter. On the last working day of the week everything still remaining
 * becomes mandatory. Example: 8 tasks over a 7-day week -> 1 a day for six days,
 * and 2 on the last day if the employee did exactly 1 a day.
 *
 * MONTHLY quotas are spread over the month's working days. Each week receives
 * its cumulative share minus what was already done earlier in the month, so a
 * shortfall moves into the next week and the month's last working day closes
 * the full quota. WEEKLY quotas start fresh every week.
 *
 * Weeks run Sunday to Saturday. All dates are Asia/Dhaka calendar days as
 * `yyyy-MM-dd` strings.
 */

export type QuotaPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface QuotaRule {
  period: QuotaPeriod;
  amount: number;
  /** Weekdays off, 0 = Sunday ... 6 = Saturday. */
  offDays: number[];
}

export interface DayRequirement {
  date: string;
  isOffDay: boolean;
  /** First and last day of the window the quota is being closed over. */
  windowStart: string;
  windowEnd: string;
  /** Quota owed over the window, after earlier carry-over (MONTHLY) is applied. */
  windowQuota: number;
  doneBeforeToday: number;
  doneToday: number;
  /** Total mandatory for today, and how much of it is still open. */
  mandatory: number;
  mandatoryLeft: number;
  /** Optional work available today: the rest of the window's quota. */
  normal: number;
  normalLeft: number;
  /** Everything still owed in the window, counting today's progress. */
  remaining: number;
  workingDaysLeft: number;
  isLastWorkingDay: boolean;
  /** Even share per working day before any carry-over. */
  dailyBase: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtc(date: string): number {
  return Date.parse(date + 'T00:00:00Z');
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function addDays(date: string, n: number): string {
  return fromUtc(toUtc(date) + n * DAY_MS);
}

function weekday(date: string): number {
  return new Date(toUtc(date)).getUTCDay();
}

function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let ms = toUtc(start); ms <= toUtc(end); ms += DAY_MS) out.push(fromUtc(ms));
  return out;
}

function weekBounds(date: string): { start: string; end: string } {
  const start = addDays(date, -weekday(date));
  return { start, end: addDays(start, 6) };
}

function monthBounds(date: string): { start: string; end: string } {
  const [y, m] = date.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, '0')}` };
}

function sumDone(done: Record<string, number>, dates: string[]): number {
  return dates.reduce((acc, d) => acc + (done[d] ?? 0), 0);
}

/** The even per-day share. At least one a day, so small quotas are front-loaded. */
function baseShare(quota: number, workingDays: number): number {
  if (quota <= 0 || workingDays <= 0) return 0;
  return Math.max(1, Math.floor(quota / workingDays));
}

/**
 * Today's requirement under a quota rule.
 *
 * @param doneByDate completed tasks per Dhaka date (undone ones excluded)
 */
export function dayRequirement(rule: QuotaRule, today: string, doneByDate: Record<string, number>): DayRequirement {
  const amount = Math.max(0, Math.floor(rule.amount));
  const off = new Set(rule.offDays.filter((d) => d >= 0 && d <= 6));
  const isWorking = (d: string) => !off.has(weekday(d));
  const isOffDay = !isWorking(today);
  const doneToday = doneByDate[today] ?? 0;

  let windowStart: string;
  let windowEnd: string;
  let windowQuota: number;
  let dailyBase: number;

  if (rule.period === 'DAILY') {
    windowStart = windowEnd = today;
    windowQuota = isOffDay ? 0 : amount;
    dailyBase = windowQuota;
  } else if (rule.period === 'WEEKLY') {
    ({ start: windowStart, end: windowEnd } = weekBounds(today));
    const working = daysBetween(windowStart, windowEnd).filter(isWorking);
    windowQuota = amount;
    dailyBase = baseShare(amount, working.length);
  } else {
    const month = monthBounds(today);
    const week = weekBounds(today);
    windowStart = week.start > month.start ? week.start : month.start;
    windowEnd = week.end < month.end ? week.end : month.end;

    const monthWorking = daysBetween(month.start, month.end).filter(isWorking);
    const workingThroughWindow = monthWorking.filter((d) => d <= windowEnd).length;
    const owedThroughWindow = monthWorking.length
      ? Math.round((amount * workingThroughWindow) / monthWorking.length)
      : 0;
    const doneEarlierInMonth = sumDone(
      doneByDate,
      daysBetween(month.start, addDays(windowStart, -1)).filter((d) => d >= month.start)
    );
    windowQuota = Math.max(0, owedThroughWindow - doneEarlierInMonth);
    dailyBase = baseShare(amount, monthWorking.length);
  }

  const windowDays = daysBetween(windowStart, windowEnd);
  const workingInWindow = windowDays.filter(isWorking);
  const doneBeforeToday = sumDone(doneByDate, windowDays.filter((d) => d < today));
  const owedFromToday = Math.max(0, windowQuota - doneBeforeToday);
  const workingDaysLeft = workingInWindow.filter((d) => d >= today).length;
  const lastWorking = workingInWindow[workingInWindow.length - 1];
  const isLastWorkingDay = !isOffDay && lastWorking === today;

  let mandatory: number;
  if (isOffDay) mandatory = 0;
  else if (rule.period === 'DAILY' || isLastWorkingDay) mandatory = owedFromToday;
  else mandatory = Math.min(dailyBase, owedFromToday);

  const normal = Math.max(0, owedFromToday - mandatory);
  const mandatoryLeft = Math.max(0, mandatory - doneToday);
  const extraDone = Math.max(0, doneToday - mandatory);
  const normalLeft = Math.max(0, normal - extraDone);

  return {
    date: today,
    isOffDay,
    windowStart,
    windowEnd,
    windowQuota,
    doneBeforeToday,
    doneToday,
    mandatory,
    mandatoryLeft,
    normal,
    normalLeft,
    remaining: Math.max(0, owedFromToday - doneToday),
    workingDaysLeft,
    isLastWorkingDay,
    dailyBase,
  };
}

/** The earliest date whose completions can affect today's requirement. */
export function lookbackStart(rule: QuotaRule, today: string): string {
  if (rule.period === 'DAILY') return today;
  if (rule.period === 'WEEKLY') return weekBounds(today).start;
  return monthBounds(today).start;
}
