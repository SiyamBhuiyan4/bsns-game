import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';
import { BudgetScope, PeriodType, Prisma } from '@prisma/client';

const bulkCopySchema = z.object({
  copy_type: z.enum(['MONTH_TO_MONTH', 'SECTION_TO_SECTION', 'BUDGET_ONLY']),
  from_month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  to_month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  from_section_id: z.string().uuid().optional(),
  to_section_id: z.string().uuid().optional(),
  section_id: z.string().uuid().optional(), // for month-to-month scoped to one section
  copy_budget: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = bulkCopySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.format() }, { status: 400 });
    }

    const data = parsed.data;
    let copiedCount = 0;
    let budgetCopied = false;

    // Helper to copy monthly budget
    const handleCopyMonthlyBudget = async (fromM: string, toM: string) => {
      const sourceBudget = await prisma.budgetLimit.findFirst({
        where: {
          scope: BudgetScope.MONTHLY_TOTAL,
          month: fromM,
        },
      });

      if (sourceBudget) {
        const existingBudget = await prisma.budgetLimit.findFirst({
          where: {
            scope: BudgetScope.MONTHLY_TOTAL,
            month: toM,
          },
        });

        let savedBudget;
        if (existingBudget) {
          savedBudget = await prisma.budgetLimit.update({
            where: { id: existingBudget.id },
            data: {
              amount: sourceBudget.amount,
              set_by: session.id,
            },
          });
        } else {
          savedBudget = await prisma.budgetLimit.create({
            data: {
              scope: BudgetScope.MONTHLY_TOTAL,
              month: toM,
              amount: sourceBudget.amount,
              set_by: session.id,
            },
          });
        }

        await createAuditLog({
          actorId: session.id,
          action: 'BUDGET_SET',
          entity: 'BudgetLimit',
          entityId: savedBudget.id,
          payload: {
            scope: BudgetScope.MONTHLY_TOTAL,
            month: toM,
            amount: Number(sourceBudget.amount),
            copied_from_month: fromM,
          },
        });

        return true;
      }
      return false;
    };

    if (data.copy_type === 'BUDGET_ONLY') {
      if (!data.from_month || !data.to_month) {
        return NextResponse.json({ error: 'from_month and to_month are required for BUDGET_ONLY copy' }, { status: 400 });
      }
      if (data.from_month === data.to_month) {
        return NextResponse.json({ error: 'from_month and to_month must be different' }, { status: 400 });
      }
      budgetCopied = await handleCopyMonthlyBudget(data.from_month, data.to_month);
      return NextResponse.json({
        message: budgetCopied ? 'মাসিক বাজেট সফলভাবে কপি করা হয়েছে' : 'উৎস মাসে কোনো বাজেট পাওয়া যায়নি',
        budgetCopied,
      });
    }

    if (data.copy_type === 'MONTH_TO_MONTH') {
      if (!data.from_month || !data.to_month) {
        return NextResponse.json({ error: 'from_month and to_month are required for MONTH_TO_MONTH copy' }, { status: 400 });
      }
      if (data.from_month === data.to_month) {
        return NextResponse.json({ error: 'from_month and to_month must be different' }, { status: 400 });
      }

      const fromStart = new Date(`${data.from_month}-01T00:00:00.000Z`);
      const [fromY, fromM] = data.from_month.split('-').map(Number);
      const fromEnd = new Date(Date.UTC(fromY, fromM, 0, 23, 59, 59, 999));

      const toStart = new Date(`${data.to_month}-01T00:00:00.000Z`);
      const [toY, toM] = data.to_month.split('-').map(Number);
      const toEnd = new Date(Date.UTC(toY, toM, 0, 23, 59, 59, 999));

      const where: Prisma.SectionTargetWhereInput = {
        period_type: PeriodType.MONTHLY,
        period_start: {
          gte: fromStart,
          lte: fromEnd,
        },
      };
      if (data.section_id) {
        where.section_id = data.section_id;
      }

      const sourceTargets = await prisma.sectionTarget.findMany({ where });

      for (const t of sourceTargets) {
        const existing = await prisma.sectionTarget.findFirst({
          where: {
            section_id: t.section_id,
            metric_type: t.metric_type,
            period_type: PeriodType.MONTHLY,
            period_start: {
              gte: toStart,
              lte: toEnd,
            },
          },
        });

        if (existing) {
          await prisma.sectionTarget.update({
            where: { id: existing.id },
            data: {
              target_value: t.target_value,
              set_by: session.id,
            },
          });
        } else {
          await prisma.sectionTarget.create({
            data: {
              section_id: t.section_id,
              metric_type: t.metric_type,
              target_value: t.target_value,
              period_type: PeriodType.MONTHLY,
              period_start: toStart,
              period_end: toEnd,
              set_by: session.id,
            },
          });
        }
        copiedCount++;
      }

      // If copy_budget is requested, also copy monthly budget
      if (data.copy_budget) {
        budgetCopied = await handleCopyMonthlyBudget(data.from_month, data.to_month);
      }
    } else if (data.copy_type === 'SECTION_TO_SECTION') {
      if (!data.from_section_id || !data.to_section_id) {
        return NextResponse.json(
          { error: 'from_section_id and to_section_id are required for SECTION_TO_SECTION copy' },
          { status: 400 }
        );
      }
      if (data.from_section_id === data.to_section_id) {
        return NextResponse.json(
          { error: 'from_section_id and to_section_id must be different' },
          { status: 400 }
        );
      }

      const sourceTargets = await prisma.sectionTarget.findMany({
        where: { section_id: data.from_section_id },
      });

      if (sourceTargets.length === 0) {
        return NextResponse.json({ message: 'No targets found for the source section', copied: 0 });
      }

      for (const t of sourceTargets) {
        const existing = await prisma.sectionTarget.findFirst({
          where: {
            section_id: data.to_section_id,
            metric_type: t.metric_type,
            period_type: t.period_type,
            period_start: t.period_start,
          },
        });

        if (existing) {
          await prisma.sectionTarget.update({
            where: { id: existing.id },
            data: {
              target_value: t.target_value,
              set_by: session.id,
            },
          });
        } else {
          await prisma.sectionTarget.create({
            data: {
              section_id: data.to_section_id,
              metric_type: t.metric_type,
              target_value: t.target_value,
              period_type: t.period_type,
              period_start: t.period_start,
              period_end: t.period_end,
              set_by: session.id,
            },
          });
        }
        copiedCount++;
      }
    }

    if (copiedCount > 0) {
      await createAuditLog({
        actorId: session.id,
        action: 'TARGET_SET',
        entity: 'SectionTarget',
        payload: { bulk_copy: data, copied_count: copiedCount, budget_copied: budgetCopied },
      });
    }

    return NextResponse.json({
      message: `সফলভাবে ${copiedCount}টি টার্গেট ${budgetCopied ? 'ও বাজেট ' : ''}কপি করা হয়েছে`,
      copied: copiedCount,
      budgetCopied,
    });
  } catch (error) {
    console.error('Error in bulk copy targets:', error);
    return NextResponse.json({ error: 'Failed to bulk copy targets' }, { status: 500 });
  }
}
