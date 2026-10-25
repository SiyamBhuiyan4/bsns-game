import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const updateEmployeeSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional(),
  is_active: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parse = updateEmployeeSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: 'অবৈধ তথ্য' }, { status: 400 });
    }

    const current = await prisma.user.findUnique({ where: { id } });
    if (!current || current.role !== 'EMPLOYEE') {
      return NextResponse.json({ error: 'কর্মী পাওয়া যায়নি' }, { status: 404 });
    }

    const { name, phone, email, is_active } = parse.data;

    if (email && email.toLowerCase() !== current.email.toLowerCase()) {
      const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: 'এই ইমেইল ইতিমধ্যে অন্য একাউন্টে ব্যবহৃত' }, { status: 400 });
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
        ...(email ? { email: email.toLowerCase().trim() } : {}),
        ...(is_active !== undefined ? { is_active } : {}),
      },
    });

    await createAuditLog({
      actorId: session.userId,
      action: 'UPDATE',
      entity: 'User',
      entityId: id,
      payload: {
        old: { name: current.name, is_active: current.is_active, phone: current.phone },
        new: { name: updated.name, is_active: updated.is_active, phone: updated.phone },
      },
    });

    return NextResponse.json({ success: true, employee: updated });
  } catch (error) {
    console.error('Error updating employee:', error);
    return NextResponse.json({ error: 'আপডেট ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
