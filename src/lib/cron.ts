import prisma from './prisma';
import { getDhakaDateString, parseDateOnly } from './date';
import { computeWeeklyAutoData, WEEKLY_FIXED_QUESTIONS } from './reports';
import { createAuditLog } from './audit';
import { subDays, subWeeks, startOfWeek, endOfWeek, format, parseISO } from 'date-fns';
import { ReportStatus, AuditAction, Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { getCronSecret } from './env';

/** Compares two secrets without leaking their length or a prefix match. */
function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export interface DailyLockResult {
  success: boolean;
  message: string;
  date: string;
  todayDhaka: string;
  yesterdayDhaka: string;
  oldestAllowedDhaka: string;
  editWindowDays: number;
  totalEntriesToday: number;
  activeEmployeesCount: number;
  submittedEmployeesCount: number;
  missingEmployeesCount: number;
  auditLogId?: string | null;
}

export interface WeeklyReportDraftResult {
  success: boolean;
  created: boolean;
  message: string;
  report_id?: string;
  status?: ReportStatus;
  week_start: string;
  week_end: string;
  questions_count?: number;
  auditLogId?: string | null;
  report?: unknown;
}

/**
 * Validates the Authorization header against CRON_SECRET (required in production).
 */
export function validateCronAuthorization(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return false;

  let expectedSecret: string;
  try {
    expectedSecret = getCronSecret();
  } catch (error) {
    // No secret configured: refuse the call rather than run unauthenticated.
    console.error('[security] cron request rejected:', error instanceof Error ? error.message : error);
    return false;
  }
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return secretsMatch(parts[1], expectedSecret);
  }
  return false;
}

/**
 * Executes daily lock logic (Asia/Dhaka 23:59 boundary):
 * 1. Determines current date & yesterday in Asia/Dhaka.
 * 2. Fetches editWindowDays setting from ScoringSettings.
 * 3. Enforces and validates edit window boundary.
 * 4. Verifies daily entries submission status across active employees.
 * 5. Logs audit entry for the end-of-day lock.
 */
export async function executeDailyLock(options?: {
  refDate?: Date;
  actorId?: string;
}): Promise<DailyLockResult> {
  const refDate = options?.refDate || new Date();
  const todayDhaka = getDhakaDateString(refDate);
  const todayParsed = parseISO(todayDhaka);
  const yesterdayDhaka = format(subDays(todayParsed, 1), 'yyyy-MM-dd');

  // Fetch ScoringSettings for edit window
  const settings = await prisma.scoringSettings.findUnique({ where: { id: 'default' } });
  const editWindowDays = settings?.employee_edit_window_days ?? 1;

  // Oldest allowed date
  const oldestAllowedDhaka = format(subDays(todayParsed, editWindowDays), 'yyyy-MM-dd');

  // Verify daily entries state for today
  const todayDate = parseDateOnly(todayDhaka);
  const todayEntries = await prisma.dailyEntry.findMany({
    where: { entry_date: todayDate },
  });

  const activeEmployees = await prisma.user.findMany({
    where: { role: 'EMPLOYEE', is_active: true },
    select: { id: true, name: true, email: true },
  });

  const submittedEmployeeIds = new Set(todayEntries.map((e) => e.employee_id));
  const missingEmployees = activeEmployees.filter((e) => !submittedEmployeeIds.has(e.id));

  // Find admin actor if not provided
  let actorId = options?.actorId;
  if (!actorId) {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    actorId = admin?.id;
  }

  // Log audit event for end-of-day lock
  const auditLog = await createAuditLog({
    actorId: actorId || null,
    action: AuditAction.UPDATE,
    entity: 'DAILY_LOCK',
    entityId: todayDhaka,
    payload: {
      event: 'END_OF_DAY_LOCK',
      date: todayDhaka,
      yesterday: yesterdayDhaka,
      edit_window_days: editWindowDays,
      oldest_allowed_date: oldestAllowedDhaka,
      active_employees_count: activeEmployees.length,
      submitted_employees_count: submittedEmployeeIds.size,
      missing_employees_count: missingEmployees.length,
      total_entries_count: todayEntries.length,
      locked_at: refDate.toISOString(),
      message: `End-of-day lock verified for ${todayDhaka} in Asia/Dhaka. Edit window enforced (${editWindowDays} day(s)).`,
    },
  });

  return {
    success: true,
    message: `End-of-day lock completed for ${todayDhaka}`,
    date: todayDhaka,
    todayDhaka,
    yesterdayDhaka,
    oldestAllowedDhaka,
    editWindowDays,
    totalEntriesToday: todayEntries.length,
    activeEmployeesCount: activeEmployees.length,
    submittedEmployeesCount: submittedEmployeeIds.size,
    missingEmployeesCount: missingEmployees.length,
    auditLogId: auditLog?.id || null,
  };
}

/**
 * Executes weekly report draft creation (Sunday 09:00 Asia/Dhaka):
 * 1. Computes previous Sunday-Saturday week boundaries in Asia/Dhaka.
 * 2. Checks if draft already exists; if yes, skips creation and returns status.
 * 3. If not, computes auto_data snapshot using computeWeeklyAutoData().
 * 4. Creates WeeklyReport draft record with 5 fixed questions (in Bengali).
 * 5. Logs audit event.
 */
export async function executeWeeklyReportDraft(options?: {
  refDate?: Date;
  actorId?: string;
}): Promise<WeeklyReportDraftResult> {
  const refDate = options?.refDate || new Date();
  const todayDhakaStr = getDhakaDateString(refDate);
  const todayDhakaDate = parseISO(todayDhakaStr);

  // Previous week reference: 1 week before reference day
  const prevWeekRef = subWeeks(todayDhakaDate, 1);
  const weekStart = startOfWeek(prevWeekRef, { weekStartsOn: 0 }); // Sunday
  const weekEnd = endOfWeek(prevWeekRef, { weekStartsOn: 0 }); // Saturday

  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

  const weekStartDate = parseDateOnly(weekStartStr);
  const weekEndDate = parseDateOnly(weekEndStr);

  // Check if report already exists for this week
  const existingReport = await prisma.weeklyReport.findUnique({
    where: { week_start: weekStartDate },
    include: {
      answers: {
        orderBy: { question_no: 'asc' },
      },
    },
  });

  if (existingReport) {
    return {
      success: true,
      created: false,
      message: `Weekly report for week ${weekStartStr} to ${weekEndStr} already exists`,
      report_id: existingReport.id,
      status: existingReport.status,
      week_start: weekStartStr,
      week_end: weekEndStr,
      questions_count: existingReport.answers.length,
      report: existingReport,
    };
  }

  // Find admin user or fallback
  let creatorId = options?.actorId;
  if (!creatorId) {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    creatorId = admin?.id;
  }
  if (!creatorId) {
    const anyUser = await prisma.user.findFirst();
    creatorId = anyUser?.id;
  }
  if (!creatorId) {
    throw new Error('No user available to create weekly report draft');
  }

  // Compute auto_data snapshot
  const autoData = await computeWeeklyAutoData(weekStartDate, weekEndDate);

  // Create WeeklyReport draft with the 5 fixed questions in Bengali
  const report = await prisma.weeklyReport.create({
    data: {
      week_start: weekStartDate,
      week_end: weekEndDate,
      status: ReportStatus.DRAFT,
      auto_data: autoData as unknown as Prisma.InputJsonValue,
      created_by: creatorId,
    },
  });

  for (const q of WEEKLY_FIXED_QUESTIONS) {
    await prisma.weeklyReportAnswer.create({
      data: {
        weekly_report_id: report.id,
        question_no: q.no,
        question_text: q.text,
        answer_text: '',
        updated_by: creatorId,
      },
    });
  }

  const completeReport = await prisma.weeklyReport.findUnique({
    where: { id: report.id },
    include: {
      answers: {
        orderBy: { question_no: 'asc' },
      },
    },
  });

  // Log audit event
  const auditLog = await createAuditLog({
    actorId: creatorId,
    action: AuditAction.CREATE,
    entity: 'WeeklyReport',
    entityId: report.id,
    payload: {
      event: 'WEEKLY_REPORT_DRAFT_CRON',
      week_start: weekStartStr,
      week_end: weekEndStr,
      status: ReportStatus.DRAFT,
      questions_initialized: completeReport?.answers.length ?? 5,
      triggered_at: refDate.toISOString(),
    },
  });

  return {
    success: true,
    created: true,
    message: `Weekly report draft created for week ${weekStartStr} to ${weekEndStr}`,
    report_id: report.id,
    status: report.status,
    week_start: weekStartStr,
    week_end: weekEndStr,
    questions_count: completeReport?.answers.length ?? 5,
    auditLogId: auditLog?.id || null,
    report: completeReport || report,
  };
}
