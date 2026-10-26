import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { AuditAction } from '@prisma/client';
import { z } from 'zod';

const createPhaseSchema = z.object({
  plan_id: z.string(),
  name_bn: z.string().min(1),
  name_en: z.string().min(1),
  day_start: z.number().int().min(1),
  day_end: z.number().int().min(1),
  order_no: z.number().int().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parse = createPhaseSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.issues[0]?.message || 'অবৈধ তথ্য' },
        { status: 400 }
      );
    }

    const { plan_id, name_bn, name_en, day_start, day_end, order_no } = parse.data;

    let finalOrderNo = order_no;
    if (!finalOrderNo) {
      const maxPhase = await prisma.planPhase.findFirst({
        where: { plan_id },
        orderBy: { order_no: 'desc' },
      });
      finalOrderNo = (maxPhase?.order_no || 0) + 1;
    }

    const phase = await prisma.planPhase.create({
      data: {
        plan_id,
        name_bn: name_bn.trim(),
        name_en: name_en.trim(),
        day_start,
        day_end,
        order_no: finalOrderNo,
      },
    });

    await createAuditLog({
      actorId: session.userId,
      action: AuditAction.PLAN_UPDATE,
      entity: 'PlanPhase',
      entityId: phase.id,
      payload: {
        action: 'CREATE_PHASE',
        name_bn: phase.name_bn,
        day_start: phase.day_start,
        day_end: phase.day_end,
      },
    });

    return NextResponse.json({ success: true, phase }, { status: 201 });
  } catch (error) {
    console.error('Error creating phase:', error);
    return NextResponse.json({ error: 'নতুন ফেজ তৈরি করা যায়নি' }, { status: 500 });
  }
}
