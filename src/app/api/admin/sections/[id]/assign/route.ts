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
        select: { employee_id: true, post_limit: true },
      }),
    ]);

    const assignedEmployeeIds = assignments.map((a) => a.employee_id);
    const limits: Record<string, number | null> = {};
    assignments.forEach((a) => {
      limits[a.employee_id] = a.post_limit;
    });

    return NextResponse.json({
      employees,
      assignedEmployeeIds,
      assignments,
      limits,
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
    const body = await request.json();
    let employeeIds: string[] = [];
    let limits: Record<string, number | null> = {};

    if (Array.isArray(body.employeeIds)) {
      employeeIds = body.employeeIds;
      if (body.limits && typeof body.limits === 'object') {
        limits = body.limits;
      }
    } else if (Array.isArray(body.assignments)) {
      employeeIds = body.assignments.map((a: any) => a.employee_id);
      body.assignments.forEach((a: any) => {
        limits[a.employee_id] = a.post_limit ? Number(a.post_limit) : null;
      });
    } else {
      return NextResponse.json({ error: 'অবৈধ তথ্য' }, { status: 400 });
    }

    const uniqueIds = Array.from(new Set(employeeIds as string[]));

    // Delete current assignments for this section
    await prisma.assignment.deleteMany({
      where: { section_id: sectionId },
    });

    // Create new assignments
    for (const empId of uniqueIds) {
      const limitVal = limits[empId] && Number(limits[empId]) > 0 ? Number(limits[empId]) : null;
      await prisma.assignment.create({
        data: {
          section_id: sectionId,
          employee_id: empId,
          post_limit: limitVal,
          assigned_by: session.id || session.userId,
        },
      }).catch(() => {});
    }

    await createAuditLog({
      actorId: session.id || session.userId,
      action: 'ASSIGN',
      entity: 'Assignment',
      entityId: sectionId,
      payload: { sectionId, employeeIds: uniqueIds, limits },
    });

    return NextResponse.json({
      success: true,
      message: 'সেকশন অ্যাসাইনমেন্ট ও পোস্ট লিমিট সংরক্ষিত হয়েছে',
      assignedCount: uniqueIds.length,
      limits,
    });
  } catch (error) {
    console.error('Error updating section assignees:', error);
    return NextResponse.json({ error: 'অ্যাসাইনমেন্ট ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
