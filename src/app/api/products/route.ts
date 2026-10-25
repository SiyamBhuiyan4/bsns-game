import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const productSchema = z.object({
  name_bn: z.string().min(2, 'বাংলা নাম প্রদান করুন'),
  name_en: z.string().min(2, 'ইংরেজি নাম প্রদান করুন'),
  unit: z.string().min(1, 'পরিমাপের একক প্রদান করুন (যেমন: kg, packet, bottle)'),
  selling_price: z.coerce.number().positive('বিক্রয়মূল্য ধনাত্মক হতে হবে'),
  is_active: z.boolean().optional().default(true),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'লগইন করা নেই' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get('all') === 'true' && session.role === 'ADMIN';

  try {
    const products = await prisma.product.findMany({
      where: includeInactive ? undefined : { is_active: true },
      orderBy: { created_at: 'asc' },
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'পণ্য তালিকা লোড করা যায়নি' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parse = productSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.issues[0]?.message || 'অবৈধ তথ্য' }, { status: 400 });
    }

    const { name_bn, name_en, unit, selling_price, is_active } = parse.data;

    const product = await prisma.product.create({
      data: {
        name_bn: name_bn.trim(),
        name_en: name_en.trim(),
        unit: unit.trim(),
        selling_price,
        is_active: is_active ?? true,
      },
    });

    await createAuditLog({
      actorId: session.userId,
      action: 'CREATE',
      entity: 'Product',
      entityId: product.id,
      payload: { name_bn: product.name_bn, name_en: product.name_en, selling_price: Number(product.selling_price) },
    });

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'পণ্য তৈরি ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
