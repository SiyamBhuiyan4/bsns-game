import prisma from './prisma';
import { addDays, parseISO, differenceInCalendarDays } from 'date-fns';
import { getDhakaDateString, parseDateOnly } from './date';
import { PlanStatus, TaskStatus, MilestoneStatus, UserRole } from '@prisma/client';

export interface PlanMetrics {
  currentPhase: Record<string, unknown> | null;
  overallProgress: number;
  overdueTasksCount: number;
  phaseProgress: Record<string, number>;
  daysElapsed: number;
  currentDay: number;

  // Frontend UI compatibility fields
  overall_progress: number;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  current_day: number;
  current_phase_order: number;
  today: string;
}

/**
 * Normalizes any Date or date string to YYYY-MM-DD in Asia/Dhaka timezone.
 */
export function toDhakaDateString(date: Date | string): string {
  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    return getDhakaDateString(new Date(date));
  }
  return getDhakaDateString(date);
}

/**
 * Calculates a task's due date based on plan start_date and day ranges.
 * If dayRange is a number (e.g. 30), it is treated as day_end.
 * If dayRange is an object { day_start?: number; day_end: number }, day_end is used.
 * Day 1 = startDate + 0 days.
 * Day 30 = startDate + 29 days.
 */
export function calculateTaskDueDate(
  startDate: Date | string,
  dayRange: number | { day_start?: number; day_end: number }
): Date {
  const startStr = toDhakaDateString(startDate);
  const baseDate = parseDateOnly(startStr);
  const targetDay = typeof dayRange === 'number' ? dayRange : dayRange.day_end;
  const daysToAdd = Math.max(0, targetDay - 1);
  return addDays(baseDate, daysToAdd);
}

/**
 * Calculates the 1-based day number of the plan based on Asia/Dhaka timezone.
 * Day 1 = plan start_date.
 */
export function getPlanDayNumber(
  startDate: Date | string,
  currentDate: Date | string = new Date()
): number {
  const todayDhaka =
    typeof currentDate === 'string'
      ? toDhakaDateString(currentDate)
      : getDhakaDateString(currentDate);
  const startDhaka = toDhakaDateString(startDate);
  const diffDays = differenceInCalendarDays(parseISO(todayDhaka), parseISO(startDhaka));
  return diffDays + 1;
}

/**
 * Determines current phase based on days elapsed since plan start_date in Asia/Dhaka.
 * Returns the matching phase or null if plan has not started yet or has passed.
 */
export function getCurrentPhase<
  T extends { day_start: number; day_end: number; order_no?: number }
>(
  phases: T[],
  startDate: Date | string,
  currentDate: Date | string = new Date()
): T | null {
  if (!phases || phases.length === 0) return null;

  const todayDhaka =
    typeof currentDate === 'string'
      ? toDhakaDateString(currentDate)
      : getDhakaDateString(currentDate);
  const startDhaka = toDhakaDateString(startDate);
  const diffDays = differenceInCalendarDays(parseISO(todayDhaka), parseISO(startDhaka));

  if (diffDays < 0) {
    // Plan hasn't started yet
    return null;
  }

  const currentDay = diffDays + 1; // 1-based day index: Day 1 = start_date

  // Match phase where current day falls between [day_start, day_end]
  const match = phases.find(
    (p) => currentDay >= p.day_start && currentDay <= p.day_end
  );

  return match || null;
}

/**
 * Calculates average progress percentage across an array of tasks.
 */
export function calculateOverallProgress(
  tasks?: Array<{
    progress_percent?: number | null;
    status?: TaskStatus | string | null;
  }> | null
): number {
  if (!tasks || tasks.length === 0) return 0;
  const total = tasks.reduce((sum, t) => {
    const isDone = t.status === 'DONE' || t.status === TaskStatus.DONE;
    const taskProgress = (t.progress_percent || (isDone ? 100 : 0)) || 0;
    return sum + taskProgress;
  }, 0);
  return Math.round(total / tasks.length);
}

export const calculatePlanProgress = calculateOverallProgress;

/**
 * Calculates average progress percentage for tasks in a single phase.
 */
export function calculatePhaseProgress(
  tasks?: Array<{
    progress_percent?: number | null;
    status?: TaskStatus | string | null;
  }> | null
): number {
  return calculateOverallProgress(tasks);
}

/**
 * Computes progress percentage for each phase in a dictionary { [phaseId]: progress }.
 */
export function calculateAllPhasesProgress(
  phases: Array<{
    id?: string;
    tasks?: Array<{ progress_percent?: number | null; status?: TaskStatus | string | null }>;
  }>,
  allTasks?: Array<{
    phase_id?: string | null;
    progress_percent?: number | null;
    status?: TaskStatus | string | null;
  }>
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const phase of phases) {
    if (!phase.id) continue;
    const tasks =
      phase.tasks ?? (allTasks ? allTasks.filter((t) => t.phase_id === phase.id) : []);
    result[phase.id] = calculatePhaseProgress(tasks);
  }
  return result;
}

/**
 * Checks if a task is overdue (due_date < today in Asia/Dhaka and status != DONE).
 */
export function isTaskOverdue(
  task?: {
    due_date?: Date | string | null;
    status?: TaskStatus | string | null;
    effective_due_date?: Date | string | null;
  } | null,
  currentDateOrPlanStart?: Date | string | null,
  phaseDayEnd?: number | null,
  currentDateParam?: Date
): boolean {
  if (!task) return false;

  if (task.status === TaskStatus.DONE || task.status === 'DONE') {
    return false;
  }

  let currentDate = new Date();
  let planStartDate: Date | string | null = null;

  if (currentDateOrPlanStart instanceof Date) {
    currentDate = currentDateOrPlanStart;
  } else if (phaseDayEnd !== undefined && phaseDayEnd !== null) {
    planStartDate = currentDateOrPlanStart ?? null;
    if (currentDateParam) currentDate = currentDateParam;
  } else if (typeof currentDateOrPlanStart === 'string') {
    // If it's a date string like '2026-10-25' or '2026-10-25T...'
    currentDate = new Date(currentDateOrPlanStart);
  }

  let effectiveDueDate: Date | string | null = null;
  if (task.due_date) {
    effectiveDueDate = task.due_date;
  } else if (task.effective_due_date) {
    effectiveDueDate = task.effective_due_date;
  } else if (planStartDate && phaseDayEnd) {
    effectiveDueDate = calculateTaskDueDate(planStartDate, phaseDayEnd);
  }

  if (!effectiveDueDate) {
    return false;
  }

  const dueDateStr = toDhakaDateString(effectiveDueDate);
  const todayStr = getDhakaDateString(currentDate);

  return dueDateStr < todayStr;
}

/**
 * Filters tasks that are currently overdue.
 */
export function getOverdueTasks<
  T extends { due_date?: Date | string | null; status: TaskStatus | string }
>(tasks: T[], currentDate: Date = new Date()): T[] {
  return tasks.filter((t) => isTaskOverdue(t, currentDate));
}

/**
 * Calculates total overdue tasks count.
 */
export function calculateOverdueTasksCount(
  tasks: Array<{
    due_date?: Date | string | null;
    status: TaskStatus | string;
    phase?: { day_end: number } | null;
    phase_id?: string | null;
    effective_due_date?: Date | string | null;
  }>,
  planStartDate?: Date | string | null,
  phases?: Array<{ id?: string; day_end: number }>,
  currentDate: Date = new Date()
): number {
  const phaseMap = new Map<string, number>();
  if (phases) {
    for (const p of phases) {
      if (p.id) {
        phaseMap.set(p.id, p.day_end);
      }
    }
  }

  return tasks.filter((t) => {
    const phaseDayEnd =
      t.phase?.day_end ?? (t.phase_id ? phaseMap.get(t.phase_id) : null);
    return isTaskOverdue(t, planStartDate, phaseDayEnd, currentDate);
  }).length;
}

/**
 * Checks if a user role has permission to manage the plan.
 */
export function canUserManagePlan(role?: string | null): boolean {
  return role === 'ADMIN' || role === UserRole.ADMIN;
}

/**
 * Computes all plan metrics (currentPhase, overallProgress, overdueTasksCount, phaseProgress).
 */
export function computePlanMetrics(
  plan: {
    start_date: Date | string;
    phases: Array<{
      id?: string;
      day_start: number;
      day_end: number;
      order_no?: number;
      tasks?: Array<{
        progress_percent?: number | null;
        due_date?: Date | string | null;
        status: TaskStatus | string;
      }>;
    }>;
    tasks?: Array<{
      progress_percent?: number | null;
      due_date?: Date | string | null;
      status: TaskStatus | string;
      phase_id?: string | null;
    }>;
  },
  currentDate: Date = new Date()
): PlanMetrics {
  const tasks =
    plan.tasks && plan.tasks.length > 0
      ? plan.tasks
      : plan.phases.flatMap((p) => p.tasks ?? []);
  const currentPhase = getCurrentPhase(plan.phases, plan.start_date, currentDate);
  const overallProgress = calculateOverallProgress(tasks);
  const overdueTasksCount = calculateOverdueTasksCount(
    tasks,
    plan.start_date,
    plan.phases,
    currentDate
  );
  const phaseProgress = calculateAllPhasesProgress(plan.phases, tasks);

  const todayDhaka = getDhakaDateString(currentDate);
  const startDhaka = toDhakaDateString(plan.start_date);
  const diffDays = differenceInCalendarDays(parseISO(todayDhaka), parseISO(startDhaka));
  const currentDay = diffDays + 1;

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(
    (t) => t.status === TaskStatus.DONE || t.status === 'DONE'
  ).length;

  return {
    currentPhase,
    overallProgress,
    overdueTasksCount,
    phaseProgress,
    daysElapsed: Math.max(0, diffDays),
    currentDay,

    // UI snake_case compatibility
    overall_progress: overallProgress,
    total_tasks: totalTasks,
    completed_tasks: completedTasks,
    overdue_tasks: overdueTasksCount,
    current_day: currentDay,
    current_phase_order: currentPhase?.order_no || 1,
    today: todayDhaka,
  };
}

/**
 * Fetches the active plan with phases, tasks (with assigned employee info), milestones,
 * and computed stats.
 */
export async function getActivePlan(currentDate: Date = new Date()) {
  const plan = await prisma.plan.findFirst({
    where: { status: PlanStatus.ACTIVE },
    orderBy: { created_at: 'desc' },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
        },
      },
      phases: {
        orderBy: { order_no: 'asc' },
        include: {
          tasks: {
            orderBy: [{ due_date: 'asc' }, { created_at: 'asc' }],
            include: {
              owner: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  role: true,
                },
              },
            },
          },
          milestones: {
            orderBy: { title_bn: 'asc' },
          },
        },
      },
      tasks: {
        orderBy: [{ due_date: 'asc' }, { created_at: 'asc' }],
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
            },
          },
        },
      },
      milestones: {
        orderBy: { title_bn: 'asc' },
      },
    },
  });

  if (!plan) {
    return null;
  }

  // Calculate effective due dates for tasks without explicit due_date
  const phaseMap = new Map<string, any>(plan.phases.map((p: any) => [p.id, p] as [string, any]));

  const enrichedPhases = plan.phases.map((phase: any) => {
    const tasksWithDueDates = phase.tasks.map((task: any) => {
      const calculatedDueDate =
        task.due_date || calculateTaskDueDate(plan.start_date, phase.day_end);
      return {
        ...task,
        effective_due_date: calculatedDueDate,
      };
    });
    const progress = calculatePhaseProgress(tasksWithDueDates);
    return {
      ...phase,
      tasks: tasksWithDueDates,
      progress_percent: progress,
    };
  });

  const enrichedTasks = plan.tasks.map((task: any) => {
    const phase = phaseMap.get(task.phase_id);
    const calculatedDueDate =
      task.due_date ||
      (phase ? calculateTaskDueDate(plan.start_date, phase.day_end) : null);
    return {
      ...task,
      effective_due_date: calculatedDueDate,
    };
  });

  const metrics = computePlanMetrics(
    {
      start_date: plan.start_date,
      phases: enrichedPhases,
      tasks: enrichedTasks,
    },
    currentDate
  );

  return {
    plan: {
      ...plan,
      phases: enrichedPhases,
      tasks: enrichedTasks,
    },
    stats: metrics,
    metrics,
  };
}

/**
 * Creates default 90-day plan template with 3 phases and initial tasks/milestones.
 */
export async function createDefaultPlan(
  adminId: string,
  startDateInput?: Date | string,
  name: string = '৯০ দিনের পূর্ণাঙ্গ মার্কেটিং প্ল্যান (90-Day Marketing Plan)'
) {
  const startDateStr = startDateInput
    ? toDhakaDateString(startDateInput)
    : getDhakaDateString();
  const startDate = parseDateOnly(startDateStr);

  return await prisma.$transaction(async (tx) => {
    // 1. Create plan
    const plan = await tx.plan.create({
      data: {
        name,
        start_date: startDate,
        status: PlanStatus.ACTIVE,
        created_by: adminId,
      },
    });

    // 2. Create Phase 1
    const phase1 = await tx.planPhase.create({
      data: {
        plan_id: plan.id,
        name_bn: 'প্রথম ৩০ দিন — বিশ্লেষণ',
        name_en: 'Days 1–30 / Analysis',
        day_start: 1,
        day_end: 30,
        order_no: 1,
      },
    });

    // 3. Create Phase 2
    const phase2 = await tx.planPhase.create({
      data: {
        plan_id: plan.id,
        name_bn: 'দিন ৩১–৬০ — বাস্তবায়ন',
        name_en: 'Days 31–60 / Implementation',
        day_start: 31,
        day_end: 60,
        order_no: 2,
      },
    });

    // 4. Create Phase 3
    const phase3 = await tx.planPhase.create({
      data: {
        plan_id: plan.id,
        name_bn: 'দিন ৬১–৯০ — উন্নয়ন',
        name_en: 'Days 61–90 / Development',
        day_start: 61,
        day_end: 90,
        order_no: 3,
      },
    });

    // Create default tasks
    const p1Due = calculateTaskDueDate(startDate, 30);
    const p2Due = calculateTaskDueDate(startDate, 60);
    const p3Due = calculateTaskDueDate(startDate, 90);

    await tx.planTask.createMany({
      data: [
        {
          plan_id: plan.id,
          phase_id: phase1.id,
          title_bn: 'সব পণ্যের তালিকা, বিক্রির পরিমাণ ও দামের তথ্য সংগ্রহ করা',
          title_en: 'Collect product list, sales volume, prices, and costs',
          due_date: calculateTaskDueDate(startDate, 6),
          status: TaskStatus.DONE,
          progress_percent: 100,
        },
        {
          plan_id: plan.id,
          phase_id: phase1.id,
          title_bn: 'বর্তমান মার্কেটিং চ্যানেল ও বিজ্ঞাপনের ফলাফল পর্যালোচনা',
          title_en: 'Review current marketing channels and ads',
          due_date: calculateTaskDueDate(startDate, 12),
          status: TaskStatus.DONE,
          progress_percent: 100,
        },
        {
          plan_id: plan.id,
          phase_id: phase1.id,
          title_bn: 'পুরোনো ক্রেতা ও সম্ভাব্য ক্রেতার ডেটাবেস তৈরি বা গুছিয়ে ফেলা',
          title_en: 'Build or clean customer and lead database',
          due_date: calculateTaskDueDate(startDate, 18),
          status: TaskStatus.IN_PROGRESS,
          progress_percent: 70,
        },
        {
          plan_id: plan.id,
          phase_id: phase1.id,
          title_bn: 'পণ্যভিত্তিক ক্রেতার ধরন নির্ধারণ',
          title_en: 'Determine buyer types per product',
          due_date: calculateTaskDueDate(startDate, 24),
          status: TaskStatus.IN_PROGRESS,
          progress_percent: 50,
        },
        {
          plan_id: plan.id,
          phase_id: phase1.id,
          title_bn: 'মাসিক বাজেট ও KPI-এর প্রস্তাব তৈরি',
          title_en: 'Draft proposal for monthly budget and KPIs',
          due_date: p1Due,
          status: TaskStatus.NOT_STARTED,
          progress_percent: 0,
        },
        {
          plan_id: plan.id,
          phase_id: phase2.id,
          title_bn: 'বিজ্ঞাপন ও কনটেন্ট ক্যাম্পেইন चालू',
          title_en: 'Launch initial ad and content campaigns',
          due_date: calculateTaskDueDate(startDate, 36),
          status: TaskStatus.NOT_STARTED,
          progress_percent: 0,
        },
        {
          plan_id: plan.id,
          phase_id: phase2.id,
          title_bn: 'কৃষক, পাইকার, রেস্টুরেন্ট ও ডিলারদের সঙ্গে যোগাযোগ',
          title_en: 'Direct outreach to buyers',
          due_date: calculateTaskDueDate(startDate, 42),
          status: TaskStatus.NOT_STARTED,
          progress_percent: 0,
        },
        {
          plan_id: plan.id,
          phase_id: phase2.id,
          title_bn: 'লিড সংগ্রহ, ফলোআপ ও অর্ডার কনভার্সনের নিয়ম',
          title_en: 'Set response and follow-up standards',
          due_date: calculateTaskDueDate(startDate, 48),
          status: TaskStatus.NOT_STARTED,
          progress_percent: 0,
        },
        {
          plan_id: plan.id,
          phase_id: phase2.id,
          title_bn: 'পণ্যের বিক্রির তথ্য ও বিজ্ঞাপনের ফলাফল এক জায়গায়',
          title_en: 'Track weekly channel outcomes',
          due_date: calculateTaskDueDate(startDate, 54),
          status: TaskStatus.NOT_STARTED,
          progress_percent: 0,
        },
        {
          plan_id: plan.id,
          phase_id: phase2.id,
          title_bn: 'সফল ও দুর্বল ক্যাম্পেইন চিহ্নিত করা',
          title_en: 'Review underperforming segments',
          due_date: p2Due,
          status: TaskStatus.NOT_STARTED,
          progress_percent: 0,
        },
        {
          plan_id: plan.id,
          phase_id: phase3.id,
          title_bn: 'ভালো ফল দেওয়া ক্যাম্পেইনে শর্তসাপেক্ষে বাজেট বাড়ানো',
          title_en: 'Scale winning channels carefully',
          due_date: calculateTaskDueDate(startDate, 66),
          status: TaskStatus.NOT_STARTED,
          progress_percent: 0,
        },
        {
          plan_id: plan.id,
          phase_id: phase3.id,
          title_bn: 'পুরোনো ক্রেতার পুনরায় অর্ডারের কার্যক্রম শক্তিশালী করা',
          title_en: 'Strengthen repeat order cadence',
          due_date: calculateTaskDueDate(startDate, 72),
          status: TaskStatus.NOT_STARTED,
          progress_percent: 0,
        },
        {
          plan_id: plan.id,
          phase_id: phase3.id,
          title_bn: 'B2B ক্রেতাদের জন্য নিয়মিত বিক্রয় পাইপলাইন তৈরি',
          title_en: 'Lock in regular B2B accounts',
          due_date: calculateTaskDueDate(startDate, 78),
          status: TaskStatus.NOT_STARTED,
          progress_percent: 0,
        },
        {
          plan_id: plan.id,
          phase_id: phase3.id,
          title_bn: 'কর্মীদের KPI মূল্যায়ন ও প্রয়োজনীয় প্রশিক্ষণ',
          title_en: 'Review performance and adjust processes',
          due_date: calculateTaskDueDate(startDate, 84),
          status: TaskStatus.NOT_STARTED,
          progress_percent: 0,
        },
        {
          plan_id: plan.id,
          phase_id: phase3.id,
          title_bn: 'পরবর্তী ছয় মাসের ব্যবসা সম্প্রসারণ পরিকল্পনা তৈরি',
          title_en: 'Build roadmap for next 6 months',
          due_date: p3Due,
          status: TaskStatus.NOT_STARTED,
          progress_percent: 0,
        },
      ],
    });

    // Create default milestones
    await tx.planMilestone.createMany({
      data: [
        {
          plan_id: plan.id,
          phase_id: phase1.id,
          title_bn: 'প্রথম ৩০ দিনের লক্ষ্য ও মূল্যায়ন',
          expected_result: 'বর্তমান ব্যবসার বেসলাইন, অগ্রাধিকারভিত্তিক পণ্যের তালিকা এবং অনুমোদিত কর্মপরিকল্পনা',
          achieved_result: 'পণ্যের তথ্য ও ডাটাবেস পর্যালোচিত',
          status: MilestoneStatus.MET,
        },
        {
          plan_id: plan.id,
          phase_id: phase2.id,
          title_bn: 'দিন ৩১–৬০ এর লক্ষ্য ও মূল্যায়ন',
          expected_result: 'বাস্তব লিড, অর্ডার, ক্যাম্পেইন পারফরম্যান্স এবং প্রথম দফার উন্নয়নের তথ্য',
          status: MilestoneStatus.PENDING,
        },
        {
          plan_id: plan.id,
          phase_id: phase3.id,
          title_bn: 'দিন ৬১–৯০ এর লক্ষ্য ও মূল্যায়ন',
          expected_result: 'পরিমাপযোগ্য মার্কেটিং ব্যবস্থা, বিক্রির উন্নয়নের প্রমাণ এবং পরবর্তী সময়ের পরিকল্পনা',
          status: MilestoneStatus.PENDING,
        },
      ],
    });

    return plan;
  });
}
