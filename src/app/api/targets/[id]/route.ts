import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { endOfMonth } from 'date-fns';
import { MetricType, PeriodType } from '@prisma/client';
import { z } from 'zod';

const updateTargetSchema = z.object({
  target_value: z.number().positive().optional(),
  employee_id: z.string().uuid().nullable().optional(),
  section_id: z.string().uuid().nullable().optional(),
  metric_type: z.nativeEnum(MetricType).optional(),
  period_type: z.nativeEnum(PeriodType).optional(),
  period_start: z.string().nullable().optional(),
  period_end: z.string().nullable().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = updateTargetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.format() }, { status: 400 });
    }

    const existing = await prisma.sectionTarget.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    const pStart =
      parsed.data.period_start !== undefined
        ? parsed.data.period_start
          ? new Date(parsed.data.period_start)
          : null
        : existing.period_start;

    let pEnd =
      parsed.data.period_end !== undefined
        ? parsed.data.period_end
          ? new Date(parsed.data.period_end)
          : null
        : existing.period_end;

    if (existing.period_type === PeriodType.MONTHLY && pStart && (!parsed.data.period_end || !pEnd)) {
      pEnd = endOfMonth(pStart);
    }

    if (existing.period_type === PeriodType.CUSTOM && pStart && pEnd && pStart > pEnd) {
      return NextResponse.json({ error: 'Start date must be before or equal to end date' }, { status: 400 });
    }

    const updated = await prisma.sectionTarget.update({
      where: { id },
      data: {
        ...(parsed.data.target_value !== undefined && { target_value: parsed.data.target_value }),
        ...(parsed.data.employee_id !== undefined && { employee_id: parsed.data.employee_id }),
        ...(parsed.data.section_id !== undefined && { section_id: parsed.data.section_id }),
        ...(parsed.data.metric_type !== undefined && { metric_type: parsed.data.metric_type }),
        ...(parsed.data.period_type !== undefined && { period_type: parsed.data.period_type }),
        ...(parsed.data.period_start !== undefined && { period_start: pStart }),
        ...(parsed.data.period_end !== undefined || (existing.period_type === PeriodType.MONTHLY && parsed.data.period_start !== undefined)
          ? { period_end: pEnd }
          : {}),
      },
    });

    await createAuditLog({
      actorId: session.id,
      action: 'TARGET_SET',
      entity: 'SectionTarget',
      entityId: id,
      payload: { updated: parsed.data },
    });

    return NextResponse.json({ target: updated });
  } catch (error) {
    console.error('Error updating target:', error);
    return NextResponse.json({ error: 'Failed to update target' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await prisma.sectionTarget.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    await prisma.sectionTarget.delete({ where: { id } });

    await createAuditLog({
      actorId: session.id,
      action: 'TARGET_SET',
      entity: 'SectionTarget',
      entityId: id,
      payload: { deleted: true, previous: existing },
    });

    return NextResponse.json({ message: 'Target deleted successfully' });
  } catch (error) {
    console.error('Error deleting target:', error);
    return NextResponse.json({ error: 'Failed to delete target' }, { status: 500 });
  }
}
