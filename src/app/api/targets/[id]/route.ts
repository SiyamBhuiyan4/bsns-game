import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { checkTargetOverlap } from '@/lib/targets';
import { endOfMonth } from 'date-fns';
import { PeriodType } from '@prisma/client';
import { z } from 'zod';

const updateTargetSchema = z.object({
  target_value: z.number().positive().optional(),
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

    // Overlap validation preventing duplicate overlapping targets when dates are updated
    if (parsed.data.period_start !== undefined || parsed.data.period_end !== undefined) {
      const otherTargets = await prisma.sectionTarget.findMany({
        where: {
          section_id: existing.section_id,
          metric_type: existing.metric_type,
          id: { not: id },
        },
      });

      const candidate = {
        period_type: existing.period_type,
        period_start: pStart,
        period_end: pEnd,
      };

      for (const other of otherTargets) {
        if (other.period_type === candidate.period_type) {
          if (other.period_type === PeriodType.DAILY) {
            return NextResponse.json(
              { error: 'A daily target for this metric and section already exists. Please update it instead.' },
              { status: 409 }
            );
          }
          if (checkTargetOverlap(other, candidate)) {
            return NextResponse.json(
              { error: 'Target period overlaps with an existing target for this metric.' },
              { status: 409 }
            );
          }
        }
      }
    }

    const updated = await prisma.sectionTarget.update({
      where: { id },
      data: {
        ...(parsed.data.target_value !== undefined && { target_value: parsed.data.target_value }),
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
