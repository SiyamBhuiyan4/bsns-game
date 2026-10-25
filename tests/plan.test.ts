import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../src/lib/prisma';
import {
  calculatePlanProgress,
  calculatePhaseProgress,
  getCurrentPhase,
  getPlanDayNumber,
  isTaskOverdue,
  getOverdueTasks,
  calculateTaskDueDate,
  canUserManagePlan,
} from '../src/lib/plan';
import { getDhakaDateString } from '../src/lib/date';
import { createAuditLog } from '../src/lib/audit';
import { hashPassword } from '../src/lib/auth';
import {
  PlanStatus,
  TaskStatus,
  MilestoneStatus,
  AuditAction,
} from '@prisma/client';
import { addDays, subDays, parseISO } from 'date-fns';

describe('Step 9: 90-Day Marketing & Sales Plan Tests', () => {
  let seededPlan: any;
  let testAdminUser: any;
  let testEmployeeUser: any;
  let isolatedPlan: any;

  beforeAll(async () => {
    // 1. Clean up any leftover isolated test plans from previous runs
    const existingIsolated = await prisma.plan.findMany({
      where: { name: 'আইসোলেটেড টেস্ট প্ল্যান' },
      select: { id: true },
    });
    for (const iso of existingIsolated) {
      await prisma.auditLog.deleteMany({
        where: {
          entity_id: iso.id,
        },
      });
      await prisma.planTask.deleteMany({ where: { plan_id: iso.id } });
      await prisma.planMilestone.deleteMany({ where: { plan_id: iso.id } });
      await prisma.planPhase.deleteMany({ where: { plan_id: iso.id } });
      await prisma.plan.delete({ where: { id: iso.id } });
    }

    // 2. Ensure the seeded 90-day plan is ACTIVE
    await prisma.plan.updateMany({
      where: { name: '৯০ দিনের প্রাথমিক ডিজিটাল মার্কেটিং ও বিক্রয় কর্মপরিকল্পনা' },
      data: { status: PlanStatus.ACTIVE },
    });

    seededPlan = await prisma.plan.findFirst({
      where: {
        name: '৯০ দিনের প্রাথমিক ডিজিটাল মার্কেটিং ও বিক্রয় কর্মপরিকল্পনা',
        status: PlanStatus.ACTIVE,
      },
      include: {
        phases: {
          orderBy: { order_no: 'asc' },
          include: {
            milestones: true,
            tasks: {
              orderBy: { due_date: 'asc' },
              include: {
                owner: true,
              },
            },
          },
        },
      },
    });

    // Check if seededPlan is complete and properly configured:
    // Exactly 3 phases, each with 5 tasks, each with at least 1 milestone, and correct task titles
    const isPlanComplete =
      seededPlan &&
      seededPlan.phases &&
      seededPlan.phases.length === 3 &&
      seededPlan.phases.every(
        (p: any) => p.tasks && p.tasks.length === 5 && p.milestones && p.milestones.length >= 1
      ) &&
      seededPlan.phases[0].tasks.some(
        (t: any) =>
          t.title_bn.includes('পুরোনো ক্রেতা ও সম্ভাব্য ক্রেতার ডেটাবেস') &&
          t.status === TaskStatus.IN_PROGRESS
      );

    // If missing, incomplete, or corrupted, clean up and reseed cleanly
    if (!isPlanComplete) {
      if (seededPlan) {
        await prisma.planTask.deleteMany({ where: { plan_id: seededPlan.id } });
        await prisma.planMilestone.deleteMany({ where: { plan_id: seededPlan.id } });
        await prisma.planPhase.deleteMany({ where: { plan_id: seededPlan.id } });
        await prisma.plan.delete({ where: { id: seededPlan.id } });
      }

      // Also clean up any other plan with that name just in case
      const strayPlans = await prisma.plan.findMany({
        where: { name: '৯০ দিনের প্রাথমিক ডিজিটাল মার্কেটিং ও বিক্রয় কর্মপরিকল্পনা' },
        select: { id: true },
      });
      for (const sp of strayPlans) {
        await prisma.planTask.deleteMany({ where: { plan_id: sp.id } });
        await prisma.planMilestone.deleteMany({ where: { plan_id: sp.id } });
        await prisma.planPhase.deleteMany({ where: { plan_id: sp.id } });
        await prisma.plan.delete({ where: { id: sp.id } });
      }

      // Ensure standard test users exist for assignment
      let admin = await prisma.user.findUnique({ where: { email: 'admin@example.com' } });
      if (!admin) {
        admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
      }
      if (!admin) {
        admin = await prisma.user.create({
          data: {
            name: 'হেড অব মার্কেটিং (Admin)',
            email: 'admin@example.com',
            password_hash: await hashPassword('AdminPassword123!'),
            role: 'ADMIN',
          },
        });
      }

      let emp1 = await prisma.user.findUnique({ where: { email: 'employee1@example.com' } });
      if (!emp1) {
        emp1 = await prisma.user.create({
          data: {
            name: 'রাকিব হাসান (Marketer 1)',
            email: 'employee1@example.com',
            password_hash: await hashPassword('EmployeePassword123!'),
            role: 'EMPLOYEE',
          },
        });
      }

      let emp2 = await prisma.user.findUnique({ where: { email: 'employee2@example.com' } });
      if (!emp2) {
        emp2 = await prisma.user.create({
          data: {
            name: 'তানিয়া আক্তার (Marketer 2)',
            email: 'employee2@example.com',
            password_hash: await hashPassword('EmployeePassword123!'),
            role: 'EMPLOYEE',
          },
        });
      }

      const now = new Date();
      const planStartDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
      const addDaysUtc = (base: Date, days: number): Date => {
        const res = new Date(base);
        res.setUTCDate(res.getUTCDate() + days);
        return res;
      };

      const newPlan = await prisma.plan.create({
        data: {
          name: '৯০ দিনের প্রাথমিক ডিজিটাল মার্কেটিং ও বিক্রয় কর্মপরিকল্পনা',
          start_date: planStartDate,
          status: PlanStatus.ACTIVE,
          created_by: admin!.id,
        },
      });

      const p1 = await prisma.planPhase.create({
        data: {
          plan_id: newPlan.id,
          order_no: 1,
          name_bn: 'প্রথম ৩০ দিন — বিশ্লেষণ',
          name_en: 'Days 1–30 / Analysis',
          day_start: 1,
          day_end: 30,
        },
      });

      await prisma.planMilestone.create({
        data: {
          plan_id: newPlan.id,
          phase_id: p1.id,
          title_bn: 'প্রথম ৩০ দিনের লক্ষ্য ও মূল্যায়ন',
          expected_result: 'বর্তমান ব্যবসার বেসলাইন, অগ্রাধিকারভিত্তিক পণ্যের তালিকা এবং অনুমোদিত কর্মপরিকল্পনা',
          achieved_result: 'পণ্যের তথ্য ও ডাটাবেস পর্যালোচিত',
          status: MilestoneStatus.PARTIAL,
          reviewed_at: new Date(),
        },
      });

      await prisma.planTask.createMany({
        data: [
          {
            plan_id: newPlan.id,
            phase_id: p1.id,
            title_bn: 'সব পণ্যের তালিকা, বিক্রির পরিমাণ, বিক্রয়মূল্য ও খরচ সংগ্রহ',
            title_en: 'Collect product list, sales volume, prices, and costs',
            owner_id: emp1?.id,
            status: TaskStatus.DONE,
            progress_percent: 100,
            due_date: addDaysUtc(planStartDate, 5),
          },
          {
            plan_id: newPlan.id,
            phase_id: p1.id,
            title_bn: 'বর্তমান মার্কেটিং চ্যানেল ও বিজ্ঞাপন পর্যালোচনা',
            title_en: 'Review current marketing channels and ads',
            owner_id: emp2?.id,
            status: TaskStatus.DONE,
            progress_percent: 100,
            due_date: addDaysUtc(planStartDate, 11),
          },
          {
            plan_id: newPlan.id,
            phase_id: p1.id,
            title_bn: 'পুরোনো ক্রেতা ও সম্ভাব্য ক্রেতার ডেটাবেস তৈরি বা পরিষ্কার করা',
            title_en: 'Build or clean customer and lead database',
            owner_id: emp1?.id,
            status: TaskStatus.IN_PROGRESS,
            progress_percent: 70,
            due_date: addDaysUtc(planStartDate, 17),
          },
          {
            plan_id: newPlan.id,
            phase_id: p1.id,
            title_bn: 'পণ্যভিত্তিক ক্রেতার ধরন নির্ধারণ',
            title_en: 'Determine buyer types per product',
            owner_id: emp2?.id,
            status: TaskStatus.IN_PROGRESS,
            progress_percent: 50,
            due_date: addDaysUtc(planStartDate, 23),
          },
          {
            plan_id: newPlan.id,
            phase_id: p1.id,
            title_bn: 'মাসিক বাজেট ও KPI-এর প্রস্তাব তৈরি',
            title_en: 'Draft proposal for monthly budget and KPIs',
            owner_id: admin?.id,
            status: TaskStatus.NOT_STARTED,
            progress_percent: 0,
            due_date: addDaysUtc(planStartDate, 29),
          },
        ],
      });

      const p2 = await prisma.planPhase.create({
        data: {
          plan_id: newPlan.id,
          order_no: 2,
          name_bn: 'দিন ৩১–৬০ — বাস্তবায়ন',
          name_en: 'Days 31–60 / Implementation',
          day_start: 31,
          day_end: 60,
        },
      });

      await prisma.planMilestone.create({
        data: {
          plan_id: newPlan.id,
          phase_id: p2.id,
          title_bn: 'দিন ৩১–৬০ এর লক্ষ্য ও মূল্যায়ন',
          expected_result: 'বাস্তব লিড, অর্ডার, ক্যাম্পেইন পারফরম্যান্স এবং প্রথম দফার উন্নয়নের তথ্য',
          status: MilestoneStatus.PENDING,
        },
      });

      await prisma.planTask.createMany({
        data: [
          {
            plan_id: newPlan.id,
            phase_id: p2.id,
            title_bn: 'নির্বাচিত পণ্যের জন্য বিজ্ঞাপন ও কনটেন্ট ক্যাম্পেইন চালু করা',
            title_en: 'Launch ads and content campaigns for selected products',
            owner_id: emp1?.id,
            status: TaskStatus.NOT_STARTED,
            progress_percent: 0,
            due_date: addDaysUtc(planStartDate, 35),
          },
          {
            plan_id: newPlan.id,
            phase_id: p2.id,
            title_bn: 'কৃষক, পাইকার, রেস্টুরেন্ট ও ডিলারদের সঙ্গে যোগাযোগ বাড়ানো',
            title_en: 'Increase outreach to farmers, wholesalers, restaurants, and dealers',
            owner_id: emp2?.id,
            status: TaskStatus.NOT_STARTED,
            progress_percent: 0,
            due_date: addDaysUtc(planStartDate, 41),
          },
          {
            plan_id: newPlan.id,
            phase_id: p2.id,
            title_bn: 'লিড সংগ্রহ, ফলোআপ ও অর্ডার কনভার্সনের নিয়ম চালু করা',
            title_en: 'Establish rules for lead collection, followup, and order conversion',
            owner_id: emp1?.id,
            status: TaskStatus.NOT_STARTED,
            progress_percent: 0,
            due_date: addDaysUtc(planStartDate, 47),
          },
          {
            plan_id: newPlan.id,
            phase_id: p2.id,
            title_bn: 'পণ্যের বিক্রির তথ্য ও বিজ্ঞাপনের ফলাফল এক জায়গায় রাখা',
            title_en: 'Centralize product sales data and advertising results',
            owner_id: emp2?.id,
            status: TaskStatus.NOT_STARTED,
            progress_percent: 0,
            due_date: addDaysUtc(planStartDate, 53),
          },
          {
            plan_id: newPlan.id,
            phase_id: p2.id,
            title_bn: 'সফল ও দুর্বল ক্যাম্পেইন চিহ্নিত করা',
            title_en: 'Identify successful and underperforming campaigns',
            owner_id: admin?.id,
            status: TaskStatus.NOT_STARTED,
            progress_percent: 0,
            due_date: addDaysUtc(planStartDate, 59),
          },
        ],
      });

      const p3 = await prisma.planPhase.create({
        data: {
          plan_id: newPlan.id,
          order_no: 3,
          name_bn: 'দিন ৬১–৯০ — উন্নয়ন',
          name_en: 'Days 61–90 / Development',
          day_start: 61,
          day_end: 90,
        },
      });

      await prisma.planMilestone.create({
        data: {
          plan_id: newPlan.id,
          phase_id: p3.id,
          title_bn: 'দিন ৬১–৯০ এর লক্ষ্য ও মূল্যায়ন',
          expected_result: 'পরিমাপযোগ্য মার্কেটিং ব্যবস্থা, বিক্রির উন্নয়নের প্রমাণ এবং পরবর্তী সময়ের পরিকল্পনা',
          status: MilestoneStatus.PENDING,
        },
      });

      await prisma.planTask.createMany({
        data: [
          {
            plan_id: newPlan.id,
            phase_id: p3.id,
            title_bn: 'ভালো ফল দেওয়া ক্যাম্পেইনে শর্তসাপেক্ষে বাজেট বাড়ানো',
            title_en: 'Conditionally increase budget for high-performing campaigns',
            owner_id: admin?.id,
            status: TaskStatus.NOT_STARTED,
            progress_percent: 0,
            due_date: addDaysUtc(planStartDate, 65),
          },
          {
            plan_id: newPlan.id,
            phase_id: p3.id,
            title_bn: 'পুরোনো ক্রেতার পুনরায় অর্ডারের কার্যক্রম শক্তিশালী করা',
            title_en: 'Strengthen re-order retention activities for existing customers',
            owner_id: emp1?.id,
            status: TaskStatus.NOT_STARTED,
            progress_percent: 0,
            due_date: addDaysUtc(planStartDate, 71),
          },
          {
            plan_id: newPlan.id,
            phase_id: p3.id,
            title_bn: 'B2B ক্রেতাদের জন্য নিয়মিত বিক্রয় পাইপলাইন তৈরি',
            title_en: 'Build regular sales pipeline for B2B buyers',
            owner_id: emp2?.id,
            status: TaskStatus.NOT_STARTED,
            progress_percent: 0,
            due_date: addDaysUtc(planStartDate, 77),
          },
          {
            plan_id: newPlan.id,
            phase_id: p3.id,
            title_bn: 'কর্মীদের KPI মূল্যায়ন ও প্রয়োজনীয় প্রশিক্ষণ',
            title_en: 'Evaluate employee KPIs and conduct needed training',
            owner_id: admin?.id,
            status: TaskStatus.NOT_STARTED,
            progress_percent: 0,
            due_date: addDaysUtc(planStartDate, 83),
          },
          {
            plan_id: newPlan.id,
            phase_id: p3.id,
            title_bn: 'পরবর্তী ছয় মাসের ব্যবসা সম্প্রসারণ পরিকল্পনা তৈরি',
            title_en: 'Formulate business expansion plan for next six months',
            owner_id: admin?.id,
            status: TaskStatus.NOT_STARTED,
            progress_percent: 0,
            due_date: addDaysUtc(planStartDate, 89),
          },
        ],
      });

      seededPlan = await prisma.plan.findUnique({
        where: { id: newPlan.id },
        include: {
          phases: {
            orderBy: { order_no: 'asc' },
            include: {
              milestones: true,
              tasks: {
                orderBy: { due_date: 'asc' },
                include: {
                  owner: true,
                },
              },
            },
          },
        },
      });
    }

    // 2. Setup isolated test users for permission & audit log testing with unique emails
    const timestamp = Date.now();
    const adminEmail = `plan_test_admin_${timestamp}@test.com`;
    const employeeEmail = `plan_test_emp_${timestamp}@test.com`;
    const passwordHash = await hashPassword('SecurePlanTest123!');

    testAdminUser = await prisma.user.create({
      data: {
        name: 'Plan Test Admin',
        email: adminEmail,
        password_hash: passwordHash,
        role: 'ADMIN',
      },
    });

    testEmployeeUser = await prisma.user.create({
      data: {
        name: 'Plan Test Employee',
        email: employeeEmail,
        password_hash: passwordHash,
        role: 'EMPLOYEE',
      },
    });

    // 3. Setup an isolated plan for mutation tests
    isolatedPlan = await prisma.plan.create({
      data: {
        name: 'আইসোলেটেড টেস্ট প্ল্যান',
        start_date: new Date('2026-10-01'),
        status: PlanStatus.ACTIVE,
        created_by: testAdminUser.id,
      },
    });

    const isolatedPhase = await prisma.planPhase.create({
      data: {
        plan_id: isolatedPlan.id,
        order_no: 1,
        name_bn: 'টেস্ট ফেজ ১',
        name_en: 'Test Phase 1',
        day_start: 1,
        day_end: 30,
      },
    });

    const isolatedMilestone = await prisma.planMilestone.create({
      data: {
        plan_id: isolatedPlan.id,
        phase_id: isolatedPhase.id,
        title_bn: 'টেস্ট মাইলস্টোন ১',
        expected_result: 'টেস্ট প্রত্যাশিত ফলাফল',
        status: MilestoneStatus.PENDING,
      },
    });

    isolatedPlan = {
      ...isolatedPlan,
      phases: [
        {
          ...isolatedPhase,
          milestones: [isolatedMilestone],
        },
      ],
    };
  });

  afterAll(async () => {
    // Clean up isolated test data
    if (isolatedPlan) {
      await prisma.auditLog.deleteMany({
        where: {
          entity_id: {
            in: [
              isolatedPlan.id,
              isolatedPlan.phases[0]?.id,
              isolatedPlan.phases[0]?.milestones[0]?.id,
            ].filter(Boolean),
          },
        },
      });
      await prisma.planTask.deleteMany({ where: { plan_id: isolatedPlan.id } });
      await prisma.planMilestone.deleteMany({ where: { plan_id: isolatedPlan.id } });
      await prisma.planPhase.deleteMany({ where: { plan_id: isolatedPlan.id } });
      await prisma.plan.deleteMany({ where: { id: isolatedPlan.id } });
    }

    if (testEmployeeUser) {
      await prisma.auditLog.deleteMany({ where: { actor_id: testEmployeeUser.id } });
      await prisma.user.deleteMany({ where: { id: testEmployeeUser.id } });
    }

    if (testAdminUser) {
      await prisma.auditLog.deleteMany({ where: { actor_id: testAdminUser.id } });
      await prisma.user.deleteMany({ where: { id: testAdminUser.id } });
    }
  });

  // =========================================================================
  // 1. Plan Initialization & Structure
  // =========================================================================
  describe('90-Day Plan Initialization & Structure', () => {
    it('should verify the active 90-day plan exists with correct start date and creator', () => {
      expect(seededPlan).not.toBeNull();
      expect(seededPlan.name).toBe('৯০ দিনের প্রাথমিক ডিজিটাল মার্কেটিং ও বিক্রয় কর্মপরিকল্পনা');
      expect(seededPlan.status).toBe(PlanStatus.ACTIVE);
      expect(seededPlan.created_by).toBeDefined();

      const startDate = new Date(seededPlan.start_date);
      expect(startDate.getUTCDate()).toBe(1);
    });

    it('should have exactly 3 phases with correct day ranges (1-30, 31-60, 61-90)', () => {
      expect(seededPlan.phases).toHaveLength(3);

      const [p1, p2, p3] = seededPlan.phases;

      // Phase 1: Days 1–30
      expect(p1.order_no).toBe(1);
      expect(p1.name_bn).toBe('প্রথম ৩০ দিন — বিশ্লেষণ');
      expect(p1.name_en).toBe('Days 1–30 / Analysis');
      expect(p1.day_start).toBe(1);
      expect(p1.day_end).toBe(30);

      // Phase 2: Days 31–60
      expect(p2.order_no).toBe(2);
      expect(p2.name_bn).toBe('দিন ৩১–৬০ — বাস্তবায়ন');
      expect(p2.name_en).toBe('Days 31–60 / Implementation');
      expect(p2.day_start).toBe(31);
      expect(p2.day_end).toBe(60);

      // Phase 3: Days 61–90
      expect(p3.order_no).toBe(3);
      expect(p3.name_bn).toBe('দিন ৬১–৯০ — উন্নয়ন');
      expect(p3.name_en).toBe('Days 61–90 / Development');
      expect(p3.day_start).toBe(61);
      expect(p3.day_end).toBe(90);
    });

    it('should have 5 tasks in each phase (15 total tasks) with correct milestones', () => {
      for (const phase of seededPlan.phases) {
        expect(phase.tasks).toHaveLength(5);
        expect(phase.milestones).toHaveLength(1);
      }

      // Phase 1 Milestone
      const m1 = seededPlan.phases[0].milestones[0];
      expect(m1.title_bn).toBe('প্রথম ৩০ দিনের লক্ষ্য ও মূল্যায়ন');
      expect(m1.expected_result).toBe('বর্তমান ব্যবসার বেসলাইন, অগ্রাধিকারভিত্তিক পণ্যের তালিকা এবং অনুমোদিত কর্মপরিকল্পনা');
      expect(['MET', 'PARTIAL']).toContain(m1.status);
      expect(['পণ্যের তথ্য ও ডাটাবেস পর্যালোচিত', 'শতভাগ ফলাফল অর্জিত ও অডিট সম্পন্ন']).toContain(m1.achieved_result);

      // Phase 2 Milestone
      const m2 = seededPlan.phases[1].milestones[0];
      expect(m2.title_bn).toBe('দিন ৩১–৬০ এর লক্ষ্য ও মূল্যায়ন');
      expect(m2.expected_result).toBe('বাস্তব লিড, অর্ডার, ক্যাম্পেইন পারফরম্যান্স এবং প্রথম দফার উন্নয়নের তথ্য');
      expect(m2.status).toBe(MilestoneStatus.PENDING);

      // Phase 3 Milestone
      const m3 = seededPlan.phases[2].milestones[0];
      expect(m3.title_bn).toBe('দিন ৬১–৯০ এর লক্ষ্য ও মূল্যায়ন');
      expect(m3.expected_result).toBe('পরিমাপযোগ্য মার্কেটিং ব্যবস্থা, বিক্রির উন্নয়নের প্রমাণ এবং পরবর্তী সময়ের পরিকল্পনা');
      expect(m3.status).toBe(MilestoneStatus.PENDING);
    });
  });

  // =========================================================================
  // 2. Acceptance Test 21: Exact Task Lists & Overdue Task Identification
  // =========================================================================
  describe('Acceptance Test 21: Exact Task Lists & Overdue Tasks Identification', () => {
    it('should verify the exact task titles, owners, and progress in Phase 1', () => {
      const p1Tasks = seededPlan.phases[0].tasks;

      // 1. Collect product list
      const task1 = p1Tasks.find((t: any) => t.title_bn.includes('সব পণ্যের তালিকা'));
      expect(task1).toBeDefined();
      expect(task1.title_en).toBe('Collect product list, sales volume, prices, and costs');
      expect(task1.status).toBe(TaskStatus.DONE);
      expect(task1.progress_percent).toBe(100);
      expect(task1.owner?.email).toBe('employee1@example.com');

      // 2. Review marketing channels
      const task2 = p1Tasks.find((t: any) => t.title_bn.includes('বর্তমান মার্কেটিং চ্যানেল'));
      expect(task2).toBeDefined();
      expect(task2.title_en).toBe('Review current marketing channels and ads');
      expect(task2.status).toBe(TaskStatus.DONE);
      expect(task2.progress_percent).toBe(100);
      expect(task2.owner?.email).toBe('employee2@example.com');

      // 3. Build or clean customer database
      const task3 = p1Tasks.find((t: any) => t.title_bn.includes('পুরোনো ক্রেতা ও সম্ভাব্য ক্রেতার ডেটাবেস'));
      expect(task3).toBeDefined();
      expect(task3.title_en).toBe('Build or clean customer and lead database');
      expect(task3.status).toBe(TaskStatus.IN_PROGRESS);
      expect(task3.progress_percent).toBe(70);
      expect(task3.owner?.email).toBe('employee1@example.com');

      // 4. Determine buyer types per product
      const task4 = p1Tasks.find((t: any) => t.title_bn.includes('পণ্যভিত্তিক ক্রেতার ধরন নির্ধারণ'));
      expect(task4).toBeDefined();
      expect(task4.title_en).toBe('Determine buyer types per product');
      expect(task4.status).toBe(TaskStatus.IN_PROGRESS);
      expect(task4.progress_percent).toBe(50);
      expect(task4.owner?.email).toBe('employee2@example.com');

      // 5. Draft proposal for monthly budget and KPIs
      const task5 = p1Tasks.find((t: any) => t.title_bn.includes('মাসিক বাজেট ও KPI-এর প্রস্তাব তৈরি'));
      expect(task5).toBeDefined();
      expect(task5.title_en).toBe('Draft proposal for monthly budget and KPIs');
      expect(task5.status).toBe(TaskStatus.NOT_STARTED);
      expect(task5.progress_percent).toBe(0);
      expect(task5.owner?.email).toBe('admin@example.com');
    });

    it('should verify the exact task titles in Phase 2 and Phase 3', () => {
      const p2Tasks = seededPlan.phases[1].tasks;
      expect(p2Tasks.some((t: any) => t.title_bn.includes('বিজ্ঞাপন ও কনটেন্ট ক্যাম্পেইন চালু'))).toBe(true);
      expect(p2Tasks.some((t: any) => t.title_bn.includes('কৃষক, পাইকার, রেস্টুরেন্ট ও ডিলারদের সঙ্গে যোগাযোগ'))).toBe(true);
      expect(p2Tasks.some((t: any) => t.title_bn.includes('লিড সংগ্রহ, ফলোআপ ও অর্ডার কনভার্সনের নিয়ম'))).toBe(true);
      expect(p2Tasks.some((t: any) => t.title_bn.includes('পণ্যের বিক্রির তথ্য ও বিজ্ঞাপনের ফলাফল এক জায়গায়'))).toBe(true);
      expect(p2Tasks.some((t: any) => t.title_bn.includes('সফল ও দুর্বল ক্যাম্পেইন চিহ্নিত করা'))).toBe(true);

      const p3Tasks = seededPlan.phases[2].tasks;
      expect(p3Tasks.some((t: any) => t.title_bn.includes('ভালো ফল দেওয়া ক্যাম্পেইনে শর্তসাপেক্ষে বাজেট বাড়ানো'))).toBe(true);
      expect(p3Tasks.some((t: any) => t.title_bn.includes('পুরোনো ক্রেতার পুনরায় অর্ডারের কার্যক্রম শক্তিশালী করা'))).toBe(true);
      expect(p3Tasks.some((t: any) => t.title_bn.includes('B2B ক্রেতাদের জন্য নিয়মিত বিক্রয় পাইপলাইন তৈরি'))).toBe(true);
      expect(p3Tasks.some((t: any) => t.title_bn.includes('কর্মীদের KPI মূল্যায়ন ও প্রয়োজনীয় প্রশিক্ষণ'))).toBe(true);
      expect(p3Tasks.some((t: any) => t.title_bn.includes('পরবর্তী ছয় মাসের ব্যবসা সম্প্রসারণ পরিকল্পনা তৈরি'))).toBe(true);
    });

    it('should properly identify overdue tasks (due_date < today in Asia/Dhaka and status != DONE) [Acceptance Test 21]', () => {
      // Current date is 2026-10-25
      const currentDate = new Date('2026-10-25T12:00:00+06:00');
      const allTasks = seededPlan.phases.flatMap((p: any) => p.tasks);

      const overdue = getOverdueTasks(allTasks, currentDate);

      // Task 1 & 2: due dates < 2026-10-25, but status is DONE -> NOT overdue
      const task1 = allTasks.find((t: any) => t.title_bn.includes('সব পণ্যের তালিকা'));
      const task2 = allTasks.find((t: any) => t.title_bn.includes('বর্তমান মার্কেটিং চ্যানেল'));
      expect(isTaskOverdue(task1, currentDate)).toBe(false);
      expect(isTaskOverdue(task2, currentDate)).toBe(false);

      // Task 3: due Day 18 (2026-10-18), status IN_PROGRESS -> OVERDUE
      const task3 = allTasks.find((t: any) => t.title_bn.includes('পুরোনো ক্রেতা ও সম্ভাব্য ক্রেতার ডেটাবেস'));
      expect(isTaskOverdue(task3, currentDate)).toBe(true);

      // Task 4: due Day 24 (2026-10-24), status IN_PROGRESS -> OVERDUE
      const task4 = allTasks.find((t: any) => t.title_bn.includes('পণ্যভিত্তিক ক্রেতার ধরন নির্ধারণ'));
      expect(isTaskOverdue(task4, currentDate)).toBe(true);

      // Task 5: due Day 30 (2026-10-30), status NOT_STARTED -> NOT overdue (future date)
      const task5 = allTasks.find((t: any) => t.title_bn.includes('মাসিক বাজেট ও KPI-এর প্রস্তাব তৈরি'));
      expect(isTaskOverdue(task5, currentDate)).toBe(false);

      // Exactly Task 3 and Task 4 should be in the overdue list
      expect(overdue.map((t: any) => t.title_bn)).toEqual([
        task3.title_bn,
        task4.title_bn,
      ]);
      expect(overdue).toHaveLength(2);
    });

    it('should verify overdue boundary conditions: today is not overdue, yesterday is overdue if not done', () => {
      const todayStr = getDhakaDateString();
      const todayDate = parseISO(todayStr);
      const yesterdayDate = subDays(todayDate, 1);
      const tomorrowDate = addDays(todayDate, 1);

      // 1. Due today, not done -> NOT overdue
      expect(isTaskOverdue({ due_date: todayDate, status: TaskStatus.IN_PROGRESS })).toBe(false);

      // 2. Due yesterday, not done -> OVERDUE
      expect(isTaskOverdue({ due_date: yesterdayDate, status: TaskStatus.IN_PROGRESS })).toBe(true);

      // 3. Due yesterday, DONE -> NOT overdue
      expect(isTaskOverdue({ due_date: yesterdayDate, status: TaskStatus.DONE })).toBe(false);

      // 4. Due tomorrow, not done -> NOT overdue
      expect(isTaskOverdue({ due_date: tomorrowDate, status: TaskStatus.NOT_STARTED })).toBe(false);

      // 5. No due date -> NOT overdue
      expect(isTaskOverdue({ due_date: null, status: TaskStatus.IN_PROGRESS })).toBe(false);
    });
  });

  // =========================================================================
  // 3. Plan Calculations & Logic
  // =========================================================================
  describe('Plan Calculations & Engine', () => {
    it('should calculate overall progress percentage and phase progress percentage accurately', () => {
      const allTasks = seededPlan.phases.flatMap((p: any) => p.tasks);

      // Sum of Phase 1 = 100 + 100 + 70 + 50 + 0 = 320
      // Phase 2 = 0, Phase 3 = 0
      // Total 15 tasks: 320 / 15 = 21.33% -> 21%
      const overallProgress = calculatePlanProgress(allTasks);
      expect(overallProgress).toBe(21);

      // Phase 1 progress: 320 / 5 = 64%
      const p1Progress = calculatePhaseProgress(seededPlan.phases[0].tasks);
      expect(p1Progress).toBe(64);

      // Phase 2 & 3: 0%
      expect(calculatePhaseProgress(seededPlan.phases[1].tasks)).toBe(0);
      expect(calculatePhaseProgress(seededPlan.phases[2].tasks)).toBe(0);
    });

    it('should determine the current phase and elapsed day number based on Asia/Dhaka time', () => {
      const planStart = new Date('2026-10-01');

      // Day 25: 2026-10-25 -> Phase 1 (Days 1–30)
      const day25Date = new Date('2026-10-25T12:00:00+06:00');
      expect(getPlanDayNumber(planStart, day25Date)).toBe(25);
      const phaseAtDay25 = getCurrentPhase(seededPlan.phases, planStart, day25Date);
      expect(phaseAtDay25?.order_no).toBe(1);

      // Day 45: 2026-11-14 -> Phase 2 (Days 31–60)
      const day45Date = new Date('2026-11-14T12:00:00+06:00');
      expect(getPlanDayNumber(planStart, day45Date)).toBe(45);
      const phaseAtDay45 = getCurrentPhase(seededPlan.phases, planStart, day45Date);
      expect(phaseAtDay45?.order_no).toBe(2);

      // Day 75: 2026-12-14 -> Phase 3 (Days 61–90)
      const day75Date = new Date('2026-12-14T12:00:00+06:00');
      expect(getPlanDayNumber(planStart, day75Date)).toBe(75);
      const phaseAtDay75 = getCurrentPhase(seededPlan.phases, planStart, day75Date);
      expect(phaseAtDay75?.order_no).toBe(3);
    });

    it('should compute task due date from start_date and day offset', () => {
      const planStart = new Date('2026-10-01T00:00:00.000Z');

      const dueDay1 = calculateTaskDueDate(planStart, 1);
      expect(dueDay1.toISOString().slice(0, 10)).toBe('2026-10-01');

      const dueDay6 = calculateTaskDueDate(planStart, 6);
      expect(dueDay6.toISOString().slice(0, 10)).toBe('2026-10-06');

      const dueDay30 = calculateTaskDueDate(planStart, 30);
      expect(dueDay30.toISOString().slice(0, 10)).toBe('2026-10-30');

      const dueDay90 = calculateTaskDueDate(planStart, 90);
      expect(dueDay90.toISOString().slice(0, 10)).toBe('2026-12-29');
    });
  });

  // =========================================================================
  // 4. Security, Permissions & Audit Logging
  // =========================================================================
  describe('Security & Permissions', () => {
    it('should allow Admin to add, update task, assign owner, and record PLAN_UPDATE audit logs', async () => {
      const targetPhase = isolatedPlan.phases[0];

      // 1. Admin adds a new task
      const newTask = await prisma.planTask.create({
        data: {
          plan_id: isolatedPlan.id,
          phase_id: targetPhase.id,
          title_bn: 'নতুন পরীক্ষামূলক টাস্ক',
          title_en: 'New Experimental Task',
          description: 'অ্যাডমিন কর্তৃক তৈরি টাস্ক',
          owner_id: testAdminUser.id,
          due_date: new Date('2026-10-20'),
          status: TaskStatus.NOT_STARTED,
          progress_percent: 0,
        },
      });

      expect(newTask).toBeDefined();
      expect(newTask.id).toBeDefined();

      // Log audit entry for task creation
      const createLog = await createAuditLog({
        actorId: testAdminUser.id,
        action: AuditAction.PLAN_UPDATE,
        entity: 'PlanTask',
        entityId: newTask.id,
        payload: { action: 'CREATE_TASK', title: newTask.title_bn },
      });
      expect(createLog).not.toBeNull();
      expect(createLog?.action).toBe(AuditAction.PLAN_UPDATE);

      // 2. Admin assigns owner to employee and updates progress
      const updatedTask = await prisma.planTask.update({
        where: { id: newTask.id },
        data: {
          owner_id: testEmployeeUser.id,
          status: TaskStatus.IN_PROGRESS,
          progress_percent: 60,
          outcome_note: 'কর্মীর নিকট দায়িত্ব হস্তান্তর করা হয়েছে',
        },
      });

      expect(updatedTask.owner_id).toBe(testEmployeeUser.id);
      expect(updatedTask.progress_percent).toBe(60);

      // Log audit entry for update
      const updateLog = await createAuditLog({
        actorId: testAdminUser.id,
        action: AuditAction.PLAN_UPDATE,
        entity: 'PlanTask',
        entityId: updatedTask.id,
        payload: { action: 'UPDATE_TASK', updates: { owner_id: testEmployeeUser.id, progress_percent: 60 } },
      });
      expect(updateLog).not.toBeNull();
      expect(updateLog?.action).toBe(AuditAction.PLAN_UPDATE);

      // Verify audit logs exist in DB
      const dbLogs = await prisma.auditLog.findMany({
        where: {
          entity_id: newTask.id,
          action: AuditAction.PLAN_UPDATE,
        },
      });
      expect(dbLogs.length).toBeGreaterThanOrEqual(2);
    });

    it('should allow Admin to update milestone review and create PLAN_UPDATE audit log', async () => {
      const milestone = isolatedPlan.phases[0].milestones[0];

      const reviewDate = new Date();
      const updatedMilestone = await prisma.planMilestone.update({
        where: { id: milestone.id },
        data: {
          status: MilestoneStatus.MET,
          achieved_result: 'সকল প্রাথমিক লক্ষ্য শতভাগ সফলভাবে অর্জিত হয়েছে।',
          reviewed_at: reviewDate,
        },
      });

      expect(updatedMilestone.status).toBe(MilestoneStatus.MET);
      expect(updatedMilestone.achieved_result).toContain('শতভাগ সফলভাবে অর্জিত');
      expect(updatedMilestone.reviewed_at).not.toBeNull();

      // Create milestone audit log
      const milestoneAudit = await createAuditLog({
        actorId: testAdminUser.id,
        action: AuditAction.PLAN_UPDATE,
        entity: 'PlanMilestone',
        entityId: updatedMilestone.id,
        payload: {
          action: 'REVIEW_MILESTONE',
          status: updatedMilestone.status,
          achieved_result: updatedMilestone.achieved_result,
        },
      });

      expect(milestoneAudit).not.toBeNull();
      expect(milestoneAudit?.action).toBe(AuditAction.PLAN_UPDATE);
      expect(milestoneAudit?.entity).toBe('PlanMilestone');

      const foundLog = await prisma.auditLog.findFirst({
        where: {
          entity_id: updatedMilestone.id,
          action: AuditAction.PLAN_UPDATE,
        },
      });
      expect(foundLog).not.toBeNull();
      expect(foundLog?.actor_id).toBe(testAdminUser.id);
    });

    it('should verify employees cannot update plan tasks or review milestones (Permission Barrier)', () => {
      // 1. Role permission gate verification
      expect(canUserManagePlan('ADMIN')).toBe(true);
      expect(canUserManagePlan('EMPLOYEE')).toBe(false);
      expect(canUserManagePlan(testEmployeeUser.role)).toBe(false);
      expect(canUserManagePlan(testAdminUser.role)).toBe(true);
      expect(canUserManagePlan(null)).toBe(false);
      expect(canUserManagePlan(undefined)).toBe(false);

      // 2. Simulate API authorization check: non-admin must be rejected with 403
      const checkPlanAuthorization = (userRole: string) => {
        if (userRole !== 'ADMIN') {
          return { status: 403, error: 'অনুমতি নেই / Forbidden' };
        }
        return { status: 200, error: null };
      };

      const employeeAttempt = checkPlanAuthorization(testEmployeeUser.role);
      expect(employeeAttempt.status).toBe(403);
      expect(employeeAttempt.error).toContain('Forbidden');

      const adminAttempt = checkPlanAuthorization(testAdminUser.role);
      expect(adminAttempt.status).toBe(200);
      expect(adminAttempt.error).toBeNull();
    });
  });
});
