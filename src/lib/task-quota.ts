/**
 * Task quota scheduling.
 *
 * An admin assigns an employee an amount of work over a date range (a day, a
 * week, a month or any custom range), plus the weekdays they are off. Every day
 * this turns into:
 *
 * - mandatory: the even daily share (`floor(amount / working days)`, at least 1),
 *   which must be done today;
 * - normal: the rest of the current week's remaining quota, optional today.
 *
 * Doing more than the mandatory share counts toward the week, so later days get
 * lighter. On the last working day of each week everything still owed for that
 * week becomes mandatory. Example: 8 tasks over a 7-day week -> 1 a day for six
 * days, and 2 on the last day if the employee did exactly 1 a day.
 *
 * Ranges longer than a week are split into 7-day weeks counted from the range
 * start. Each week receives its cumulative share of the amount minus what was
 * already done earlier in the range, so a shortfall moves into the next week and
 * the range's last working day closes the full amount.
 *
 * All dates are Asia/Dhaka calendar days as `yyyy-MM-dd` strings.
 */

export interface QuotaRule {
  amount: number;
  /** Weekdays off, 0 = Sunday ... 6 = Saturday. */
  offDays: number[];
  /** First and last day the amount is owed over. A daily target uses today for both. */
  start: string;
  end: string;
}

export interface DayRequirement {
  date: string;
  isOffDay: boolean;
  /** First and last day of the week the quota is being closed over. */
  windowStart: string;
  windowEnd: string;
  /** Quota owed over the week, after carry-over from earlier weeks is applied. */
  windowQuota: number;
  doneBeforeToday: number;
  doneToday: number;
  /** Total mandatory for today, and how much of it is still open. */
  mandatory: number;
  mandatoryLeft: number;
  /** Optional work available today: the rest of the week's quota. */
  normal: number;
  normalLeft: number;
  /** Everything still owed in the week, counting today's progress. */
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

export function addDays(date: string, n: number): string {
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

/** First and last day of the calendar month containing `date`. */
export function monthBounds(date: string): { start: string; end: string } {
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
 * Today's requirement under a quota rule, or null when today is outside its range.
 *
 * @param doneByDate completed work per Dhaka date (undone tasks excluded)
 */
export function dayRequirement(
  rule: QuotaRule,
  today: string,
  doneByDate: Record<string, number>
): DayRequirement | null {
  if (today < rule.start || today > rule.end) return null;

  const amount = Math.max(0, Math.floor(rule.amount));
  const off = new Set(rule.offDays.filter((d) => d >= 0 && d <= 6));
  const isWorking = (d: string) => !off.has(weekday(d));
  const isOffDay = !isWorking(today);
  const doneToday = doneByDate[today] ?? 0;

  // The 7-day week, counted from the range start, that today falls in.
  const weekIndex = Math.floor((toUtc(today) - toUtc(rule.start)) / (7 * DAY_MS));
  const windowStart = addDays(rule.start, weekIndex * 7);
  const weekEnd = addDays(windowStart, 6);
  const windowEnd = weekEnd < rule.end ? weekEnd : rule.end;

  const rangeWorking = daysBetween(rule.start, rule.end).filter(isWorking);
  const workingThroughWindow = rangeWorking.filter((d) => d <= windowEnd).length;
  const owedThroughWindow = rangeWorking.length
    ? Math.round((amount * workingThroughWindow) / rangeWorking.length)
    : 0;
  const doneEarlierInRange =
    windowStart > rule.start ? sumDone(doneByDate, daysBetween(rule.start, addDays(windowStart, -1))) : 0;
  const windowQuota = Math.max(0, owedThroughWindow - doneEarlierInRange);
  const dailyBase = baseShare(amount, rangeWorking.length);

  const windowDays = daysBetween(windowStart, windowEnd);
  const workingInWindow = windowDays.filter(isWorking);
  const doneBeforeToday = sumDone(doneByDate, windowDays.filter((d) => d < today));
  const owedFromToday = Math.max(0, windowQuota - doneBeforeToday);
  const workingDaysLeft = workingInWindow.filter((d) => d >= today).length;
  const lastWorking = workingInWindow[workingInWindow.length - 1];
  const isLastWorkingDay = !isOffDay && lastWorking === today;

  let mandatory: number;
  if (isOffDay) mandatory = 0;
  else if (isLastWorkingDay) mandatory = owedFromToday;
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
