import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { getDhakaDateString, parseDateOnly } from '@/lib/date';
import { computeWeeklyAutoData, WEEKLY_FIXED_QUESTIONS } from '@/lib/reports';
import { startOfWeek, endOfWeek, parseISO, format } from 'date-fns';
import { z } from 'zod';
import { ReportStatus, Prisma } from '@prisma/client';

const saveWeeklyReportSchema = z.object({
  id: z.string().uuid().optional(),
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  answers: z.array(
    z.object({
      question_no: z.number().int().min(1).max(5),
      answer_text: z.string(),
    })
  ),
  publish: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const history = searchParams.get('history') === 'true';

    // If history requested, return list of past weekly reports
    if (history) {
      const reports = await prisma.weeklyReport.findMany({
        orderBy: { week_start: 'desc' },
        include: {
          creator: { select: { id: true, name: true, email: true } },
        },
      });
      return NextResponse.json({ reports });
    }

    // Single week report
    const dateParam = searchParams.get('date') || getDhakaDateString();
    const refDate = parseISO(dateParam);
    const weekStart = startOfWeek(refDate, { weekStartsOn: 0 }); // Sunday
    const weekEnd = endOfWeek(refDate, { weekStartsOn: 0 }); // Saturday

    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

    const weekStartDate = parseDateOnly(weekStartStr);
    const weekEndDate = parseDateOnly(weekEndStr);

    let report = await prisma.weeklyReport.findUnique({
      where: { week_start: weekStartDate },
      include: {
        answers: { orderBy: { question_no: 'asc' } },
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    // If report does not exist, compute auto-data and create DRAFT
    if (!report) {
      const autoData = await computeWeeklyAutoData(weekStartDate, weekEndDate);

      report = await prisma.weeklyReport.create({
        data: {
          week_start: weekStartDate,
          week_end: weekEndDate,
          status: ReportStatus.DRAFT,
          auto_data: autoData as unknown as Prisma.InputJsonValue,
          created_by: session.id || session.userId,
          answers: {
            create: WEEKLY_FIXED_QUESTIONS.map((q) => ({
              question_no: q.no,
              question_text: q.text,
              answer_text: '',
              updated_by: session.id || session.userId,
            })),
          },
        },
        include: {
          answers: { orderBy: { question_no: 'asc' } },
          creator: { select: { id: true, name: true, email: true } },
        },
      });
    } else if (report.status === ReportStatus.DRAFT) {
      // Re-calculate auto_data for active drafts to keep metrics live
      const freshAutoData = await computeWeeklyAutoData(weekStartDate, weekEndDate);
      report = await prisma.weeklyReport.update({
        where: { id: report.id },
        data: { auto_data: freshAutoData as unknown as Prisma.InputJsonValue },
        include: {
          answers: { orderBy: { question_no: 'asc' } },
          creator: { select: { id: true, name: true, email: true } },
        },
      });
    }

    return NextResponse.json({
      report,
      questions: WEEKLY_FIXED_QUESTIONS,
    });
  } catch (error) {
    console.error('Error fetching weekly report:', error);
    return NextResponse.json({ error: 'Failed to fetch weekly report' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = saveWeeklyReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { week_start, answers, publish } = parsed.data;
    const weekStartDate = parseDateOnly(week_start);
    const weekEnd = endOfWeek(parseISO(week_start), { weekStartsOn: 0 });
    const weekEndDate = parseDateOnly(format(weekEnd, 'yyyy-MM-dd'));

    const autoData = await computeWeeklyAutoData(weekStartDate, weekEndDate);
    const currentUserId = session.id || session.userId;

    const report = await prisma.$transaction(async (tx) => {
      // 1. Upsert WeeklyReport
      const rep = await tx.weeklyReport.upsert({
        where: { week_start: weekStartDate },
        update: {
          auto_data: autoData as unknown as Prisma.InputJsonValue,
          ...(publish && {
            status: ReportStatus.PUBLISHED,
            published_at: new Date(),
          }),
        },
        create: {
          week_start: weekStartDate,
          week_end: weekEndDate,
          status: publish ? ReportStatus.PUBLISHED : ReportStatus.DRAFT,
          published_at: publish ? new Date() : null,
          auto_data: autoData as unknown as Prisma.InputJsonValue,
          created_by: currentUserId,
        },
      });

      // 2. Upsert Answers
      for (const ans of answers) {
        const fixedQ = WEEKLY_FIXED_QUESTIONS.find((q) => q.no === ans.question_no);
        const qText = fixedQ?.text || `প্রশ্ন ${ans.question_no}`;

        await tx.weeklyReportAnswer.upsert({
          where: {
            weekly_report_id_question_no: {
              weekly_report_id: rep.id,
              question_no: ans.question_no,
            },
          },
          update: {
            answer_text: ans.answer_text,
            updated_by: currentUserId,
          },
          create: {
            weekly_report_id: rep.id,
            question_no: ans.question_no,
            question_text: qText,
            answer_text: ans.answer_text,
            updated_by: currentUserId,
          },
        });
      }

      return rep;
    });

    if (publish) {
      await createAuditLog({
        actorId: currentUserId,
        action: 'REPORT_PUBLISH',
        entity: 'WeeklyReport',
        entityId: report.id,
        payload: { week_start, published_at: new Date() },
      });
    }

    return NextResponse.json({
      success: true,
      message: publish
        ? 'সাপ্তাহিক রিপোর্ট সফলভাবে প্রকাশ (Publish) করা হয়েছে।'
        : 'সাপ্তাহিক রিপোর্টের খসড়া সংরক্ষিত হয়েছে।',
      report,
    });
  } catch (error) {
    console.error('Error saving weekly report:', error);
    return NextResponse.json({ error: 'Failed to save weekly report' }, { status: 500 });
  }
}
