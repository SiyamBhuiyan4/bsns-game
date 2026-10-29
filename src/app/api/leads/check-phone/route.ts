import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { normalizePhone, isValidBdPhone } from '@/lib/phone';
import { makeTranslator } from '@/lib/i18n/translate';
import { readLangFromRequest } from '@/lib/i18n/request-lang';

export async function GET(request: NextRequest) {
  // Only the "no owner" placeholder is translated; a real owner name is data.
  const L = makeTranslator(readLangFromRequest(request));

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

    // An employee learns only that the number is taken unless the customer is their own;
    // otherwise typing numbers here would reveal other people's customers.
    const isOwnLead = existing.owner_id === session.userId;
    if (session.role !== 'ADMIN' && !isOwnLead) {
      return NextResponse.json({ exists: true, valid: true, isOwnLead: false });
    }

    return NextResponse.json({
      exists: true,
      valid: true,
      leadId: existing.id,
      leadName: existing.name,
      ownerName: existing.owner?.name || L('সিস্টেম'),
      ownerEmail: session.role === 'ADMIN' ? existing.owner?.email : undefined,
      status: existing.status,
      isOwnLead,
      createdAt: existing.created_at,
    });
  } catch (error) {
    console.error('Phone check error:', error);
    return NextResponse.json({ error: 'ফোন নম্বর যাচাই ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
