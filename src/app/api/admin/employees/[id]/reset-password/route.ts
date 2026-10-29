import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { hashPassword } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const bodySchema = z.object({ password: z.string().min(6).max(128) });

/** Set an employee's password to one the admin chose. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'পাসওয়ার্ড ৬ থেকে ১২৮ অক্ষরের হতে হবে / Password must be 6 to 128 characters' },
      { status: 400 }
    );
  }

  try {
    const employee = await prisma.user.findUnique({ where: { id } });
    if (!employee || employee.role !== 'EMPLOYEE') {
      return NextResponse.json({ error: 'কর্মী পাওয়া যায়নি' }, { status: 404 });
    }

    const password_hash = await hashPassword(parsed.data.password);

    await prisma.user.update({
      where: { id },
      data: { password_hash, password_changed_at: new Date() },
    });

    await createAuditLog({
      actorId: session.userId,
      action: 'UPDATE',
      entity: 'User',
      entityId: id,
      payload: { action: 'PASSWORD_RESET', employeeEmail: employee.email },
    });

    return NextResponse.json({
      success: true,
      message: 'নতুন পাসওয়ার্ড সেট হয়েছে / New password set',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json({ error: 'পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
