import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { normalizePhone, isValidBdPhone, maskPhone } from '@/lib/phone';
import { BuyerType, LeadStatus, MetricType, Prisma } from '@prisma/client';
import { getDhakaDateString } from '@/lib/date';
import { parseISO } from 'date-fns';
import { z } from 'zod';

const createLeadSchema = z.object({
  name: z.string().min(2, 'ক্রেতা বা লিডের নাম প্রদান করুন'),
  phone: z.string(),
  address: z.string().optional().nullable(),
  buyer_type: z.nativeEnum(BuyerType).optional().default('RETAIL'),
  product_id: z.string().optional().nullable(),
  campaign_id: z.string().optional().nullable(),
  source_channel: z.string().min(1, 'সোর্স চ্যানেল উল্লেখ করুন (যেমন: ফেসবুক গ্রুপ, বিজ্ঞাপন)'),
  owner_id: z.string().optional().nullable(),
  status: z.nativeEnum(LeadStatus).optional().default('NEW'),
  quality_rating: z.number().int().min(1).max(5).optional().nullable(),
  expected_value: z.number().min(0).optional().nullable(),
  order_amount: z.number().min(0).optional().nullable(),
  lost_reason: z.string().optional().nullable(),
  next_followup_date: z.string().optional().nullable(),
  initial_note: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'লগইন করা নেই' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') as LeadStatus | null;
  const buyerType = searchParams.get('buyerType') as BuyerType | null;
  const marketerId = searchParams.get('marketerId') || searchParams.get('ownerId') || null;
  const channel = searchParams.get('channel')?.trim() || null;
  const startDate = searchParams.get('startDate') || null;
  const endDate = searchParams.get('endDate') || null;
  const unfinishedOnly = searchParams.get('unfinished') === 'true';
  const searchQuery = searchParams.get('q')?.trim() || '';

  try {
    const conditions: Prisma.LeadWhereInput[] = [];

    // 1. Role-based scoping rule:
    // "Employee sees only own leads. Admin sees all."
    if (session.role === 'EMPLOYEE') {
      conditions.push({ owner_id: session.userId });
    } else if (marketerId && marketerId !== 'ALL') {
      conditions.push({ owner_id: marketerId });
    }

    if (status && (status as string) !== 'ALL') {
      conditions.push({ status });
    }

    if (buyerType && (buyerType as string) !== 'ALL') {
      conditions.push({ buyer_type: buyerType });
    }

    if (channel && channel !== 'ALL') {
      conditions.push({ source_channel: { contains: channel, mode: 'insensitive' } });
    }

    if (startDate || endDate) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (startDate) {
        dateFilter.gte = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        dateFilter.lte = new Date(`${endDate}T23:59:59.999Z`);
      }
      conditions.push({ created_at: dateFilter });
    }

    // 2. Acceptance Test 15: Unfinished orders list:
    // "QUALIFIED leads with no order after 3 days, highlighted."
    if (unfinishedOnly) {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      conditions.push({
        status: 'QUALIFIED',
        OR: [
          { updated_at: { lte: threeDaysAgo } },
          { created_at: { lte: threeDaysAgo } },
        ],
      });
    }

    if (searchQuery) {
      conditions.push({
        OR: [
          { name: { contains: searchQuery, mode: 'insensitive' } },
          { phone: { contains: searchQuery } },
          { source_channel: { contains: searchQuery, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.LeadWhereInput = conditions.length > 0 ? { AND: conditions } : {};

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      include: {
        product: { select: { id: true, name_bn: true, name_en: true, selling_price: true } },
        campaign: { select: { id: true, name: true, channel: true } },
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { notes: true } },
      },
    });

    const now = Date.now();

    // 3. Privacy Rule: Phone numbers masked in lists (017XX-XX1234)
    // Non-admins see masked phone numbers. Admin sees full phone numbers.
    const isAdmin = session.role === 'ADMIN';

    const formatted = leads.map((l) => {
      const daysSinceUpdate = Math.floor((now - new Date(l.updated_at).getTime()) / (1000 * 60 * 60 * 24));
      const daysSinceCreated = Math.floor((now - new Date(l.created_at).getTime()) / (1000 * 60 * 60 * 24));
      const isUnfinished = l.status === 'QUALIFIED' && (daysSinceUpdate >= 3 || daysSinceCreated >= 3);
      const daysWaiting = Math.max(daysSinceUpdate, daysSinceCreated);
      const masked = maskPhone(l.phone);

      return {
        id: l.id,
        name: l.name,
        phone: isAdmin ? l.phone : masked,
        masked_phone: masked,
        address: l.address,
        buyer_type: l.buyer_type,
        product: l.product,
        campaign: l.campaign,
        source_channel: l.source_channel,
        owner_name: l.owner.name,
        owner_email: l.owner.email,
        status: l.status,
        quality_rating: l.quality_rating,
        expected_value: l.expected_value ? Number(l.expected_value) : null,
        order_amount: l.order_amount ? Number(l.order_amount) : null,
        lost_reason: l.lost_reason,
        next_followup_date: l.next_followup_date,
        notes_count: l._count.notes,
        created_at: l.created_at,
        updated_at: l.updated_at,
        days_since_update: daysSinceUpdate,
        days_waiting: daysWaiting,
        is_unfinished: isUnfinished,
      };
    });

    return NextResponse.json({ leads: formatted });
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json({ error: 'লিড তালিকা লোড করা যায়নি' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'লগইন করা নেই' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parse = createLeadSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.issues[0]?.message || 'অবৈধ তথ্য' }, { status: 400 });
    }

    const data = parse.data;
    const normalizedPhone = normalizePhone(data.phone);

    if (!isValidBdPhone(normalizedPhone)) {
      return NextResponse.json(
        { error: 'সঠিক ১১ ডিজিটের বাংলাদেশী মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)' },
        { status: 400 }
      );
    }

    // Acceptance Test 13:
    // Rule: an ORDERED lead must have an order amount. A LOST lead must have a reason.
    if (data.status === 'ORDERED' && (!data.order_amount || data.order_amount <= 0)) {
      return NextResponse.json(
        { error: 'অর্ডার সম্পন্ন (ORDERED) লিডের জন্য বিক্রয় মূল্য (Order Amount) প্রদান করা বাধ্যতামূলক।' },
        { status: 400 }
      );
    }

    if (data.status === 'LOST' && (!data.lost_reason || data.lost_reason.trim() === '')) {
      return NextResponse.json(
        { error: 'বাতিল (LOST) লিডের জন্য কারণ (Lost Reason) উল্লেখ করা বাধ্যতামূলক।' },
        { status: 400 }
      );
    }

    const targetOwnerId =
      session.role === 'ADMIN' && data.owner_id && data.owner_id.trim().length > 0
        ? data.owner_id
        : session.userId;

    // Create lead with notes and increment creator's NEW_CLIENTS count in transaction
    const lead = await prisma.$transaction(async (tx) => {
      const newLead = await tx.lead.create({
        data: {
          name: data.name.trim(),
          phone: normalizedPhone,
          address: data.address?.trim() || null,
          buyer_type: data.buyer_type,
          product_id: data.product_id || null,
          campaign_id: data.campaign_id || null,
          source_channel: data.source_channel.trim(),
          owner_id: targetOwnerId,
          status: data.status,
          quality_rating: data.quality_rating || null,
          expected_value: data.expected_value || null,
          order_amount: data.status === 'ORDERED' ? data.order_amount : null,
          lost_reason: data.status === 'LOST' ? data.lost_reason?.trim() : null,
          next_followup_date: data.next_followup_date ? new Date(data.next_followup_date) : null,
        },
      });

      if (data.initial_note && data.initial_note.trim().length > 0) {
        await tx.leadNote.create({
          data: {
            lead_id: newLead.id,
            author_id: session.userId,
            note: data.initial_note.trim(),
          },
        });
      }

      // Auto-increment NEW_CLIENTS count for creator employee:
      // "je banabe tar new client count plus hobe"
      try {
        const todayDhakaStr = getDhakaDateString();
        const todayDate = parseISO(todayDhakaStr);

        const existingClientEntry = await tx.dailyEntry.findUnique({
          where: {
            employee_id_entry_date_metric_type: {
              employee_id: targetOwnerId,
              entry_date: todayDate,
              metric_type: MetricType.NEW_CLIENTS,
            },
          },
        });

        if (existingClientEntry) {
          await tx.dailyEntry.update({
            where: { id: existingClientEntry.id },
            data: {
              value: Number(existingClientEntry.value) + 1,
            },
          });
        } else {
          await tx.dailyEntry.create({
            data: {
              employee_id: targetOwnerId,
              entry_date: todayDate,
              metric_type: MetricType.NEW_CLIENTS,
              value: 1,
              note: `নতুন কাস্টমার: ${newLead.name}`,
            },
          });
        }
      } catch (err) {
        console.warn('Could not auto-increment dailyEntry NEW_CLIENTS:', err);
      }

      await createAuditLog({
        actorId: session.userId,
        action: 'LEAD_UPDATE',
        entity: 'Lead',
        entityId: newLead.id,
        payload: {
          action: 'CREATE_LEAD',
          name: newLead.name,
          phone: normalizedPhone,
          status: newLead.status,
          owner_id: targetOwnerId,
        },
        tx,
      });

      return newLead;
    });

    return NextResponse.json({ success: true, lead }, { status: 201 });
  } catch (error) {
    console.error('Error creating lead:', error);
    return NextResponse.json({ error: 'লিড তৈরি ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
