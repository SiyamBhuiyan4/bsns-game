import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  const { id: sectionId } = await params;

  try {
    const [employees, assignments] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'EMPLOYEE', is_active: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      }),
      prisma.assignment.findMany({
        where: { section_id: sectionId },
        select: { employee_id: true },
      }),
    ]);

    const assignedEmployeeIds = assignments.map((a) => a.employee_id);

    return NextResponse.json({
      employees,
      assignedEmployeeIds,
    });
  } catch (error) {
    console.error('Error fetching section assignees:', error);
    return NextResponse.json({ error: 'ব্যর্থ হয়েছে' }, { status: 500 });
  }
}

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
    const { employeeIds } = await request.json();
    if (!Array.isArray(employeeIds)) {
      return NextResponse.json({ error: 'অবৈধ তথ্য' }, { status: 400 });
    }

    const uniqueIds = Array.from(new Set(employeeIds as string[]));

    // Delete current assignments for this section
    await prisma.assignment.deleteMany({
      where: { section_id: sectionId },
    });

    // Create new assignments
    for (const empId of uniqueIds) {
      await prisma.assignment.create({
        data: {
          section_id: sectionId,
          employee_id: empId,
          assigned_by: session.id || session.userId,
        },
      }).catch(() => {});
    }

    await createAuditLog({
      actorId: session.id || session.userId,
      action: 'ASSIGN',
      entity: 'Assignment',
      entityId: sectionId,
      payload: { sectionId, employeeIds: uniqueIds },
    });

    return NextResponse.json({
      success: true,
      message: 'সেকশন অ্যাসাইনমেন্ট সংরক্ষিত হয়েছে',
      assignedCount: uniqueIds.length,
    });
  } catch (error) {
    console.error('Error updating section assignees:', error);
    return NextResponse.json({ error: 'অ্যাসাইনমেন্ট ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
