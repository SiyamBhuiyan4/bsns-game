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
  target_quantity: z.coerce.number().min(0, 'টার্গেট পরিমাণ ০ বা তার বেশি হতে হবে').optional().default(0),
  target_deadline: z.string().nullable().optional(),
  target_start_date: z.string().nullable().optional(),
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
      include: {
        sales: {
          select: {
            quantity: true,
            amount: true,
            entry_date: true,
          },
        },
      },
    });

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const enriched = products.map((p: any) => {
      const targetQty = p.target_quantity ? Number(p.target_quantity) : 0;
      const targetDeadline = p.target_deadline ? new Date(p.target_deadline) : null;
      const targetStart = p.target_start_date ? new Date(p.target_start_date) : null;

      const salesList = Array.isArray(p.sales) ? p.sales : [];
      const relevantSales = salesList.filter((s: any) => {
        if (!targetStart) return true;
        const entryTime = new Date(s.entry_date).getTime();
        return entryTime >= targetStart.getTime();
      });

      const achievedQty = relevantSales.reduce((sum: number, s: any) => sum + Number(s.quantity || 0), 0);
      const achievedAmount = relevantSales.reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0);

      let daysRemaining: number | null = null;
      let isOverdue = false;
      let isEndingToday = false;

      if (targetDeadline) {
        const deadlineMidnight = new Date(
          targetDeadline.getFullYear(),
          targetDeadline.getMonth(),
          targetDeadline.getDate()
        ).getTime();
        const diffDays = Math.round((deadlineMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
        daysRemaining = diffDays;
        if (diffDays < 0) {
          isOverdue = true;
        } else if (diffDays === 0) {
          isEndingToday = true;
        }
      }

      const progressPercent = targetQty > 0 ? Math.min(100, Math.round((achievedQty / targetQty) * 100)) : 0;
      const remainingQty = targetQty > achievedQty ? targetQty - achievedQty : 0;
      const dailyNeeded = (daysRemaining && daysRemaining > 0 && remainingQty > 0)
        ? Number((remainingQty / daysRemaining).toFixed(1))
        : 0;

      return {
        id: p.id,
        name_bn: p.name_bn,
        name_en: p.name_en,
        unit: p.unit,
        selling_price: Number(p.selling_price),
        target_quantity: targetQty,
        target_deadline: p.target_deadline ? new Date(p.target_deadline).toISOString().split('T')[0] : null,
        target_start_date: p.target_start_date ? new Date(p.target_start_date).toISOString().split('T')[0] : null,
        achieved_quantity: achievedQty,
        achieved_amount: achievedAmount,
        progress_percentage: progressPercent,
        remaining_quantity: remainingQty,
        days_remaining: daysRemaining,
        daily_needed: dailyNeeded,
        is_overdue: isOverdue,
        is_ending_today: isEndingToday,
        is_completed: targetQty > 0 && achievedQty >= targetQty,
        is_active: p.is_active,
        created_at: p.created_at,
      };
    });

    return NextResponse.json({ products: enriched });
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

    const {
      name_bn,
      name_en,
      unit,
      selling_price,
      target_quantity,
      target_deadline,
      target_start_date,
      is_active,
    } = parse.data;

    const product = await prisma.product.create({
      data: {
        name_bn: name_bn.trim(),
        name_en: name_en.trim(),
        unit: unit.trim(),
        selling_price,
        target_quantity: target_quantity || 0,
        target_deadline: target_deadline ? new Date(`${target_deadline}T23:59:59.999Z`) : null,
        target_start_date: target_start_date ? new Date(`${target_start_date}T00:00:00.000Z`) : new Date(),
        is_active: is_active ?? true,
      },
    });

    await createAuditLog({
      actorId: session.userId,
      action: 'CREATE',
      entity: 'Product',
      entityId: product.id,
      payload: {
        name_bn: product.name_bn,
        name_en: product.name_en,
        selling_price: Number(product.selling_price),
        target_quantity: Number(product.target_quantity || 0),
        target_deadline: product.target_deadline,
      },
    });

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'পণ্য তৈরি ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
