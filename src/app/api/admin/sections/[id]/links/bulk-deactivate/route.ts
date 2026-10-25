import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  const { id: sectionId } = await params;

  try {
    let body: { linkIds?: string[]; all?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { linkIds, all } = body;

    const where: {
      section_id: string;
      id?: { in: string[] };
      is_active?: boolean;
    } = {
      section_id: sectionId,
    };

    if (Array.isArray(linkIds) && linkIds.length > 0) {
      where.id = { in: linkIds };
    } else if (all === true || linkIds === undefined) {
      // Deactivate all active links in the section
      where.is_active = true;
    } else {
      return NextResponse.json({ error: 'অন্তত একটি লিঙ্ক নির্বাচন করুন' }, { status: 400 });
    }

    const updated = await prisma.groupLink.updateMany({
      where,
      data: {
        is_active: false,
      },
    });

    await createAuditLog({
      actorId: session.userId,
      action: 'UPDATE',
      entity: 'GroupLink',
      payload: { sectionId, action: 'BULK_DEACTIVATE', count: updated.count, linkIds: linkIds || 'ALL' },
    });

    return NextResponse.json({
      success: true,
      message: `${updated.count}টি লিঙ্ক নিষ্ক্রিয় করা হয়েছে (Deactivated successfully)`,
      count: updated.count,
      updatedCount: updated.count,
    });
  } catch (error) {
    console.error('Error bulk deactivating links:', error);
    return NextResponse.json({ error: 'বাল্ক নিষ্ক্রিয়করণ ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
