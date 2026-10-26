import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { normalizePhone, isValidBdPhone } from '@/lib/phone';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'লগইন করা নেই' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawPhone = searchParams.get('phone') || '';
  const normalized = normalizePhone(rawPhone);

  if (!isValidBdPhone(normalized)) {
    return NextResponse.json({ exists: false, valid: false });
  }

  try {
    const existing = await prisma.lead.findFirst({
      where: { phone: normalized },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ exists: false, valid: true });
    }

    return NextResponse.json({
      exists: true,
      valid: true,
      leadId: existing.id,
      leadName: existing.name,
      ownerName: existing.owner?.name || 'সিস্টেম',
      ownerEmail: session.role === 'ADMIN' ? existing.owner?.email : undefined,
      status: existing.status,
      isOwnLead: existing.owner_id === session.userId,
      createdAt: existing.created_at,
    });
  } catch (error) {
    console.error('Phone check error:', error);
    return NextResponse.json({ error: 'ফোন নম্বর যাচাই ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
