import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { targetStatuses } from '@/lib/task-quota-server';

/** Today's mandatory and optional share of each running target: every employee's for admins, your own otherwise. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 401 });
  }
  try {
    if (session.role !== 'ADMIN') {
      return NextResponse.json({ statuses: await targetStatuses([session.userId]) });
    }
    const [statuses, employees] = await Promise.all([
      targetStatuses(),
      prisma.user.findMany({ where: { role: 'EMPLOYEE' }, select: { id: true, name: true } }),
    ]);
    const names = new Map(employees.map((e: any) => [e.id, e.name]));
    return NextResponse.json({
      statuses: statuses.map((s) => ({ ...s, employeeName: names.get(s.employeeId) ?? '—' })),
    });
  } catch (error) {
    console.error('targets/today GET failed:', error);
    return NextResponse.json({ error: 'ডাটা লোড করতে সমস্যা হয়েছে' }, { status: 500 });
  }
}
