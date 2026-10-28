import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { quotaStatuses } from '@/lib/task-quota-server';

const quotaSchema = z.object({
  employee_id: z.string().min(1),
  section_id: z.string().min(1).nullable().optional(),
  period: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  amount: z.number().int().min(1).max(10000),
  off_days: z.array(z.number().int().min(0).max(6)).max(6).default([]),
});

async function requireAdmin() {
  const session = await getSession();
  return session && session.role === 'ADMIN' ? session : null;
}

/** All quotas with each one's requirement for today. */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }
  try {
    const [statuses, employees] = await Promise.all([
      quotaStatuses(),
      prisma.user.findMany({ where: { role: 'EMPLOYEE' }, select: { id: true, name: true } }),
    ]);
    const names = new Map(employees.map((e: any) => [e.id, e.name]));
    return NextResponse.json({
      quotas: statuses.map((s) => ({ ...s, employeeName: names.get(s.employeeId) ?? '—' })),
    });
  } catch (error) {
    console.error('task-quotas GET failed:', error);
    return NextResponse.json({ error: 'ডাটা লোড করতে সমস্যা হয়েছে' }, { status: 500 });
  }
}

/** Create a quota, or replace the one this employee already has for the same section. */
export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }
  try {
    const parsed = quotaSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'অবৈধ তথ্য' }, { status: 400 });
    }
    const data = parsed.data;
    const sectionId = data.section_id ?? null;
    const offDays = [...new Set(data.off_days)].sort();

    const employee = await prisma.user.findUnique({ where: { id: data.employee_id } });
    if (!employee || employee.role !== 'EMPLOYEE') {
      return NextResponse.json({ error: 'কর্মী পাওয়া যায়নি' }, { status: 404 });
    }

    const existing = await prisma.taskQuota.findFirst({
      where: { employee_id: data.employee_id, section_id: sectionId },
    });
    const fields = { period: data.period, amount: data.amount, off_days: offDays, is_active: true };
    const quota = existing
      ? await prisma.taskQuota.update({ where: { id: existing.id }, data: fields })
      : await prisma.taskQuota.create({
          data: { ...fields, employee_id: data.employee_id, section_id: sectionId, created_by: session.userId },
        });

    await createAuditLog({
      actorId: session.userId,
      action: 'TARGET_SET',
      entity: 'TaskQuota',
      entityId: quota.id,
      payload: { ...fields, employee_id: data.employee_id, section_id: sectionId },
    });
    return NextResponse.json({ success: true, quota });
  } catch (error) {
    console.error('task-quotas POST failed:', error);
    return NextResponse.json({ error: 'তথ্য সংরক্ষণ করা যায়নি' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'অবৈধ তথ্য' }, { status: 400 });
  try {
    await prisma.taskQuota.delete({ where: { id } });
    await createAuditLog({ actorId: session.userId, action: 'DELETE', entity: 'TaskQuota', entityId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('task-quotas DELETE failed:', error);
    return NextResponse.json({ error: 'ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
