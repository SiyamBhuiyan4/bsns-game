import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { AuditAction } from '@prisma/client';
import { z } from 'zod';

const updatePhaseSchema = z.object({
  name_bn: z.string().min(1).optional(),
  name_en: z.string().min(1).optional(),
  day_start: z.number().int().min(1).optional(),
  day_end: z.number().int().min(1).optional(),
  order_no: z.number().int().min(1).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parse = updatePhaseSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.issues[0]?.message || 'অবৈধ তথ্য' },
        { status: 400 }
      );
    }

    const currentPhase = await prisma.planPhase.findUnique({ where: { id } });
    if (!currentPhase) {
      return NextResponse.json({ error: 'ফেজ পাওয়া যায়নি / Phase not found' }, { status: 404 });
    }

    const { name_bn, name_en, day_start, day_end, order_no } = parse.data;

    const updatedPhase = await prisma.planPhase.update({
      where: { id },
      data: {
        ...(name_bn !== undefined ? { name_bn: name_bn.trim() } : {}),
        ...(name_en !== undefined ? { name_en: name_en.trim() } : {}),
        ...(day_start !== undefined ? { day_start } : {}),
        ...(day_end !== undefined ? { day_end } : {}),
        ...(order_no !== undefined ? { order_no } : {}),
      },
    });

    await createAuditLog({
      actorId: session.userId,
      action: AuditAction.PLAN_UPDATE,
      entity: 'PlanPhase',
      entityId: id,
      payload: {
        action: 'UPDATE_PHASE',
        name_bn: updatedPhase.name_bn,
        day_start: updatedPhase.day_start,
        day_end: updatedPhase.day_end,
      },
    });

    return NextResponse.json({ success: true, phase: updatedPhase });
  } catch (error) {
    console.error('Error updating phase:', error);
    return NextResponse.json({ error: 'ফেজ আপডেট ব্যর্থ হয়েছে' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const currentPhase = await prisma.planPhase.findUnique({ where: { id } });
    if (!currentPhase) {
      return NextResponse.json({ error: 'ফেজ পাওয়া যায়নি / Phase not found' }, { status: 404 });
    }

    await prisma.planPhase.delete({ where: { id } });

    await createAuditLog({
      actorId: session.userId,
      action: AuditAction.PLAN_UPDATE,
      entity: 'PlanPhase',
      entityId: id,
      payload: {
        action: 'DELETE_PHASE',
        name_bn: currentPhase.name_bn,
      },
    });

    return NextResponse.json({ success: true, message: 'ফেজ সফলভাবে মুছে ফেলা হয়েছে' });
  } catch (error) {
    console.error('Error deleting phase:', error);
    return NextResponse.json({ error: 'ফেজ মুছে ফেলা সম্ভব হয়নি' }, { status: 500 });
  }
}

export const PUT = PATCH;
