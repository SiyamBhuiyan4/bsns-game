import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { getActivePlan, createDefaultPlan, toDhakaDateString } from '@/lib/plan';
import { parseDateOnly } from '@/lib/date';
import { AuditAction, PlanStatus, UserRole } from '@prisma/client';
import { z } from 'zod';

const planSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'প্ল্যানের নাম ন্যূনতম ২ অক্ষরের হতে হবে').optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'সঠিক তারিখ দিন (YYYY-MM-DD)').optional(),
  status: z.nativeEnum(PlanStatus).optional(),
});

/** Employees see who owns a task, not that person's email or phone. */
function stripContacts<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripContacts) as unknown as T;
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if ((k === 'owner' || k === 'creator') && v && typeof v === 'object') {
      const { email: _e, phone: _p, ...rest } = v as Record<string, unknown>;
      out[k] = rest;
    } else {
      out[k] = stripContacts(v);
    }
  }
  return out as T;
}

/**
 * GET: Return active plan with phases, tasks, milestones, and computed stats.
 * Protected by auth (accessible to ADMIN and EMPLOYEE).
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'লগইন করা নেই / Unauthorized' }, { status: 401 });
  }

  try {
    const [result, employees] = await Promise.all([
      getActivePlan(),
      prisma.user.findMany({
        where: { role: UserRole.EMPLOYEE, is_active: true },
        // Contact details are for admins; employees only need names for assignee labels.
        select:
          session.role === 'ADMIN'
            ? { id: true, name: true, email: true, phone: true }
            : { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    if (!result) {
      return NextResponse.json({
        plan: null,
        stats: null,
        employees,
        currentUser: {
          id: session.userId || session.id,
          name: session.name,
          role: session.role,
          email: session.email,
        },
        message: 'কোন সক্রিয় প্ল্যান পাওয়া যায়নি',
      });
    }

    return NextResponse.json({
      plan: session.role === 'ADMIN' ? result.plan : stripContacts(result.plan),
      stats: result.stats,
      metrics: result.metrics,
      employees,
      currentUser: {
        id: session.userId || session.id,
        name: session.name,
        role: session.role,
        email: session.email,
      },
      currentPhase: result.stats.currentPhase,
      overallProgress: result.stats.overallProgress,
      overdueTasksCount: result.stats.overdueTasksCount,
      phaseProgress: result.stats.phaseProgress,
    });
  } catch (error) {
    console.error('Error fetching active plan:', error);
    return NextResponse.json({ error: 'প্ল্যান লোড করা যায়নি' }, { status: 500 });
  }
}

/**
 * POST: Admin only. Create or update plan (e.g. change start_date, name).
 * Writes AuditLog (PLAN_UPDATE).
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parse = planSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.issues[0]?.message || 'অবৈধ তথ্য' },
        { status: 400 }
      );
    }

    const { id, name, start_date, status } = parse.data;

    // Check if target plan exists (either explicitly by id, or first active plan)
    let plan = id
      ? await prisma.plan.findUnique({ where: { id } })
      : await prisma.plan.findFirst({
          where: { status: PlanStatus.ACTIVE },
          orderBy: { created_at: 'desc' },
        });

    let isNew = false;

    if (plan) {
      // Update existing plan
      const updateData: { name?: string; start_date?: Date; status?: PlanStatus } = {};
      if (name) updateData.name = name.trim();
      if (start_date) updateData.start_date = parseDateOnly(start_date);
      if (status) updateData.status = status;

      plan = await prisma.plan.update({
        where: { id: plan.id },
        data: updateData,
        include: {
          phases: {
            orderBy: { order_no: 'asc' },
          },
        },
      });
    } else {
      // Create new plan with default template
      isNew = true;
      plan = await createDefaultPlan(
        session.userId || session.id,
        start_date,
        name || '৯০ দিনের পূর্ণাঙ্গ মার্কেটিং প্ল্যান (90-Day Marketing Plan)'
      );
    }

    // Write audit log
    await createAuditLog({
      actorId: session.userId || session.id,
      action: AuditAction.PLAN_UPDATE,
      entity: 'Plan',
      entityId: plan.id,
      payload: {
        action: isNew ? 'CREATE_PLAN' : 'UPDATE_PLAN',
        name: plan.name,
        start_date: toDhakaDateString(plan.start_date),
        status: plan.status,
      },
    });

    const activePlanResult = await getActivePlan();

    return NextResponse.json(
      {
        success: true,
        plan: activePlanResult?.plan || plan,
        stats: activePlanResult?.stats,
      },
      { status: isNew ? 201 : 200 }
    );
  } catch (error) {
    console.error('Error creating/updating plan:', error);
    return NextResponse.json({ error: 'প্ল্যান সংরক্ষণ করা যায়নি' }, { status: 500 });
  }
}

export const PATCH = POST;
