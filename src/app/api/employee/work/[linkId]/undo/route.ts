import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'EMPLOYEE') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  const { linkId } = await params;

  try {
    // 1. Check if undo is enabled in scoring settings
    const settings = await prisma.scoringSettings.findUnique({ where: { id: 'default' } });
    if (settings && !settings.undo_enabled) {
      return NextResponse.json(
        { error: 'অ্যাডমিন কর্তৃক আনডু (Undo) সুবিধা নিষ্ক্রিয় রাখা হয়েছে' },
        { status: 403 }
      );
    }

    // 2. Find active completion for this employee
    const activeCompletion = await prisma.linkCompletion.findFirst({
      where: {
        group_link_id: linkId,
        employee_id: session.userId,
        undone_at: null,
      },
      orderBy: { completed_at: 'desc' },
    });

    if (!activeCompletion) {
      // Graceful duplicate check: check if it was already undone
      const recentlyUndone = await prisma.linkCompletion.findFirst({
        where: {
          group_link_id: linkId,
          employee_id: session.userId,
          undone_at: { not: null },
        },
        orderBy: { undone_at: 'desc' },
      });

      if (recentlyUndone) {
        return NextResponse.json({
          success: true,
          alreadyUndone: true,
          message: 'ইতিমধ্যে আনডু করা হয়েছে (Already undone)',
        });
      }

      return NextResponse.json(
        { error: 'কোনো সক্রিয় সম্পন্ন রেকর্ড পাওয়া যায়নি' },
        { status: 404 }
      );
    }

    // 3. Mark undone. Every active completion of this link is cleared, so a duplicate left by
    // an old double click cannot keep the link stuck in the completed list.
    const undoneAt = new Date();
    await prisma.linkCompletion.updateMany({
      where: {
        group_link_id: linkId,
        employee_id: session.userId,
        undone_at: null,
      },
      data: { undone_at: undoneAt },
    });
    const updated = { ...activeCompletion, undone_at: undoneAt };

    // 4. Audit Log
    await createAuditLog({
      actorId: session.userId,
      action: 'UNDO',
      entity: 'LinkCompletion',
      entityId: updated.id,
      payload: { groupLinkId: linkId, employeeId: session.userId, completedAt: updated.completed_at },
    });

    return NextResponse.json({
      success: true,
      message: 'লিংকটি পুনরায় সম্পন্ন করার তালিকায় ফিরিয়ে আনা হয়েছে (Undone successfully)',
    });
  } catch (error) {
    console.error('Error undoing link completion:', error);
    return NextResponse.json({ error: 'আনডু সম্পন্ন করা যায়নি' }, { status: 500 });
  }
}
