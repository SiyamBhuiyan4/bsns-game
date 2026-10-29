import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { normalizePhone, isValidBdPhone, maskPhone } from '@/lib/phone';
import { formatBstDateTime } from '@/lib/date';
import { BuyerType, LeadStatus } from '@prisma/client';
import { z } from 'zod';

const updateLeadSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional().nullable(),
  buyer_type: z.nativeEnum(BuyerType).optional(),
  product_id: z.string().max(100).optional().nullable(),
  campaign_id: z.string().max(100).optional().nullable(),
  source_channel: z.string().max(100).optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  quality_rating: z.number().int().min(1).max(5).optional().nullable(),
  expected_value: z.number().min(0).optional().nullable(),
  order_amount: z.number().min(0).optional().nullable(),
  lost_reason: z.string().max(500).optional().nullable(),
  next_followup_date: z
    .string()
    .max(40)
    .refine((v) => v === '' || !isNaN(new Date(v).getTime()), 'সঠিক ফলোআপ তারিখ দিন / Invalid follow-up date')
    .optional()
    .nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'লগইন করা নেই' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        product: true,
        campaign: true,
        owner: { select: { id: true, name: true, email: true, phone: true } },
        notes: {
          orderBy: { created_at: 'desc' },
          include: {
            author: { select: { id: true, name: true, role: true } },
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: 'লিড পাওয়া যায়নি' }, { status: 404 });
    }

    // Role check: Employee can only view own lead detail unless granted can_view_all_customers
    if (session.role === 'EMPLOYEE' && lead.owner_id !== session.userId) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { can_view_all_customers: true },
      });
      if (!currentUser?.can_view_all_customers) {
        return NextResponse.json({ error: 'এই লিডে আপনার অ্যাক্সেস নেই' }, { status: 403 });
      }
    }

    // Full unmasked phone is returned on single detail page for authorized user (Admin or Lead Owner)
    return NextResponse.json({
      lead: {
        ...lead,
        owner_name: lead.owner?.name,
        owner_email: lead.owner?.email,
        order_amount: lead.order_amount ? Number(lead.order_amount) : null,
        expected_value: lead.expected_value ? Number(lead.expected_value) : null,
        masked_phone: maskPhone(lead.phone),
        created_at_bst: formatBstDateTime(lead.created_at, 'bn'),
        created_at_bst_en: formatBstDateTime(lead.created_at, 'en'),
      },
    });
  } catch (error) {
    console.error('Error fetching lead detail:', error);
    return NextResponse.json({ error: 'লিড লোড করা যায়নি' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'লগইন করা নেই' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parse = updateLeadSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.issues[0]?.message || 'অবৈধ তথ্য' }, { status: 400 });
    }

    const currentLead = await prisma.lead.findUnique({ where: { id } });
    if (!currentLead) {
      return NextResponse.json({ error: 'লিড পাওয়া যায়নি' }, { status: 404 });
    }

    // Role check: Employee can only edit own lead
    if (session.role === 'EMPLOYEE' && currentLead.owner_id !== session.userId) {
      return NextResponse.json({ error: 'এই লিড সম্পাদনার অনুমতি নেই' }, { status: 403 });
    }

    const data = parse.data;
    const targetStatus = data.status || currentLead.status;

    // Acceptance Test 13:
    // Rule: an ORDERED lead must have an order amount. A LOST lead must have a reason.
    if (targetStatus === 'ORDERED') {
      const amount = data.order_amount !== undefined ? data.order_amount : currentLead.order_amount;
      if (!amount || Number(amount) <= 0) {
        return NextResponse.json(
          { error: 'অর্ডার সম্পন্ন (ORDERED) লিডের জন্য বিক্রয় মূল্য (Order Amount) প্রদান করা বাধ্যতামূলক।' },
          { status: 400 }
        );
      }
    }

    if (targetStatus === 'LOST') {
      const reason = data.lost_reason !== undefined ? data.lost_reason : currentLead.lost_reason;
      if (!reason || reason.trim() === '') {
        return NextResponse.json(
          { error: 'বাতিল (LOST) লিডের জন্য কারণ (Lost Reason) উল্লেখ করা বাধ্যতামূলক।' },
          { status: 400 }
        );
      }
    }

    let normalizedPhone: string | undefined = undefined;
    if (data.phone) {
      normalizedPhone = normalizePhone(data.phone);
      if (!isValidBdPhone(normalizedPhone)) {
        return NextResponse.json({ error: 'সঠিক বাংলাদেশী মোবাইল নম্বর দিন' }, { status: 400 });
      }
      // Same rule as creating a lead: one customer per mobile number.
      if (normalizedPhone !== currentLead.phone) {
        const clash = await prisma.lead.findFirst({ where: { phone: normalizedPhone, id: { not: id } } });
        if (clash) {
          return NextResponse.json(
            { error: 'এই মোবাইল নম্বরটি অন্য কাস্টমারের জন্য ইতিমধ্যে আছে / This number already belongs to another customer' },
            { status: 400 }
          );
        }
      }
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(normalizedPhone ? { phone: normalizedPhone } : {}),
        ...(data.address !== undefined ? { address: data.address?.trim() || null } : {}),
        ...(data.buyer_type ? { buyer_type: data.buyer_type } : {}),
        ...(data.product_id !== undefined ? { product_id: data.product_id || null } : {}),
        ...(data.campaign_id !== undefined ? { campaign_id: data.campaign_id || null } : {}),
        ...(data.source_channel ? { source_channel: data.source_channel.trim() } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.quality_rating !== undefined ? { quality_rating: data.quality_rating } : {}),
        ...(data.expected_value !== undefined ? { expected_value: data.expected_value } : {}),
        ...(data.order_amount !== undefined ? { order_amount: data.order_amount } : {}),
        ...(data.lost_reason !== undefined ? { lost_reason: data.lost_reason?.trim() || null } : {}),
        ...(data.next_followup_date !== undefined
          ? { next_followup_date: data.next_followup_date ? new Date(data.next_followup_date) : null }
          : {}),
      },
    });

    await createAuditLog({
      actorId: session.userId,
      action: 'LEAD_UPDATE',
      entity: 'Lead',
      entityId: id,
      payload: {
        old: { status: currentLead.status, order_amount: Number(currentLead.order_amount) },
        new: { status: updated.status, order_amount: Number(updated.order_amount) },
      },
    });

    return NextResponse.json({
      success: true,
      lead: {
        ...updated,
        order_amount: updated.order_amount ? Number(updated.order_amount) : null,
        expected_value: updated.expected_value ? Number(updated.expected_value) : null,
        masked_phone: maskPhone(updated.phone),
      },
    });
  } catch (error) {
    console.error('Error updating lead:', error);
    return NextResponse.json({ error: 'লিড আপডেট ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
