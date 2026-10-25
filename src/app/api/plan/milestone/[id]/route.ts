import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { AuditAction, MilestoneStatus } from '@prisma/client';
import { z } from 'zod';

const updateMilestoneSchema = z.object({
  status: z.nativeEnum(MilestoneStatus).optional(),
  achieved_result: z.string().nullable().optional(),
  title_bn: z.string().optional(),
  expected_result: z.string().optional(),
});

/**
 * PATCH: Admin only. Update milestone review: status (PENDING, MET, PARTIAL, MISSED),
 * achieved_result, reviewed_at = new Date().
 * Writes AuditLog (PLAN_UPDATE).
 */
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
    const parse = updateMilestoneSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.issues[0]?.message || 'অবৈধ তথ্য' },
        { status: 400 }
      );
    }

    const currentMilestone = await prisma.planMilestone.findUnique({ where: { id } });
    if (!currentMilestone) {
      return NextResponse.json(
        { error: 'মাইলস্টোন পাওয়া যায়নি / Milestone not found' },
        { status: 404 }
      );
    }

    const { status, achieved_result, title_bn, expected_result } = parse.data;

    const updatedMilestone = await prisma.planMilestone.update({
      where: { id },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(achieved_result !== undefined ? { achieved_result: achieved_result?.trim() || null } : {}),
        ...(title_bn !== undefined ? { title_bn: title_bn.trim() } : {}),
        ...(expected_result !== undefined ? { expected_result: expected_result.trim() } : {}),
        reviewed_at: new Date(),
      },
      include: {
        phase: true,
      },
    });

    // Write audit log
    await createAuditLog({
      actorId: session.userId,
      action: AuditAction.PLAN_UPDATE,
      entity: 'PlanMilestone',
      entityId: id,
      payload: {
        action: 'UPDATE_MILESTONE_REVIEW',
        old: {
          status: currentMilestone.status,
          achieved_result: currentMilestone.achieved_result,
        },
        new: {
          status: updatedMilestone.status,
          achieved_result: updatedMilestone.achieved_result,
          reviewed_at: updatedMilestone.reviewed_at,
        },
      },
    });

    return NextResponse.json({ success: true, milestone: updatedMilestone });
  } catch (error) {
    console.error('Error updating milestone:', error);
    return NextResponse.json({ error: 'মাইলস্টোন পর্যালোচনা সংরক্ষণ ব্যর্থ হয়েছে' }, { status: 500 });
  }
}

export const PUT = PATCH;
