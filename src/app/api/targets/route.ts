import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { checkTargetOverlap } from '@/lib/targets';
import { MetricType, PeriodType, Prisma } from '@prisma/client';
import { endOfMonth } from 'date-fns';
import { z } from 'zod';

const targetSchema = z.object({
  section_id: z.string().uuid(),
  employee_id: z.string().uuid().nullable().optional(),
  metric_type: z.nativeEnum(MetricType),
  target_value: z.number().positive(),
  period_type: z.nativeEnum(PeriodType).default(PeriodType.MONTHLY),
  period_start: z.string().nullable().optional(),
  period_end: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sectionId = searchParams.get('section_id');
    const employeeId = searchParams.get('employee_id');
    const periodType = searchParams.get('period_type') as PeriodType | null;

    const where: any = {};
    if (sectionId) where.section_id = sectionId;
    if (employeeId) where.employee_id = employeeId;
    if (periodType) where.period_type = periodType;

    const targets = await prisma.sectionTarget.findMany({
      where,
      include: {
        section: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true, email: true } },
        employee: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ period_start: 'desc' }, { created_at: 'desc' }],
    });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const targetsWithProgress = await Promise.all(
      targets.map(async (t) => {
        let achieved_value = 0;
        try {
          const pStart =
            t.period_type === PeriodType.DAILY
              ? todayStart
              : t.period_start
              ? new Date(t.period_start)
              : monthStart;
          const pEnd =
            t.period_type === PeriodType.DAILY
              ? todayEnd
              : t.period_end
              ? new Date(t.period_end)
              : monthEnd;

          if (t.metric_type === MetricType.POSTS_DONE) {
            const completionWhere: any = {
              undone_at: null,
              completed_at: { gte: pStart, lte: pEnd },
            };
            if (t.employee_id) completionWhere.employee_id = t.employee_id;
            achieved_value = await prisma.linkCompletion.count({ where: completionWhere });
          } else {
            const entryWhere: any = {
              date: { gte: pStart, lte: pEnd },
            };
            if (t.employee_id) entryWhere.employee_id = t.employee_id;
            const entries = await prisma.dailyEntry.findMany({ where: entryWhere });
            const key = t.metric_type.toLowerCase();
            achieved_value = entries.reduce(
              (acc, e: any) => acc + (Number(e[key]) || 0),
              0
            );
          }
        } catch {
          achieved_value = 0;
        }

        return {
          ...t,
          achieved_value,
        };
      })
    );

    return NextResponse.json({ targets: targetsWithProgress });
  } catch (error) {
    console.error('Error fetching targets:', error);
    return NextResponse.json({ error: 'Failed to fetch targets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = targetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.format() }, { status: 400 });
    }

    const { section_id, employee_id, metric_type, target_value, period_type, period_start, period_end } = parsed.data;

    const pStart = period_start ? new Date(period_start) : null;
    let pEnd = period_end ? new Date(period_end) : null;

    if (period_type === PeriodType.CUSTOM && (!pStart || !pEnd)) {
      return NextResponse.json({ error: 'Custom period requires both start and end dates' }, { status: 400 });
    }
    if (period_type === PeriodType.CUSTOM && pStart && pEnd && pStart > pEnd) {
      return NextResponse.json({ error: 'Start date must be before or equal to end date' }, { status: 400 });
    }
    if (period_type === PeriodType.MONTHLY && !pStart) {
      return NextResponse.json({ error: 'Monthly period requires start date (month)' }, { status: 400 });
    }
    if (period_type === PeriodType.MONTHLY && pStart && !pEnd) {
      pEnd = endOfMonth(pStart);
    }

    // Check for overlapping targets of same section, metric, and period type
    const existingTargets = await prisma.sectionTarget.findMany({
      where: {
        section_id,
        metric_type,
      },
    });

    const candidate = {
      period_type,
      period_start: pStart,
      period_end: pEnd,
    };

    // If there is an exact same period or overlapping CUSTOM range with another CUSTOM target
    for (const existing of existingTargets) {
      if (existing.period_type === candidate.period_type) {
        if (existing.period_type === PeriodType.DAILY) {
          return NextResponse.json(
            { error: 'A daily target for this metric and section already exists. Please update it instead.' },
            { status: 409 }
          );
        }
        if (checkTargetOverlap(existing, candidate)) {
          return NextResponse.json(
            { error: 'Target period overlaps with an existing target for this metric.' },
            { status: 409 }
          );
        }
      }
    }

    const target = await prisma.sectionTarget.create({
      data: {
        section_id,
        employee_id: employee_id ?? null,
        metric_type,
        target_value,
        period_type,
        period_start: pStart,
        period_end: pEnd,
        set_by: session.id,
      },
      include: {
        section: true,
        employee: true,
      },
    });

    await createAuditLog({
      actorId: session.id,
      action: 'TARGET_SET',
      entity: 'SectionTarget',
      entityId: target.id,
      payload: {
        section_id,
        metric_type,
        target_value,
        period_type,
      },
    });

    return NextResponse.json({ target }, { status: 201 });
  } catch (error) {
    console.error('Error creating target:', error);
    return NextResponse.json({ error: 'Failed to create target' }, { status: 500 });
  }
}
