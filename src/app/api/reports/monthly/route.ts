import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { computeMonthlyAutoData } from '@/lib/reports';
import { getDhakaDateString } from '@/lib/date';
import { MonthlyReportStatus } from '@prisma/client';
import { z } from 'zod';

const monthlyReportUpdateSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  summary_text: z.string().optional().nullable(),
  next_month_goal: z.string().optional().nullable(),
  next_month_budget: z.number().nonnegative().optional().nullable(),
  finalize: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month') || getDhakaDateString().slice(0, 7);
    const includeHistory = searchParams.get('history') === 'true';

    let history: {
      id: string;
      month: string;
      status: MonthlyReportStatus;
      created_at: Date;
      finalized_at: Date | null;
    }[] = [];

    if (includeHistory) {
      history = await prisma.monthlyReport.findMany({
        orderBy: { month: 'desc' },
        select: {
          id: true,
          month: true,
          status: true,
          created_at: true,
          finalized_at: true,
        },
      });
    }

    let report = await prisma.monthlyReport.findUnique({
      where: { month },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    if (!report) {
      // Generate initial draft
      const autoData = await computeMonthlyAutoData(month);
      report = await prisma.monthlyReport.create({
        data: {
          month,
          status: MonthlyReportStatus.DRAFT,
          auto_data: autoData as object,
          created_by: session.id,
        },
        include: {
          creator: { select: { id: true, name: true, email: true } },
        },
      });
    } else if (report.status === MonthlyReportStatus.DRAFT) {
      // Refresh auto data for live draft
      const freshAutoData = await computeMonthlyAutoData(month);
      report = await prisma.monthlyReport.update({
        where: { id: report.id },
        data: { auto_data: freshAutoData as object },
        include: {
          creator: { select: { id: true, name: true, email: true } },
        },
      });
    }

    return NextResponse.json({ report, history });
  } catch (error) {
    console.error('Error fetching monthly report:', error);
    return NextResponse.json({ error: 'Failed to fetch monthly report' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = monthlyReportUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.format() }, { status: 400 });
    }

    const { month, summary_text, next_month_goal, next_month_budget, finalize } = parsed.data;

    const existing = await prisma.monthlyReport.findUnique({
      where: { month },
    });

    if (existing && existing.status === MonthlyReportStatus.FINAL) {
      return NextResponse.json(
        { error: 'রিপোর্ট ইতিমধ্যে চূড়ান্ত (FINAL) করা হয়েছে এবং সম্পাদনা করা যাবে না।' },
        { status: 400 }
      );
    }

    const autoData = await computeMonthlyAutoData(month);

    let updatedReport;
    if (existing) {
      updatedReport = await prisma.monthlyReport.update({
        where: { id: existing.id },
        data: {
          auto_data: autoData as object,
          summary_text: summary_text !== undefined ? summary_text : existing.summary_text,
          next_month_goal: next_month_goal !== undefined ? next_month_goal : existing.next_month_goal,
          next_month_budget: next_month_budget !== undefined ? next_month_budget : existing.next_month_budget,
          status: finalize ? MonthlyReportStatus.FINAL : existing.status,
          finalized_at: finalize ? new Date() : existing.finalized_at,
        },
        include: {
          creator: { select: { id: true, name: true, email: true } },
        },
      });
    } else {
      updatedReport = await prisma.monthlyReport.create({
        data: {
          month,
          auto_data: autoData as object,
          summary_text: summary_text || null,
          next_month_goal: next_month_goal || null,
          next_month_budget: next_month_budget || null,
          status: finalize ? MonthlyReportStatus.FINAL : MonthlyReportStatus.DRAFT,
          finalized_at: finalize ? new Date() : null,
          created_by: session.id,
        },
        include: {
          creator: { select: { id: true, name: true, email: true } },
        },
      });
    }

    await createAuditLog({
      actorId: session.id,
      action: finalize ? 'REPORT_FINALIZE' : 'UPDATE',
      entity: 'MonthlyReport',
      entityId: updatedReport.id,
      payload: {
        month,
        status: updatedReport.status,
        finalize: !!finalize,
      },
    });

    return NextResponse.json({ success: true, report: updatedReport });
  } catch (error) {
    console.error('Error saving monthly report:', error);
    return NextResponse.json({ error: 'Failed to save monthly report' }, { status: 500 });
  }
}
