import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { BudgetScope, CampaignChannel, CampaignStatus, MetricType } from '@prisma/client';
import { z } from 'zod';
import { calculateROAS, evaluateCampaignBudget } from '@/lib/campaigns';

const campaignSchema = z.object({
  name: z.string().min(2, 'ক্যাম্পেইনের নাম প্রদান করুন'),
  channel: z.nativeEnum(CampaignChannel),
  product_id: z.string().optional().nullable(),
  start_date: z.string(),
  end_date: z.string().optional().nullable(),
  budget_amount: z.number().min(0, 'বাজেট ০ বা তার বেশি হতে হবে'),
  status: z.nativeEnum(CampaignStatus).optional().default('PLANNED'),
});

const campaignUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).optional(),
  channel: z.nativeEnum(CampaignChannel).optional(),
  product_id: z.string().optional().nullable(),
  budget_amount: z.number().min(0).optional(),
  status: z.nativeEnum(CampaignStatus).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional().nullable(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'লগইন করা নেই' }, { status: 401 });
  }

  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        product: { select: { id: true, name_bn: true, name_en: true } },
        owner: { select: { id: true, name: true, email: true } },
        leads: {
          select: { id: true, status: true, order_amount: true, expected_value: true },
        },
        budgets: {
          where: { scope: BudgetScope.CAMPAIGN },
          orderBy: { updated_at: 'desc' },
          take: 1,
        },
        _count: {
          select: { leads: true },
        },
      },
    });

    // Fetch system-wide recorded ad spend from DailyEntry
    const adSpendAgg = await prisma.dailyEntry.aggregate({
      where: { metric_type: MetricType.AD_SPEND },
      _sum: { value: true },
    });
    const totalDailyAdSpend = Number(adSpendAgg._sum.value || 0);

    // Sum running campaigns budgets for proportional allocation
    const runningCampaigns = campaigns.filter((c) => c.status === 'RUNNING');
    const runningBudgetSum = runningCampaigns.reduce((acc, c) => acc + Number(c.budget_amount || 0), 0);

    const formatted = campaigns.map((c) => {
      const budget = Number(c.budget_amount);
      const limitRecord = c.budgets?.[0];
      const budgetLimit = limitRecord ? Number(limitRecord.amount) : budget;

      // Leads & converted orders revenue
      const leadsCount = c._count.leads;
      const orderedLeads = c.leads.filter(
        (l: any) => l.status === 'ORDERED' || (Number(l.order_amount) || 0) > 0
      );
      const ordersCount = orderedLeads.length;
      const revenue = orderedLeads.reduce(
        (sum: any, l: any) => sum + (Number(l.order_amount) || 0),
        0
      );

      // Spend calculation:
      let spend = 0;
      if (c.status === 'PLANNED') {
        spend = 0;
      } else if (c.status === 'ENDED') {
        spend = budgetLimit;
      } else if (c.status === 'RUNNING') {
        if (totalDailyAdSpend > 0 && runningBudgetSum > 0) {
          spend = Number(((budget / runningBudgetSum) * totalDailyAdSpend).toFixed(2));
        } else {
          spend = Math.round(budget * 0.85);
        }
      } else if (c.status === 'PAUSED') {
        spend = Math.round(budget * 0.5);
      }

      // Budget threshold evaluation (SAFE <80%, WARNING 80-100%, EXCEEDED >100%)
      const evalResult = evaluateCampaignBudget(budgetLimit, spend);

      // ROAS = Revenue / Ad Spend
      const roas = calculateROAS(revenue, spend, budgetLimit);

      return {
        id: c.id,
        name: c.name,
        channel: c.channel,
        product: c.product,
        owner: c.owner,
        start_date: c.start_date,
        end_date: c.end_date,
        budget_amount: budget,
        budget_limit: budgetLimit,
        spend,
        spend_percentage: evalResult.spendPercentage,
        revenue,
        roas,
        budget_status: evalResult.status,
        warning_message: evalResult.warningMessage,
        status: c.status,
        leads_count: leadsCount,
        orders_count: ordersCount,
        created_at: c.created_at,
      };
    });

    // Summary KPI calculations
    const totalCampaigns = formatted.length;
    const activeCampaigns = formatted.filter((c) => c.status === 'RUNNING').length;
    const totalBudget = formatted.reduce((acc, c) => acc + c.budget_amount, 0);
    const totalSpend = formatted.reduce((acc, c) => acc + c.spend, 0);
    const totalRevenue = formatted.reduce((acc, c) => acc + c.revenue, 0);
    const overallRoas = calculateROAS(totalRevenue, totalSpend, totalBudget);
    const campaignsAtRisk = formatted.filter((c) => c.budget_status !== 'SAFE').length;

    return NextResponse.json({
      campaigns: formatted,
      summary: {
        total_campaigns: totalCampaigns,
        active_campaigns: activeCampaigns,
        total_budget: totalBudget,
        total_spend: totalSpend,
        total_revenue: totalRevenue,
        overall_roas: overallRoas,
        campaigns_at_risk: campaignsAtRisk,
      },
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json({ error: 'ক্যাম্পেইন তালিকা লোড করা যায়নি' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  const userId = session?.userId || session?.id;
  if (!session || session.role !== 'ADMIN' || !userId) {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parse = campaignSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.issues[0]?.message || 'অবৈধ তথ্য' }, { status: 400 });
    }

    const { name, channel, product_id, start_date, end_date, budget_amount, status } = parse.data;

    const campaign = await prisma.campaign.create({
      data: {
        name: name.trim(),
        channel,
        product_id: product_id || null,
        owner_id: userId,
        start_date: new Date(start_date),
        end_date: end_date ? new Date(end_date) : null,
        budget_amount,
        status: status || 'PLANNED',
      },
      include: {
        product: { select: { id: true, name_bn: true } },
      },
    });

    // Automatically create campaign-scoped BudgetLimit record to keep limits synced
    await prisma.budgetLimit.create({
      data: {
        scope: BudgetScope.CAMPAIGN,
        campaign_id: campaign.id,
        amount: budget_amount,
        set_by: userId,
      },
    });

    await createAuditLog({
      actorId: userId,
      action: 'CREATE',
      entity: 'Campaign',
      entityId: campaign.id,
      payload: { name: campaign.name, channel: campaign.channel, budget: Number(campaign.budget_amount) },
    });

    return NextResponse.json({ success: true, campaign }, { status: 201 });
  } catch (error) {
    console.error('Error creating campaign:', error);
    return NextResponse.json({ error: 'ক্যাম্পেইন তৈরি ব্যর্থ হয়েছে' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  const userId = session?.userId || session?.id;
  if (!session || session.role !== 'ADMIN' || !userId) {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parse = campaignUpdateSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.issues[0]?.message || 'অবৈধ তথ্য' }, { status: 400 });
    }

    const { id, name, channel, product_id, budget_amount, status, start_date, end_date } = parse.data;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (channel !== undefined) updateData.channel = channel;
    if (product_id !== undefined) updateData.product_id = product_id || null;
    if (status !== undefined) updateData.status = status;
    if (start_date !== undefined) updateData.start_date = new Date(start_date);
    if (end_date !== undefined) updateData.end_date = end_date ? new Date(end_date) : null;
    if (budget_amount !== undefined) updateData.budget_amount = budget_amount;

    const campaign = await prisma.campaign.update({
      where: { id },
      data: updateData,
    });

    // If budget_amount is updated, keep BudgetLimit synced
    if (budget_amount !== undefined) {
      const existingBudget = await prisma.budgetLimit.findFirst({
        where: { scope: BudgetScope.CAMPAIGN, campaign_id: id },
      });

      if (existingBudget) {
        await prisma.budgetLimit.update({
          where: { id: existingBudget.id },
          data: { amount: budget_amount, set_by: userId },
        });
      } else {
        await prisma.budgetLimit.create({
          data: {
            scope: BudgetScope.CAMPAIGN,
            campaign_id: id,
            amount: budget_amount,
            set_by: userId,
          },
        });
      }
    }

    await createAuditLog({
      actorId: userId,
      action: 'UPDATE',
      entity: 'Campaign',
      entityId: campaign.id,
      payload: JSON.parse(JSON.stringify(updateData)),
    });

    return NextResponse.json({ success: true, campaign });
  } catch (error) {
    console.error('Error updating campaign:', error);
    return NextResponse.json({ error: 'ক্যাম্পেইন আপডেট ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
