import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/lib/prisma';
import { executeDailyLock, executeWeeklyReportDraft, validateCronAuthorization } from '../src/lib/cron';
import { runDailyLock } from '../jobs/daily-lock';
import { runWeeklyReportDraft } from '../jobs/weekly-report-draft';
import { GET as getDailyLock, POST as postDailyLock } from '../src/app/api/cron/daily-lock/route';
import {
  GET as getWeeklyDraft,
  POST as postWeeklyDraft,
} from '../src/app/api/cron/weekly-report-draft/route';
import { GET as getWeeklyReportOld } from '../src/app/api/cron/weekly-report/route';
import { NextRequest } from 'next/server';
import { parseDateOnly } from '../src/lib/date';
import { WEEKLY_FIXED_QUESTIONS } from '../src/lib/reports';
import { ReportStatus } from '@prisma/client';

describe('Scheduled Jobs / Cron Engine (Section 1 and Acceptance Test 18)', () => {
  let testAdminUser: any;
  const testWeekStartStr = '2026-11-01'; // Sunday
  const testWeekEndStr = '2026-11-07';   // Saturday
  // Sunday 09:00 Asia/Dhaka for the subsequent week
  const testSundayExecution = new Date('2026-11-08T09:00:00+06:00');

  const testWeekStartDate = parseDateOnly(testWeekStartStr);
  const testWeekEndDate = parseDateOnly(testWeekEndStr);

  beforeAll(async () => {
    await prisma.$connect();
    // Ensure an admin user exists for created_by relation
    testAdminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!testAdminUser) {
      testAdminUser = await prisma.user.create({
        data: {
          name: 'Cron Test Admin',
          email: 'crontestadmin@test.com',
          password_hash: 'not-used-in-direct-queries',
          role: 'ADMIN',
        },
      });
    }

    // Clean up test reports if exist
    await prisma.weeklyReportAnswer.deleteMany({
      where: {
        report: {
          week_start: { in: [testWeekStartDate, parseDateOnly('2026-10-18')] },
        },
      },
    });
    await prisma.weeklyReport.deleteMany({
      where: {
        week_start: { in: [testWeekStartDate, parseDateOnly('2026-10-18')] },
      },
    });
  }, 30000);

  afterAll(async () => {
    try {
      await prisma.weeklyReportAnswer.deleteMany({
        where: {
          report: {
            week_start: { in: [testWeekStartDate, parseDateOnly('2026-10-18')] },
          },
        },
      });
      await prisma.weeklyReport.deleteMany({
        where: {
          week_start: { in: [testWeekStartDate, parseDateOnly('2026-10-18')] },
        },
      });
      await prisma.auditLog.deleteMany({
        where: {
          entity: 'DAILY_LOCK',
          entity_id: '2026-11-08',
        },
      });
    } finally {
      await prisma.$disconnect();
    }
  }, 30000);

  describe('Weekly Report Draft Generation (Sunday 09:00 Asia/Dhaka Window)', () => {
    it('should create weekly report draft for previous Sunday-Saturday week when triggered on Sunday 09:00', async () => {
      const result = await executeWeeklyReportDraft({
        refDate: testSundayExecution,
        actorId: testAdminUser.id,
      });

      expect(result.success).toBe(true);
      expect(result.created).toBe(true);
      expect(result.week_start).toBe(testWeekStartStr);
      expect(result.week_end).toBe(testWeekEndStr);
      expect(result.status).toBe(ReportStatus.DRAFT);
      expect(result.report_id).toBeDefined();

      // Verify record directly in database
      const savedReport = await prisma.weeklyReport.findUnique({
        where: { week_start: testWeekStartDate },
        include: { answers: { orderBy: { question_no: 'asc' } } },
      });

      expect(savedReport).not.toBeNull();
      expect(savedReport?.status).toBe(ReportStatus.DRAFT);
      expect(savedReport?.auto_data).toBeDefined();
    });

    it('should populate all 5 fixed questions with the required Bengali text', async () => {
      const savedReport = await prisma.weeklyReport.findUnique({
        where: { week_start: testWeekStartDate },
        include: { answers: { orderBy: { question_no: 'asc' } } },
      });

      expect(savedReport?.answers).toHaveLength(5);

      const answers = savedReport!.answers;
      expect(answers[0].question_no).toBe(1);
      expect(answers[0].question_text).toBe('কোন পণ্য সবচেয়ে বেশি বিক্রি হয়েছে?');
      expect(answers[0].answer_text).toBe('');

      expect(answers[1].question_no).toBe(2);
      expect(answers[1].question_text).toBe('কোন বিজ্ঞাপন থেকে সবচেয়ে ভালো মানের ক্রেতা এসেছে?');

      expect(answers[2].question_no).toBe(3);
      expect(answers[2].question_text).toBe('কোন সম্ভাব্য ক্রেতার অর্ডার এখনো সম্পন্ন হয়নি?');

      expect(answers[3].question_no).toBe(4);
      expect(answers[3].question_text).toBe('কোন পণ্যের স্টক, মূল্য, সরবরাহ বা গ্রাহকসেবার সমস্যা বিক্রিতে বাধা দিচ্ছে?');

      expect(answers[4].question_no).toBe(5);
      expect(answers[4].question_text).toBe('পরবর্তী সপ্তাহে কোন তিনটি কাজ বিক্রি ও লাভ বৃদ্ধিতে সবচেয়ে বেশি সাহায্য করবে?');

      // Also ensure match with WEEKLY_FIXED_QUESTIONS
      WEEKLY_FIXED_QUESTIONS.forEach((q, idx) => {
        expect(answers[idx].question_no).toBe(q.no);
        expect(answers[idx].question_text).toBe(q.text);
      });
    });

    it('should NOT create duplicate draft if one already exists for that week', async () => {
      // Re-run for the exact same Sunday execution
      const secondRun = await executeWeeklyReportDraft({
        refDate: testSundayExecution,
        actorId: testAdminUser.id,
      });

      expect(secondRun.success).toBe(true);
      expect(secondRun.created).toBe(false);
      expect(secondRun.message).toContain('already exists');

      // Verify database still only has 1 report for this week
      const totalForWeek = await prisma.weeklyReport.count({
        where: { week_start: testWeekStartDate },
      });
      expect(totalForWeek).toBe(1);
    });
  });

  describe('Daily Lock Job (Asia/Dhaka 23:59 Boundary)', () => {
    it('should find yesterday/today boundaries in Asia/Dhaka, validate lock status, and log audit event', async () => {
      const refDate = new Date('2026-11-08T23:59:00+06:00'); // 23:59 in Dhaka
      const result = await executeDailyLock({
        refDate,
        actorId: testAdminUser.id,
      });

      expect(result.success).toBe(true);
      expect(result.todayDhaka).toBe('2026-11-08');
      expect(result.yesterdayDhaka).toBe('2026-11-07');
      expect(result.editWindowDays).toBeGreaterThanOrEqual(1);
      expect(result.oldestAllowedDhaka).toBe('2026-11-07');
      expect(result.auditLogId).toBeDefined();

      // Verify audit log entry in database
      const auditLog = await prisma.auditLog.findUnique({
        where: { id: result.auditLogId! },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.entity).toBe('DAILY_LOCK');
      expect(auditLog?.entity_id).toBe('2026-11-08');
      expect(auditLog?.action).toBe('UPDATE');

      const payload = auditLog?.payload as any;
      expect(payload?.event).toBe('END_OF_DAY_LOCK');
      expect(payload?.date).toBe('2026-11-08');
      expect(payload?.yesterday).toBe('2026-11-07');
    });
  });

  describe('Standalone Jobs Execution (jobs/*.ts wrappers)', () => {
    it('should execute runDailyLock wrapper successfully', async () => {
      const result = await runDailyLock({
        refDate: new Date('2026-11-08T23:59:00+06:00'),
        actorId: testAdminUser.id,
      });
      expect(result.success).toBe(true);
      expect(result.todayDhaka).toBe('2026-11-08');
    });

    it('should execute runWeeklyReportDraft wrapper successfully', async () => {
      const result = await runWeeklyReportDraft({
        refDate: testSundayExecution,
        actorId: testAdminUser.id,
      });
      expect(result.success).toBe(true);
      // Already created in previous test, so created is false
      expect(result.created).toBe(false);
      expect(result.week_start).toBe(testWeekStartStr);
    });
  });

  describe('API Endpoints & CRON_SECRET Authorization Security', () => {
    const validSecret = process.env.CRON_SECRET || 'cron-secret-key';

    describe('GET & POST /api/cron/daily-lock', () => {
      it('should reject unauthorized requests without Authorization header (401)', async () => {
        const reqGet = new NextRequest('http://localhost:3000/api/cron/daily-lock');
        const resGet = await getDailyLock(reqGet);
        expect(resGet.status).toBe(401);

        const dataGet = await resGet.json();
        expect(dataGet.error).toBe('Unauthorized');

        const reqPost = new NextRequest('http://localhost:3000/api/cron/daily-lock', {
          method: 'POST',
        });
        const resPost = await postDailyLock(reqPost);
        expect(resPost.status).toBe(401);
      });

      it('should reject requests with invalid Bearer token (401)', async () => {
        const req = new NextRequest('http://localhost:3000/api/cron/daily-lock', {
          headers: { authorization: 'Bearer wrong-secret-token' },
        });
        const res = await getDailyLock(req);
        expect(res.status).toBe(401);
      });

      it('should allow authorized requests with valid CRON_SECRET (200) via GET and POST', async () => {
        const reqGet = new NextRequest(
          'http://localhost:3000/api/cron/daily-lock?date=2026-11-08T23:59:00%2B06:00',
          {
            headers: { authorization: `Bearer ${validSecret}` },
          }
        );
        const resGet = await getDailyLock(reqGet);
        expect(resGet.status).toBe(200);

        const dataGet = await resGet.json();
        expect(dataGet.success).toBe(true);
        expect(dataGet.todayDhaka).toBe('2026-11-08');

        const reqPost = new NextRequest(
          'http://localhost:3000/api/cron/daily-lock?date=2026-11-08T23:59:00%2B06:00',
          {
            method: 'POST',
            headers: { authorization: `Bearer ${validSecret}` },
          }
        );
        const resPost = await postDailyLock(reqPost);
        expect(resPost.status).toBe(200);
      });
    });

    describe('GET & POST /api/cron/weekly-report-draft', () => {
      it('should reject unauthorized requests without Authorization header (401)', async () => {
        const req = new NextRequest('http://localhost:3000/api/cron/weekly-report-draft');
        const res = await getWeeklyDraft(req);
        expect(res.status).toBe(401);

        const reqPost = new NextRequest('http://localhost:3000/api/cron/weekly-report-draft', {
          method: 'POST',
        });
        const resPost = await postWeeklyDraft(reqPost);
        expect(resPost.status).toBe(401);
      });

      it('should reject requests with invalid Bearer token (401)', async () => {
        const req = new NextRequest('http://localhost:3000/api/cron/weekly-report-draft', {
          headers: { authorization: 'Bearer invalid-token-xyz' },
        });
        const res = await getWeeklyDraft(req);
        expect(res.status).toBe(401);
      });

      it('should allow authorized requests with valid CRON_SECRET (200) via GET and POST', async () => {
        const reqGet = new NextRequest(
          'http://localhost:3000/api/cron/weekly-report-draft?date=2026-11-08T09:00:00%2B06:00',
          {
            headers: { authorization: `Bearer ${validSecret}` },
          }
        );
        const resGet = await getWeeklyDraft(reqGet);
        expect(resGet.status).toBe(200);

        const dataGet = await resGet.json();
        expect(dataGet.success).toBe(true);
        expect(dataGet.week_start).toBe(testWeekStartStr);
        expect(dataGet.week_end).toBe(testWeekEndStr);

        const reqPost = new NextRequest(
          'http://localhost:3000/api/cron/weekly-report-draft?date=2026-11-08T09:00:00%2B06:00',
          {
            method: 'POST',
            headers: { authorization: `Bearer ${validSecret}` },
          }
        );
        const resPost = await postWeeklyDraft(reqPost);
        expect(resPost.status).toBe(200);
      });
    });

    describe('Backward compatibility: /api/cron/weekly-report', () => {
      it('should reject unauthorized access (401) and allow authorized access (200)', async () => {
        const unauthReq = new NextRequest('http://localhost:3000/api/cron/weekly-report');
        const unauthRes = await getWeeklyReportOld(unauthReq);
        expect(unauthRes.status).toBe(401);

        const authReq = new NextRequest('http://localhost:3000/api/cron/weekly-report', {
          headers: { authorization: `Bearer ${validSecret}` },
        });
        const authRes = await getWeeklyReportOld(authReq);
        expect(authRes.status).toBe(200);
      });
    });
  });
});
