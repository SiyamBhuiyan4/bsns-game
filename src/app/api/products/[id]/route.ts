import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const updateProductSchema = z.object({
  name_bn: z.string().min(2, 'বাংলা নাম কমপক্ষে ২ অক্ষরের হতে হবে').optional(),
  name_en: z.string().min(2, 'ইংরেজি নাম কমপক্ষে ২ অক্ষরের হতে হবে').optional(),
  unit: z.string().min(1, 'পরিমাপের একক প্রদান করুন').optional(),
  selling_price: z.coerce.number().positive('বিক্রয়মূল্য ধনাত্মক হতে হবে').optional(),
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
    const parse = updateProductSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.issues[0]?.message || 'অবৈধ তথ্য' }, { status: 400 });
    }

    const current = await prisma.product.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: 'পণ্য পাওয়া যায়নি' }, { status: 404 });
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(parse.data.name_bn ? { name_bn: parse.data.name_bn.trim() } : {}),
        ...(parse.data.name_en ? { name_en: parse.data.name_en.trim() } : {}),
        ...(parse.data.unit ? { unit: parse.data.unit.trim() } : {}),
        ...(parse.data.selling_price !== undefined ? { selling_price: parse.data.selling_price } : {}),
        ...(parse.data.is_active !== undefined ? { is_active: parse.data.is_active } : {}),
      },
    });

    await createAuditLog({
      actorId: session.userId,
      action: 'UPDATE',
      entity: 'Product',
      entityId: id,
      payload: {
        old: { name_bn: current.name_bn, price: Number(current.selling_price), active: current.is_active },
        new: { name_bn: updated.name_bn, price: Number(updated.selling_price), active: updated.is_active },
      },
    });

    return NextResponse.json({ success: true, product: updated });
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'পণ্য আপডেট ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
