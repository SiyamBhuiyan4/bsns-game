import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { MetricType, PeriodType } from '@prisma/client';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  const { id: employeeId } = await params;

  try {
    const assignments = await prisma.assignment.findMany({
      where: { employee_id: employeeId },
      include: {
        section: { select: { id: true, name: true, is_active: true } },
      },
    });

    // Also fetch any SectionTarget records for POSTS_DONE for this employee
    const targets = await prisma.sectionTarget.findMany({
      where: {
        employee_id: employeeId,
        metric_type: MetricType.POSTS_DONE,
      },
      select: { section_id: true, target_value: true },
    });

    const targetMap = new Map<string, number>();
    for (const t of targets) {
      if (t.section_id) {
        targetMap.set(t.section_id, Number(t.target_value));
      }
    }

    const assignedSections = assignments.map((a) => ({
      section_id: a.section_id,
      section_name: a.section?.name || '',
      post_limit: a.post_limit ?? targetMap.get(a.section_id) ?? null,
    }));

    return NextResponse.json({
      assignments: assignedSections,
      sectionIds: assignments.map((a) => a.section_id),
      limits: Object.fromEntries(assignedSections.map((a) => [a.section_id, a.post_limit])),
    });
  } catch (error) {
    console.error('Error fetching employee assignments:', error);
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

  const { id: employeeId } = await params;

  try {
    const body = await request.json();
    let sectionIds: string[] = [];
    const limits: Record<string, number | null> = {};

    if (Array.isArray(body.assignments)) {
      sectionIds = body.assignments.map((a: any) => a.section_id);
      body.assignments.forEach((a: any) => {
        limits[a.section_id] = a.post_limit && Number(a.post_limit) > 0 ? Number(a.post_limit) : null;
      });
    } else if (Array.isArray(body.sectionIds)) {
      sectionIds = body.sectionIds;
      if (body.limits && typeof body.limits === 'object') {
        Object.entries(body.limits).forEach(([secId, val]) => {
          limits[secId] = val && Number(val) > 0 ? Number(val) : null;
        });
      }
    } else {
      return NextResponse.json({ error: 'অবৈধ তথ্য' }, { status: 400 });
    }

    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      include: { assignments_as_employee: true },
    });

    if (!employee || employee.role !== 'EMPLOYEE') {
      return NextResponse.json({ error: 'কর্মী পাওয়া যায়নি' }, { status: 404 });
    }

    const uniqueSectionIds = Array.from(new Set(sectionIds as string[]));

    await prisma.$transaction(async (tx) => {
      // 1. Delete previous assignments
      await tx.assignment.deleteMany({
        where: { employee_id: employeeId },
      });

      // 2. Insert new assignments with post_limit
      if (uniqueSectionIds.length > 0) {
        for (const secId of uniqueSectionIds) {
          const limitVal = limits[secId] ?? null;
          await tx.assignment.create({
            data: {
              employee_id: employeeId,
              section_id: secId,
              post_limit: limitVal,
              assigned_by: session.id || session.userId,
            },
          });

          // Sync SectionTarget for POSTS_DONE for this employee & section
          if (limitVal && limitVal > 0) {
            const existingTarget = await tx.sectionTarget.findFirst({
              where: {
                employee_id: employeeId,
                section_id: secId,
                metric_type: MetricType.POSTS_DONE,
              },
            });
            if (existingTarget) {
              await tx.sectionTarget.update({
                where: { id: existingTarget.id },
                data: { target_value: limitVal },
              });
            } else {
              await tx.sectionTarget.create({
                data: {
                  employee_id: employeeId,
                  section_id: secId,
                  metric_type: MetricType.POSTS_DONE,
                  target_value: limitVal,
                  period_type: PeriodType.MONTHLY,
                  set_by: session.id || session.userId,
                },
              });
            }
          }
        }
      }
    });

    await createAuditLog({
      actorId: session.id || session.userId,
      action: 'ASSIGN',
      entity: 'Assignment',
      entityId: employeeId,
      payload: { employeeId, assignedSectionCount: uniqueSectionIds.length, sectionIds: uniqueSectionIds, limits },
    });

    return NextResponse.json({
      success: true,
      message: 'সেকশন অ্যাসাইনমেন্ট ও পোস্ট লিমিট সফলভাবে সংরক্ষিত হয়েছে',
      assignedCount: uniqueSectionIds.length,
      limits,
    });
  } catch (error) {
    console.error('Error assigning sections:', error);
    return NextResponse.json({ error: 'অ্যাসাইনমেন্ট ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
