import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'লগইন করা নেই' }, { status: 401 });
  }

  const { id: leadId } = await params;

  try {
    const { note } = await request.json();
    if (!note || note.trim().length === 0) {
      return NextResponse.json({ error: 'নোটের বিবরণ প্রদান করুন' }, { status: 400 });
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ error: 'লিড পাওয়া যায়নি' }, { status: 404 });
    }

    if (session.role === 'EMPLOYEE' && lead.owner_id !== session.userId) {
      return NextResponse.json({ error: 'এই লিডে নোট লেখার অনুমতি নেই' }, { status: 403 });
    }

    const newNote = await prisma.leadNote.create({
      data: {
        lead_id: leadId,
        author_id: session.userId,
        note: note.trim(),
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
      },
    });

    await createAuditLog({
      actorId: session.userId,
      action: 'LEAD_UPDATE',
      entity: 'LeadNote',
      entityId: newNote.id,
      payload: { leadId, note: newNote.note },
    });

    return NextResponse.json({ success: true, note: newNote }, { status: 201 });
  } catch (error) {
    console.error('Error adding note to lead:', error);
    return NextResponse.json({ error: 'নোট সংরক্ষণ ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
