import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { hashPassword } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const employee = await prisma.user.findUnique({ where: { id } });
    if (!employee || employee.role !== 'EMPLOYEE') {
      return NextResponse.json({ error: 'কর্মী পাওয়া যায়নি' }, { status: 404 });
    }

    // Generate random 8-character temporary password
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let tempPassword = '';
    for (let i = 0; i < 10; i++) {
      tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const password_hash = await hashPassword(tempPassword);

    await prisma.user.update({
      where: { id },
      data: { password_hash },
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
      temporaryPassword: tempPassword,
      message: 'সাময়িক পাসওয়ার্ড তৈরি করা হয়েছে। এটি শুধুমাত্র একবার দেখানো হবে।',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json({ error: 'পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
