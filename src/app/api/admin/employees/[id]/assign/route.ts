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

  const { id: employeeId } = await params;

  try {
    const { sectionIds } = await request.json();
    if (!Array.isArray(sectionIds)) {
      return NextResponse.json({ error: 'অবৈধ তথ্য' }, { status: 400 });
    }

    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      include: { assignments_as_employee: true },
    });

    if (!employee || employee.role !== 'EMPLOYEE') {
      return NextResponse.json({ error: 'কর্মী পাওয়া যায়নি' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete previous assignments
      await tx.assignment.deleteMany({
        where: { employee_id: employeeId },
      });

      // 2. Insert new assignments
      const uniqueSectionIds = Array.from(new Set(sectionIds as string[]));
      if (uniqueSectionIds.length > 0) {
        await tx.assignment.createMany({
          data: uniqueSectionIds.map((secId) => ({
            employee_id: employeeId,
            section_id: secId,
            assigned_by: session.userId,
          })),
          skipDuplicates: true,
        });
      }
    });

    await createAuditLog({
      actorId: session.userId,
      action: 'ASSIGN',
      entity: 'Assignment',
      entityId: employeeId,
      payload: { employeeId, assignedSectionCount: sectionIds.length, sectionIds },
    });

    return NextResponse.json({
      success: true,
      message: 'সেকশন অ্যাসাইনমেন্ট সফলভাবে আপডেট হয়েছে',
      assignedCount: sectionIds.length,
    });
  } catch (error) {
    console.error('Error assigning sections:', error);
    return NextResponse.json({ error: 'অ্যাসাইনমেন্ট ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
