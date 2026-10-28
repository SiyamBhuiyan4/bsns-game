import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { quotaStatuses } from '@/lib/task-quota-server';

/** The signed-in employee's task requirement for today. */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'EMPLOYEE') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }
  try {
    return NextResponse.json({ quotas: await quotaStatuses([session.userId]) });
  } catch (error) {
    console.error('task-quota GET failed:', error);
    return NextResponse.json({ error: 'ডাটা লোড করতে সমস্যা হয়েছে' }, { status: 500 });
  }
}
