import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { BudgetScope, MetricType } from '@prisma/client';
import { z } from 'zod';
import { getDhakaDateString } from '@/lib/date';
import { startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { calculateBudgetStatus } from '@/lib/targets';
import { calculateROAS, evaluateCampaignBudget } from '@/lib/campaigns';
import { makeTranslator } from '@/lib/i18n/translate';
import { readLangFromRequest } from '@/lib/i18n/request-lang';

const budgetSchema = z.object({
  scope: z.nativeEnum(BudgetScope).default(BudgetScope.MONTHLY_TOTAL),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  campaign_id: z.string().uuid().optional(),
  amount: z.number().nonnegative(),
});

export async function GET(req: NextRequest) {
  try {
    // Budget status labels and warnings follow the reader's language.
    const lang = readLangFromRequest(req);

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'অনুমতি নেই / Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month') || getDhakaDateString().slice(0, 7);

    // Get monthly budget for specified month
    const monthlyBudget = await prisma.budgetLimit.findFirst({
      where: {
        scope: BudgetScope.MONTHLY_TOTAL,
        month,
      },
      include: {
        setter: { select: { id: true, name: true, email: true } },
      },
    });

    // Calculate actual ad spend for this month
    const monthStart = startOfMonth(parseISO(`${month}-01`));
    const monthEnd = endOfMonth(monthStart);

    const adSpendEntries = await prisma.dailyEntry.findMany({
      where: {
        metric_type: MetricType.AD_SPEND,
        entry_date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      select: { value: true },
    });

    const actualSpend = adSpendEntries.reduce((acc, curr) => acc + Number(curr.value), 0);

    // Evaluate monthly budget status
    const monthlyBudgetAmount = monthlyBudget ? Number(monthlyBudget.amount) : 0;
    const monthlyBudgetStatus = monthlyBudget
      ? calculateBudgetStatus(monthlyBudgetAmount, actualSpend, lang)
      : null;

    // Get campaign budgets
    const campaignBudgets = await prisma.budgetLimit.findMany({
      where: {
        scope: BudgetScope.CAMPAIGN,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            channel: true,
            status: true,
            budget_amount: true,
            leads: {
              select: { id: true, status: true, order_amount: true },
            },
          },
        },
        setter: { select: { id: true, name: true } },
      },
    });

    // Enrich campaign budgets with spend, revenue, ROAS, and limit warning evaluations
    const enrichedCampaignBudgets = campaignBudgets.map((cb) => {
      const budgetAmount = Number(cb.amount);
      const camp = cb.campaign;
      const leads = camp?.leads || [];
      const orderedLeads = leads.filter(
        (l: any) => l.status === 'ORDERED' || (Number(l.order_amount) || 0) > 0
      );
      const revenue = orderedLeads.reduce(
        (acc: any, l: any) => acc + (Number(l.order_amount) || 0),
        0
      );

      // Estimate or calculate spend
      let spend = 0;
      if (camp?.status === 'ENDED') {
        spend = budgetAmount;
      } else if (camp?.status === 'RUNNING') {
        spend = Math.round(budgetAmount * 0.85);
      } else if (camp?.status === 'PAUSED') {
        spend = Math.round(budgetAmount * 0.5);
      }

      const budgetEvaluation = evaluateCampaignBudget(budgetAmount, spend, lang);
      const roas = calculateROAS(revenue, spend, budgetAmount);

      return {
        ...cb,
        amount: budgetAmount,
        spend,
        revenue,
        roas,
        spend_percentage: budgetEvaluation.spendPercentage,
        budget_status: budgetEvaluation.status,
        warning_message: budgetEvaluation.warningMessage,
      };
    });

    return NextResponse.json({
      month,
      monthly_budget: monthlyBudget,
      actual_spend: actualSpend,
      budget_status: monthlyBudgetStatus,
      campaign_budgets: enrichedCampaignBudgets,
    });
  } catch (error) {
    console.error('Error fetching budgets:', error);
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Budget warnings and status labels follow the reader's language.
    const lang = readLangFromRequest(req);
    const L = makeTranslator(lang);

    const session = await getSession();
    const userId = session?.userId || session?.id;
    if (!session || session.role !== 'ADMIN' || !userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = budgetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.format() }, { status: 400 });
    }

    const { scope, month, campaign_id, amount } = parsed.data;

    let budget;
    let warning: string | null = null;
    let currentSpend = 0;

    if (scope === BudgetScope.MONTHLY_TOTAL) {
      if (!month) {
        return NextResponse.json({ error: 'Month is required for MONTHLY_TOTAL budget' }, { status: 400 });
      }

      // Check current spend in this month to validate budget limit
      const monthStart = startOfMonth(parseISO(`${month}-01`));
      const monthEnd = endOfMonth(monthStart);
      const monthSpendEntries = await prisma.dailyEntry.findMany({
        where: {
          metric_type: MetricType.AD_SPEND,
          entry_date: { gte: monthStart, lte: monthEnd },
        },
        select: { value: true },
      });
      currentSpend = monthSpendEntries.reduce((sum, e) => sum + Number(e.value), 0);

      const existing = await prisma.budgetLimit.findFirst({
        where: { scope: BudgetScope.MONTHLY_TOTAL, month },
      });

      if (existing) {
        budget = await prisma.budgetLimit.update({
          where: { id: existing.id },
          data: {
            amount,
            set_by: userId,
          },
        });
      } else {
        budget = await prisma.budgetLimit.create({
          data: {
            scope: BudgetScope.MONTHLY_TOTAL,
            month,
            amount,
            set_by: userId,
          },
        });
      }

      // Budget limit warning validations
      if (amount > 0 && currentSpend > amount) {
        warning = L(`সতর্কতা: বর্তমান মোট খরচ (৳${currentSpend.toLocaleString('en-IN')}) নতুন বাজেট সীমা (৳${amount.toLocaleString('en-IN')}) অতিক্রম করেছে!`);
      } else if (amount > 0 && currentSpend >= 0.8 * amount) {
        const pct = ((currentSpend / amount) * 100).toFixed(1);
        warning = L(`সতর্কতা: বর্তমান মোট খরচ নতুন বাজেটের ${pct}% (৮০% বা তার বেশি সীমা স্পর্শ করেছে)।`);
      }
    } else {
      if (!campaign_id) {
        return NextResponse.json({ error: 'campaign_id is required for CAMPAIGN budget' }, { status: 400 });
      }

      const campaign = await prisma.campaign.findUnique({
        where: { id: campaign_id },
      });

      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }

      const existing = await prisma.budgetLimit.findFirst({
        where: { scope: BudgetScope.CAMPAIGN, campaign_id },
      });

      if (existing) {
        budget = await prisma.budgetLimit.update({
          where: { id: existing.id },
          data: {
            amount,
            set_by: userId,
          },
        });
      } else {
        budget = await prisma.budgetLimit.create({
          data: {
            scope: BudgetScope.CAMPAIGN,
            campaign_id,
            amount,
            set_by: userId,
          },
        });
      }

      // Also sync to campaign model budget_amount
      await prisma.campaign.update({
        where: { id: campaign_id },
        data: { budget_amount: amount },
      });

      // Calculate campaign spend based on campaign status
      let campaignSpend = 0;
      const baseBudget = Number(campaign.budget_amount) || amount;
      if (campaign.status === 'ENDED') {
        campaignSpend = baseBudget;
      } else if (campaign.status === 'RUNNING') {
        campaignSpend = Math.round(baseBudget * 0.85);
      } else if (campaign.status === 'PAUSED') {
        campaignSpend = Math.round(baseBudget * 0.5);
      }
      currentSpend = campaignSpend;

      // Campaign spend warning validation
      const evalCamp = evaluateCampaignBudget(amount, currentSpend, lang);
      if (evalCamp.warningMessage) {
        warning = evalCamp.warningMessage;
      }
    }

    await createAuditLog({
      actorId: userId,
      action: 'BUDGET_SET',
      entity: 'BudgetLimit',
      entityId: budget.id,
      payload: { scope, month, campaign_id, amount },
    });

    const statusObj = calculateBudgetStatus(amount, currentSpend, lang);

    return NextResponse.json({ budget, warning, status: statusObj });
  } catch (error) {
    console.error('Error setting budget:', error);
    return NextResponse.json({ error: 'Failed to set budget' }, { status: 500 });
  }
}
