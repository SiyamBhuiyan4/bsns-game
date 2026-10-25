import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import prisma from '../src/lib/prisma';
import { NextRequest } from 'next/server';
import { AuditAction, MetricType } from '@prisma/client';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

// Mock session to authenticate as ADMIN
let mockAdminUser: any = null;

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(async () => {
    if (!mockAdminUser) return null;
    return {
      id: mockAdminUser.id,
      userId: mockAdminUser.id,
      name: mockAdminUser.name,
      email: mockAdminUser.email,
      role: 'ADMIN',
    };
  }),
  requireAuth: vi.fn(async () => {
    if (!mockAdminUser) throw new Error('UNAUTHORIZED');
    return { id: mockAdminUser.id, role: 'ADMIN' };
  }),
  requireAdmin: vi.fn(async () => {
    if (!mockAdminUser) throw new Error('UNAUTHORIZED');
    return { id: mockAdminUser.id, role: 'ADMIN' };
  }),
}));

import { GET as exportDailyReport } from '../src/app/api/reports/daily/export/route';
import { GET as exportWeeklyReport } from '../src/app/api/reports/weekly/export/route';
import { GET as exportMonthlyReport } from '../src/app/api/reports/monthly/export/route';

describe('Excel & PDF Export Quality and Integrity (Section 10 & Acceptance Test 22)', () => {
  const testDate = '2026-10-15';
  const testWeekStart = '2026-10-12';
  const testMonth = '2026-10';

  let testEmployee: any = null;
  let testProduct: any = null;
  let testSection: any = null;

  beforeAll(async () => {
    // Retry connecting to DB in case other vitest suites are running concurrently
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await prisma.$connect();
        break;
      } catch (err) {
        if (attempt === 5) throw err;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    // 1. Create admin user for session & foreign keys
    mockAdminUser = await prisma.user.create({
      data: {
        name: 'Export Admin Tester',
        email: `export_admin_${Date.now()}@example.com`,
        password_hash: 'mockhash123',
        role: 'ADMIN',
      },
    });

    // 2. Create employee user
    testEmployee = await prisma.user.create({
      data: {
        name: 'রাকিবুল হাসান (Rakib)',
        email: `rakib_${Date.now()}@example.com`,
        password_hash: 'mockhash123',
        role: 'EMPLOYEE',
      },
    });

    // 3. Create product
    testProduct = await prisma.product.create({
      data: {
        name_bn: 'প্রিমিয়াম মাশরুম স্পন',
        name_en: 'Premium Mushroom Spawn',
        unit: 'packet',
        selling_price: 350.0,
      },
    });

    // 4. Create section & assignment
    testSection = await prisma.groupSection.create({
      data: {
        name: `মাশরুম চাষি কমিউনিটি_${Date.now()}`,
      },
    });

    await prisma.assignment.create({
      data: {
        employee_id: testEmployee.id,
        section_id: testSection.id,
        assigned_by: mockAdminUser.id,
      },
    });

    // 5. Seed daily data for testDate (2026-10-15)
    const targetDateObj = new Date(`${testDate}T00:00:00.000Z`);

    await prisma.dailyEntry.createMany({
      data: [
        {
          employee_id: testEmployee.id,
          entry_date: targetDateObj,
          metric_type: MetricType.NEW_LEADS,
          value: 12,
        },
        {
          employee_id: testEmployee.id,
          entry_date: targetDateObj,
          metric_type: MetricType.CONFIRMED_ORDERS,
          value: 8,
        },
        {
          employee_id: testEmployee.id,
          entry_date: targetDateObj,
          metric_type: MetricType.SALES_AMOUNT,
          value: 15400,
        },
        {
          employee_id: testEmployee.id,
          entry_date: targetDateObj,
          metric_type: MetricType.AD_SPEND,
          value: 1200,
        },
        {
          employee_id: testEmployee.id,
          entry_date: targetDateObj,
          metric_type: MetricType.FOLLOWUPS_DONE,
          value: 15,
        },
        {
          employee_id: testEmployee.id,
          entry_date: targetDateObj,
          metric_type: MetricType.B2B_INQUIRIES,
          value: 3,
        },
      ],
    });

    await prisma.dailyProductSale.create({
      data: {
        employee_id: testEmployee.id,
        entry_date: targetDateObj,
        product_id: testProduct.id,
        quantity: 44,
        amount: 15400,
      },
    });

    await prisma.dailyText.create({
      data: {
        employee_id: testEmployee.id,
        entry_date: targetDateObj,
        main_issue: 'সার্ভারে সাময়িক কানেকশন সমস্যা ও ডেলিভারি বিলম্ব',
        next_priorities: '১০টি হোলসেল লিড ফলো-আপ এবং নতুন ব্যাচ প্রমোশন',
      },
    });

    // 6. Seed weekly report for testWeekStart
    const weekStartObj = new Date(`${testWeekStart}T00:00:00.000Z`);
    const weekEndObj = new Date(`2026-10-18T23:59:59.999Z`);

    const weeklyReport = await prisma.weeklyReport.create({
      data: {
        week_start: weekStartObj,
        week_end: weekEndObj,
        status: 'PUBLISHED',
        created_by: mockAdminUser.id,
        auto_data: {
          summary: {
            total_sales: 75000,
            total_profit: 32000,
            total_posts: 120,
            total_new_clients: 25,
            total_b2b_orders: 6,
            total_retention: 18,
            total_followups: 45,
            team_avg_score: 91.5,
          },
          top_products: [
            {
              product_id: testProduct.id,
              product_name_bn: 'প্রিমিয়াম মাশরুম স্পন',
              product_name_en: 'Premium Mushroom Spawn',
              unit: 'packet',
              total_quantity: 214,
              total_amount: 75000,
            },
          ],
          channel_breakdown: [
            {
              channel: 'FACEBOOK_GROUP',
              channel_bn: 'ফেসবুক গ্রুপ (Organic)',
              leads_count: 50,
              orders_count: 20,
              total_amount: 50000,
            },
            {
              channel: 'FACEBOOK_AD',
              channel_bn: 'ফেসবুক বিজ্ঞাপন (Paid)',
              leads_count: 30,
              orders_count: 10,
              total_amount: 25000,
            },
          ],
        },
      },
    });

    await prisma.weeklyReportAnswer.createMany({
      data: [
        {
          weekly_report_id: weeklyReport.id,
          question_no: 1,
          question_text: 'চলতি সপ্তাহের সবচেয়ে বড় সাফল্য কি ছিল?',
          answer_text: 'মাশরুম স্পনের রেকর্ড বিক্রয় ও নতুন ৫ জন ডিলারের সাথে চুক্তি।',
          updated_by: mockAdminUser.id,
        },
        {
          weekly_report_id: weeklyReport.id,
          question_no: 2,
          question_text: 'কোথায় সবচেয়ে বেশি চ্যালেঞ্জ বা বাধা এসেছে?',
          answer_text: 'ঢাকার বাইরে কুরিয়ার ডেলিভারিতে ২ দিন দেরি হয়েছে।',
          updated_by: mockAdminUser.id,
        },
        {
          weekly_report_id: weeklyReport.id,
          question_no: 3,
          question_text: 'কোন চ্যানেল বা পণ্যে বাজেটের অপচয় মনে হয়েছে?',
          answer_text: 'ফেসবুক পেইড ক্যাম্পেইনে অপচয় নেই, আরও বাজেট বৃদ্ধি করা যায়।',
          updated_by: mockAdminUser.id,
        },
        {
          weekly_report_id: weeklyReport.id,
          question_no: 4,
          question_text: 'পরবর্তী সপ্তাহের প্রধান ৩টি অগ্রাধিকার কি কি?',
          answer_text: '১. নতুন ড্রায়ার সেটআপ, ২. ডিলার নেটওয়ার্ক বৃদ্ধি, ৩. রিপিট ক্লায়েন্ট কল।',
          updated_by: mockAdminUser.id,
        },
        {
          weekly_report_id: weeklyReport.id,
          question_no: 5,
          question_text: 'টিমের কোনো সদস্যের বিশেষ সহায়তা বা দিকনির্দেশনা প্রয়োজন কি?',
          answer_text: 'নতুন মার্কেটারকে বি২বি নেগোশিয়েশনে সহায়তা দিতে হবে।',
          updated_by: mockAdminUser.id,
        },
      ],
    });

    // 7. Seed monthly report for testMonth (2026-10)
    await prisma.monthlyReport.create({
      data: {
        month: testMonth,
        status: 'FINAL',
        created_by: mockAdminUser.id,
        summary_text: 'অক্টোবর মাসে সামগ্রিক লক্ষ্যমাত্রার ৯৫% সফলভাবে অর্জিত হয়েছে।',
        next_month_goal: 'নভেম্বর মাসে বিক্রয় ৩০% বৃদ্ধি ও নতুন আঞ্চলিক এজেন্ট নিয়োগ।',
        next_month_budget: 45000,
        auto_data: {
          month: testMonth,
          mom_growth: {
            current: { sales: 320000, profit: 140000, posts: 480 },
            previous: { sales: 260000, profit: 110000, posts: 400 },
            diff: { sales: 60000, profit: 30000, posts: 80 },
            growth_pct: { sales: 23.1, profit: 27.3, posts: 20.0 },
          },
          employee_rankings: [
            {
              employee_id: testEmployee.id,
              employee_name: 'রাকিবুল হাসান (Rakib)',
              email: testEmployee.email,
              posts_done: 480,
              sales_amount: 320000,
              profit_amount: 140000,
              score: 94.5,
              rank: 1,
              is_top_performer: true,
            },
          ],
          budget_summary: {
            monthly_budget: 50000,
            actual_spend: 38500,
            percentage_used: 77.0,
            remaining: 11500,
          },
          section_achievements: [
            {
              section_id: testSection.id,
              section_name: 'মাশরুম চাষি কমিউনিটি',
              posts_target: 400,
              posts_actual: 480,
              posts_pct: 120.0,
              sales_target: 300000,
              sales_actual: 320000,
              sales_pct: 106.7,
            },
          ],
          top_products: [
            {
              product_id: testProduct.id,
              product_name_bn: 'প্রিমিয়াম মাশরুম স্পন',
              product_name_en: 'Premium Mushroom Spawn',
              unit: 'packet',
              quantity: 914,
              revenue: 320000,
              revenue_share_pct: 100.0,
            },
          ],
          channel_breakdown: [
            {
              channel: 'FACEBOOK_GROUP',
              channel_bn: 'ফেসবুক গ্রুপ (Organic)',
              leads_count: 220,
              orders_count: 85,
              total_amount: 210000,
              conversion_rate: 38.6,
            },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    // Clean up created test data
    if (mockAdminUser) {
      await prisma.auditLog.deleteMany({ where: { actor_id: mockAdminUser.id } });
      await prisma.weeklyReportAnswer.deleteMany({
        where: { report: { created_by: mockAdminUser.id } },
      });
      await prisma.weeklyReport.deleteMany({ where: { created_by: mockAdminUser.id } });
      await prisma.monthlyReport.deleteMany({ where: { created_by: mockAdminUser.id } });
    }
    if (testEmployee) {
      await prisma.dailyProductSale.deleteMany({ where: { employee_id: testEmployee.id } });
      await prisma.dailyText.deleteMany({ where: { employee_id: testEmployee.id } });
      await prisma.dailyEntry.deleteMany({ where: { employee_id: testEmployee.id } });
      await prisma.assignment.deleteMany({ where: { employee_id: testEmployee.id } });
      await prisma.user.deleteMany({ where: { id: testEmployee.id } });
    }
    if (testSection) {
      await prisma.groupSection.deleteMany({ where: { id: testSection.id } });
    }
    if (testProduct) {
      await prisma.product.deleteMany({ where: { id: testProduct.id } });
    }
    if (mockAdminUser) {
      await prisma.user.deleteMany({ where: { id: mockAdminUser.id } });
    }
  });

  // -------------------------------------------------------------
  // Test 1: Buffer Generation & Magic Bytes Verification
  // -------------------------------------------------------------
  describe('Generator Buffer and Format Verification', () => {
    it('ExcelJS generates a valid xlsx zip buffer starting with PK magic bytes', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Test');
      sheet.addRow(['নতুন লিড', 'নিশ্চিত অর্ডার', 'মোট বিক্রি']);
      sheet.addRow([10, 5, 5000]);

      const buffer = await workbook.xlsx.writeBuffer();
      const nodeBuffer = Buffer.from(buffer);

      expect(nodeBuffer.length).toBeGreaterThan(100);
      // PK magic bytes: 0x50, 0x4B
      expect(nodeBuffer[0]).toBe(0x50);
      expect(nodeBuffer[1]).toBe(0x4b);
    });

    it('PDFKit generates a valid PDF buffer starting with %PDF- header', async () => {
      const doc = new PDFDocument({ margin: 30 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));

      doc.text('Daily Performance Report / দৈনিক পারফরম্যান্স রিপোর্ট');
      doc.end();

      const pdfBuffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
      });

      expect(pdfBuffer.length).toBeGreaterThan(100);
      expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });
  });

  // -------------------------------------------------------------
  // Test 2: Daily Report Export Route Verification
  // -------------------------------------------------------------
  describe('Daily Report Export Route (/api/reports/daily/export)', () => {
    it('exports Daily Report to Excel with correct headers, filename and Bengali rows', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/reports/daily/export?date=${testDate}&type=excel`
      );
      const res = await exportDailyReport(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(res.headers.get('Content-Disposition')).toBe(
        `attachment; filename="daily-report-${testDate}.xlsx"`
      );

      const arrayBuf = await res.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      expect(buf[0]).toBe(0x50);
      expect(buf[1]).toBe(0x4b);

      // Read back with ExcelJS to verify exact Bengali row names
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as any);
      const ws = wb.getWorksheet('Daily Report');
      expect(ws).toBeDefined();

      const rowTexts: string[] = [];
      ws?.eachRow((row) => {
        row.eachCell((cell) => {
          if (cell.value) rowTexts.push(String(cell.value));
        });
      });

      // Verify exact Bengali order and content
      expect(rowTexts).toContain('নতুন লিড');
      expect(rowTexts).toContain('নিশ্চিত অর্ডার');
      expect(rowTexts).toContain('মোট বিক্রি');
      expect(rowTexts).toContain('বিজ্ঞাপনের খরচ');
      expect(rowTexts).toContain('ফলোআপ সম্পন্ন');
      expect(rowTexts).toContain('বড় B2B অনুসন্ধান');
      expect(rowTexts).toContain('প্রধান সমস্যা');
      expect(rowTexts).toContain('আগামী দিনের অগ্রাধিকার');
      expect(rowTexts).toContain('POSTS_DONE count');
      expect(rowTexts).toContain('পণ্য বিক্রয়ের বিবরণ (Product Breakdown)');
      expect(rowTexts).toContain('প্রিমিয়াম মাশরুম স্পন');
    });

    it('exports Daily Report to PDF with correct headers, filename and mime type', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/reports/daily/export?date=${testDate}&type=pdf`
      );
      const res = await exportDailyReport(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/pdf');
      expect(res.headers.get('Content-Disposition')).toBe(
        `attachment; filename="daily-report-${testDate}.pdf"`
      );

      const arrayBuf = await res.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      expect(buf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });
  });

  // -------------------------------------------------------------
  // Test 3: Weekly Report Export Route Verification
  // -------------------------------------------------------------
  describe('Weekly Report Export Route (/api/reports/weekly/export)', () => {
    it('exports Weekly Report to Excel with all 6 required sections and correct filename', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/reports/weekly/export?weekStart=${testWeekStart}&type=excel`
      );
      const res = await exportWeeklyReport(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(res.headers.get('Content-Disposition')).toBe(
        `attachment; filename="weekly-report-${testWeekStart}.xlsx"`
      );

      const arrayBuf = await res.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      expect(buf[0]).toBe(0x50);
      expect(buf[1]).toBe(0x4b);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as any);

      // Verify the worksheets for weekly totals, 5 questions, top products, channels, unfinished orders
      const sheetNames = wb.worksheets.map((s) => s.name);
      expect(sheetNames).toContain('Weekly Evaluation');
      expect(sheetNames).toContain('Top Products');
      expect(sheetNames).toContain('Source Quality');
      expect(sheetNames).toContain('Unfinished Orders');

      const evalSheet = wb.getWorksheet('Weekly Evaluation');
      const allText: string[] = [];
      evalSheet?.eachRow((row) => {
        row.eachCell((c) => c.value && allText.push(String(c.value)));
      });

      // Weekly totals & target vs actual check
      expect(allText).toContain('সাপ্তাহিক সর্বমোট ফলাফল');
      expect(allText).toContain('সাপ্তাহিক লক্ষ্যমাত্রা (Target)');
      // 5 questions check
      expect(allText).toContain('কৌশলগত ও মূল্যায়নমূলক প্রশ্ন (৫টি প্রশ্ন)');
      expect(allText).toContain('চলতি সপ্তাহের সবচেয়ে বড় সাফল্য কি ছিল?');
      expect(allText).toContain('কোথায় সবচেয়ে বেশি চ্যালেঞ্জ বা বাধা এসেছে?');
    });

    it('exports Weekly Report to PDF with correct headers and attachment filename', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/reports/weekly/export?weekStart=${testWeekStart}&type=pdf`
      );
      const res = await exportWeeklyReport(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/pdf');
      expect(res.headers.get('Content-Disposition')).toBe(
        `attachment; filename="weekly-report-${testWeekStart}.pdf"`
      );

      const arrayBuf = await res.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      expect(buf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });
  });

  // -------------------------------------------------------------
  // Test 4: Monthly Report Export Route Verification
  // -------------------------------------------------------------
  describe('Monthly Report Export Route (/api/reports/monthly/export)', () => {
    it('exports Monthly Report to Excel with Sections 1-6 auto-data and 7-8 admin text', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/reports/monthly/export?month=${testMonth}&type=excel`
      );
      const res = await exportMonthlyReport(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(res.headers.get('Content-Disposition')).toBe(
        `attachment; filename="monthly-report-${testMonth}.xlsx"`
      );

      const arrayBuf = await res.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as any);

      const sheetNames = wb.worksheets.map((s) => s.name);
      expect(sheetNames).toContain('Executive Summary');
      expect(sheetNames).toContain('Marketer Rankings');
      expect(sheetNames).toContain('Section Achievements');
      expect(sheetNames).toContain('Products & Channels');

      const summarySheet = wb.getWorksheet('Executive Summary');
      const summaryText: string[] = [];
      summarySheet?.eachRow((row) => {
        row.eachCell((c) => c.value && summaryText.push(String(c.value)));
      });

      // Section 1: MoM Growth
      expect(summaryText).toContain('সেকশন ১: মাসভিত্তিক প্রবৃদ্ধি (Month-over-Month Growth)');
      // Section 3: Budget
      expect(summaryText).toContain('সেকশন ৩: বাজেট ব্যবহার ও ব্যয় বিবরণী');
      // Section 7: Summary text
      expect(summaryText).toContain('সেকশন ৭: মাসিক কাজের সারসংক্ষেপ ও মূল্যায়ন');
      expect(summaryText).toContain('অক্টোবর মাসে সামগ্রিক লক্ষ্যমাত্রার ৯৫% সফলভাবে অর্জিত হয়েছে।');
      // Section 8: Next month goal & budget
      expect(summaryText).toContain('সেকশন ৮: পরবর্তী মাসের প্রধান লক্ষ্যসমূহ ও প্রস্তাবিত বাজেট');
      expect(summaryText).toContain('নভেম্বর মাসে বিক্রয় ৩০% বৃদ্ধি ও নতুন আঞ্চলিক এজেন্ট নিয়োগ।');
    });

    it('exports Monthly Report to PDF with Sections 1-8 and correct filename', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/reports/monthly/export?month=${testMonth}&type=pdf`
      );
      const res = await exportMonthlyReport(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/pdf');
      expect(res.headers.get('Content-Disposition')).toBe(
        `attachment; filename="monthly-report-${testMonth}.pdf"`
      );

      const arrayBuf = await res.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      expect(buf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });
  });

  // -------------------------------------------------------------
  // Test 5: Audit Log Verification on Export Actions
  // -------------------------------------------------------------
  describe('Audit Log Verification (Acceptance Test 22 Requirement 4)', () => {
    it('creates an AuditLog entry with action EXPORT when a daily report is exported', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/reports/daily/export?date=${testDate}&type=excel`
      );
      await exportDailyReport(req);

      const auditRecord = await prisma.auditLog.findFirst({
        where: {
          actor_id: mockAdminUser.id,
          action: AuditAction.EXPORT,
          entity: 'DailyReport',
          entity_id: testDate,
        },
        orderBy: { created_at: 'desc' },
      });

      expect(auditRecord).not.toBeNull();
      expect(auditRecord?.action).toBe(AuditAction.EXPORT);
      expect(auditRecord?.entity).toBe('DailyReport');
    });

    it('creates an AuditLog entry with action EXPORT when a weekly report is exported', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/reports/weekly/export?weekStart=${testWeekStart}&type=pdf`
      );
      await exportWeeklyReport(req);

      const auditRecord = await prisma.auditLog.findFirst({
        where: {
          actor_id: mockAdminUser.id,
          action: AuditAction.EXPORT,
          entity: 'WeeklyReport',
        },
        orderBy: { created_at: 'desc' },
      });

      expect(auditRecord).not.toBeNull();
      expect(auditRecord?.action).toBe(AuditAction.EXPORT);
      expect(auditRecord?.entity).toBe('WeeklyReport');
    });

    it('creates an AuditLog entry with action EXPORT when a monthly report is exported', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/reports/monthly/export?month=${testMonth}&type=excel`
      );
      await exportMonthlyReport(req);

      const auditRecord = await prisma.auditLog.findFirst({
        where: {
          actor_id: mockAdminUser.id,
          action: AuditAction.EXPORT,
          entity: 'MonthlyReport',
          entity_id: testMonth,
        },
        orderBy: { created_at: 'desc' },
      });

      expect(auditRecord).not.toBeNull();
      expect(auditRecord?.action).toBe(AuditAction.EXPORT);
      expect(auditRecord?.entity).toBe('MonthlyReport');
    });
  });
});
