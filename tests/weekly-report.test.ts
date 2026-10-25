import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/lib/prisma';
import { computeWeeklyAutoData, WEEKLY_FIXED_QUESTIONS } from '../src/lib/reports';
import { hashPassword } from '../src/lib/auth';
import { startOfWeek, endOfWeek } from 'date-fns';
import { ReportStatus } from '@prisma/client';

describe('Step 7: Weekly Report & Fixed Questions Unit Tests', () => {
  let adminUser: any;
  let employeeUser: any;
  let testProduct: any;
  let testCampaign: any;
  let createdReportId: string | null = null;

  const uniqueId = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const adminEmail = `weekly_admin_${uniqueId}@test.com`;
  const employeeEmail = `weekly_emp_${uniqueId}@test.com`;
  const leadPhone = `01799${Math.floor(100000 + Math.random() * 900000)}`;

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 0 });

  beforeAll(async () => {
    // Clean up any legacy or colliding test users and reports for this week
    try {
      const existingReports = await prisma.weeklyReport.findMany({
        where: { week_start: weekStart },
        select: { id: true },
      });
      for (const r of existingReports) {
        await prisma.weeklyReportAnswer.deleteMany({ where: { weekly_report_id: r.id } });
        await prisma.weeklyReport.delete({ where: { id: r.id } });
      }
    } catch (_) {
      // ignore cleanup errors in beforeAll
    }

    const passwordHash = await hashPassword('TestPass123!');

    adminUser = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        name: 'Step 7 Admin',
        password_hash: passwordHash,
        role: 'ADMIN',
        is_active: true,
      },
      create: {
        name: 'Step 7 Admin',
        email: adminEmail,
        password_hash: passwordHash,
        role: 'ADMIN',
      },
    });

    employeeUser = await prisma.user.upsert({
      where: { email: employeeEmail },
      update: {
        name: 'Step 7 Employee',
        password_hash: passwordHash,
        role: 'EMPLOYEE',
        is_active: true,
      },
      create: {
        name: 'Step 7 Employee',
        email: employeeEmail,
        password_hash: passwordHash,
        role: 'EMPLOYEE',
      },
    });

    testProduct = await prisma.product.create({
      data: {
        name_bn: 'সাপ্তাহিক টেস্ট মাশরুম',
        name_en: `Weekly Test Mushroom ${uniqueId}`,
        unit: 'packet',
        selling_price: 250.0,
      },
    });

    testCampaign = await prisma.campaign.create({
      data: {
        name: `সাপ্তাহিক বুস্টিং ক্যাম্পেইন ${uniqueId}`,
        channel: 'FACEBOOK_AD',
        owner_id: adminUser.id,
        start_date: weekStart,
        budget_amount: 15000.0,
      },
    });

    // Seed a daily product sale in this week
    await prisma.dailyProductSale.create({
      data: {
        employee_id: employeeUser.id,
        entry_date: weekStart,
        product_id: testProduct.id,
        quantity: 50,
        amount: 12500.0,
      },
    });

    // Seed a lead for this campaign
    await prisma.lead.create({
      data: {
        name: 'সাপ্তাহিক টেস্ট ক্রেতা',
        phone: leadPhone,
        owner_id: employeeUser.id,
        campaign_id: testCampaign.id,
        source_channel: 'FACEBOOK_AD',
        status: 'ORDERED',
        order_amount: 12500.0,
      },
    });
  });

  afterAll(async () => {
    try {
      if (createdReportId) {
        await prisma.weeklyReportAnswer.deleteMany({
          where: { weekly_report_id: createdReportId },
        }).catch(() => {});
        await prisma.weeklyReport.deleteMany({
          where: { id: createdReportId },
        }).catch(() => {});
      }
      if (adminUser?.id) {
        await prisma.weeklyReportAnswer.deleteMany({
          where: { report: { created_by: adminUser.id } },
        }).catch(() => {});
        await prisma.weeklyReport.deleteMany({
          where: { created_by: adminUser.id },
        }).catch(() => {});
      }
      await prisma.lead.deleteMany({
        where: { phone: leadPhone },
      }).catch(() => {});
      if (testCampaign?.id) {
        await prisma.lead.deleteMany({
          where: { campaign_id: testCampaign.id },
        }).catch(() => {});
      }
      if (testProduct?.id) {
        await prisma.dailyProductSale.deleteMany({
          where: { product_id: testProduct.id },
        }).catch(() => {});
      }
      if (employeeUser?.id) {
        await prisma.dailyProductSale.deleteMany({
          where: { employee_id: employeeUser.id },
        }).catch(() => {});
        await prisma.lead.deleteMany({
          where: { owner_id: employeeUser.id },
        }).catch(() => {});
      }
      if (testCampaign?.id) {
        await prisma.campaign.deleteMany({
          where: { id: testCampaign.id },
        }).catch(() => {});
      }
      if (testProduct?.id) {
        await prisma.product.deleteMany({
          where: { id: testProduct.id },
        }).catch(() => {});
      }
      if (employeeUser?.id) {
        await prisma.user.deleteMany({
          where: { id: employeeUser.id },
        }).catch(() => {});
      }
      if (adminUser?.id) {
        await prisma.user.deleteMany({
          where: { id: adminUser.id },
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Error during cleanup in afterAll:', err);
    }
  });

  it('should compute automated analytics for Questions 1-3 correctly', async () => {
    const autoData = await computeWeeklyAutoData(weekStart, weekEnd);

    // Question 1: Top product
    expect(autoData.top_products).toBeDefined();
    const foundProduct = autoData.top_products.find((p) => p.product_id === testProduct.id);
    expect(foundProduct).toBeDefined();
    expect(foundProduct?.total_quantity).toBe(50);
    expect(foundProduct?.total_amount).toBe(12500.0);

    // Question 2: Campaign performance
    expect(autoData.campaign_performance).toBeDefined();
    const foundCampaign = autoData.campaign_performance.find((c) => c.campaign_id === testCampaign.id);
    expect(foundCampaign).toBeDefined();
    expect(foundCampaign?.leads_count).toBeGreaterThanOrEqual(1);
    expect(foundCampaign?.orders_count).toBeGreaterThanOrEqual(1);

    // Question 3: Channel breakdown
    expect(autoData.channel_breakdown).toBeDefined();
    const fbAdChannel = autoData.channel_breakdown.find((ch) => ch.channel === 'FACEBOOK_AD');
    expect(fbAdChannel).toBeDefined();
    expect(fbAdChannel?.orders_count).toBeGreaterThanOrEqual(1);
  });

  it('should verify the 5 structured strategic review questions definition', () => {
    expect(WEEKLY_FIXED_QUESTIONS).toHaveLength(5);

    const questionNumbers = WEEKLY_FIXED_QUESTIONS.map((q) => q.no);
    expect(questionNumbers).toEqual([1, 2, 3, 4, 5]);

    // Strategic review question definitions
    expect(WEEKLY_FIXED_QUESTIONS[0].text).toBe('চলতি সপ্তাহের সবচেয়ে বড় সাফল্য কি ছিল?');
    expect(WEEKLY_FIXED_QUESTIONS[1].text).toBe('কোথায় সবচেয়ে বেশি চ্যালেঞ্জ বা বাধা এসেছে?');
    expect(WEEKLY_FIXED_QUESTIONS[2].text).toBe('কোন চ্যানেল বা পণ্যে বাজেটের অপচয় মনে হয়েছে?');
    expect(WEEKLY_FIXED_QUESTIONS[3].text).toBe('পরবর্তী সপ্তাহের প্রধান ৩টি অগ্রাধিকার কি কি?');
    expect(WEEKLY_FIXED_QUESTIONS[4].text).toBe('টিমের কোনো সদস্যের বিশেষ সহায়তা বা দিকনির্দেশনা প্রয়োজন কি?');
  });

  it('should create weekly report draft with 5 fixed questions and allow answers save & publish', async () => {
    // 1. Create Report in DRAFT
    const autoData = await computeWeeklyAutoData(weekStart, weekEnd);
    const report = await prisma.weeklyReport.create({
      data: {
        week_start: weekStart,
        week_end: weekEnd,
        status: ReportStatus.DRAFT,
        auto_data: autoData as any,
        created_by: adminUser.id,
        answers: {
          create: WEEKLY_FIXED_QUESTIONS.map((q) => ({
            question_no: q.no,
            question_text: q.text,
            answer_text: `উত্তর ${q.no}: тестовый উত্তর / কৌশলগত পর্যালোচনা`,
            updated_by: adminUser.id,
          })),
        },
      },
      include: {
        answers: {
          orderBy: { question_no: 'asc' },
        },
      },
    });

    createdReportId = report.id;

    expect(report.status).toBe(ReportStatus.DRAFT);
    expect(report.answers.length).toBe(5);
    expect(report.answers[0].question_no).toBe(1);
    expect(report.answers[0].answer_text).toContain('উত্তর 1');
    expect(report.answers[4].question_no).toBe(5);
    expect(report.answers[4].answer_text).toContain('উত্তর 5');

    // 2. Update an answer (e.g. strategic review question 5: 3 priority tasks)
    const updatedAnswer = await prisma.weeklyReportAnswer.update({
      where: {
        weekly_report_id_question_no: {
          weekly_report_id: report.id,
          question_no: 5,
        },
      },
      data: {
        answer_text: '১. মাশরুম স্পন সরবরাহ বৃদ্ধি ২. রেস্টুরেন্ট আউটরিচ ৩. ফেসপ্যাক রিলস ক্যাম্পেইন',
        updated_by: adminUser.id,
      },
    });
    expect(updatedAnswer.answer_text).toContain('মাশরুম স্পন সরবরাহ বৃদ্ধি');

    // 3. Publish Report
    const published = await prisma.weeklyReport.update({
      where: { id: report.id },
      data: {
        status: ReportStatus.PUBLISHED,
        published_at: new Date(),
      },
      include: {
        answers: {
          orderBy: { question_no: 'asc' },
        },
      },
    });

    expect(published.status).toBe(ReportStatus.PUBLISHED);
    expect(published.published_at).not.toBeNull();
    expect(published.answers.length).toBe(5);
    expect(published.answers[4].answer_text).toContain('মাশরুম স্পন সরবরাহ বৃদ্ধি');
  });
});
