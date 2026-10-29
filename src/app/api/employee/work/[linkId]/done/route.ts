import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getDhakaDateString } from '@/lib/date';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'EMPLOYEE') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  const { linkId } = await params;

  try {
    // 1. Verify link exists, is active, and is in an assigned section
    const link = await prisma.groupLink.findUnique({
      where: { id: linkId },
      include: {
        section: {
          include: {
            assignments: {
              where: { employee_id: session.userId },
            },
          },
        },
      },
    });

    if (!link) {
      return NextResponse.json(
        { error: 'লিংকটি পাওয়া যায়নি / Link not found' },
        { status: 404 }
      );
    }

    if (!link.is_active || !link.section.is_active || link.section.assignments.length === 0) {
      return NextResponse.json(
        { error: 'এই লিঙ্কে আপনার অ্যাক্সেস নেই অথবা লিঙ্কটি নিষ্ক্রিয়' },
        { status: 403 }
      );
    }

    const allowExtra =
      _request.nextUrl.searchParams.get('allowExtra') === 'true' ||
      _request.nextUrl.searchParams.get('extra') === 'true';

    // 2. Daily post limit for this section: the assignment's post_limit, else a DAILY
    // POSTS_DONE target for the section (a weekly or monthly amount is not a per-day cap).
    const assignment = link.section?.assignments?.[0];
    let postLimit: number | null = assignment?.post_limit ?? null;

    if (!postLimit && prisma.sectionTarget) {
      const target = await prisma.sectionTarget.findFirst({
        where: {
          employee_id: session.userId,
          section_id: link.section_id,
          metric_type: 'POSTS_DONE',
          period_type: 'DAILY',
        },
      });
      if (target) {
        postLimit = Number(target.target_value);
      }
    }

    const startOfDhakaDay = new Date(`${getDhakaDateString()}T00:00:00+06:00`);

    // 3. Check-and-create in one transaction: writes run one at a time, so a double
    // click cannot record the same link twice or slip past the daily limit.
    const outcome = await prisma.$transaction(async (tx) => {
      const existingActive = await tx.linkCompletion.findFirst({
        where: {
          group_link_id: linkId,
          employee_id: session.userId,
          undone_at: null,
        },
      });
      if (existingActive) {
        return { kind: 'already' as const, completion: existingActive };
      }

      let isExtraWork = false;
      if (postLimit && postLimit > 0) {
        const sectionCompletions = await tx.linkCompletion.count({
          where: {
            employee_id: session.userId,
            undone_at: null,
            completed_at: { gte: startOfDhakaDay },
            group_link: { section_id: link.section_id },
          },
        });

        if (sectionCompletions >= postLimit) {
          if (!allowExtra) {
            return { kind: 'limit' as const, postLimit, completedToday: sectionCompletions };
          }
          isExtraWork = true;
        }
      }

      const completion = await tx.linkCompletion.create({
        data: {
          group_link_id: linkId,
          employee_id: session.userId,
          completed_at: new Date(),
          undone_at: null,
        },
      });
      return { kind: 'created' as const, completion, isExtraWork };
    });

    if (outcome.kind === 'already') {
      return NextResponse.json({
        success: true,
        alreadyDone: true,
        completionId: outcome.completion.id,
        completedAt: outcome.completion.completed_at,
      });
    }

    if (outcome.kind === 'limit') {
      return NextResponse.json(
        {
          error: `"${link.section.name}" এ আপনার আজকের পোস্ট সীমা (${outcome.postLimit}টি) পূরণ হয়ে গেছে। অতিরিক্ত পোস্ট করতে বোনাস অনুমোদন সক্রিয় করুন।`,
          limitReached: true,
          postLimit: outcome.postLimit,
          completedToday: outcome.completedToday,
          canDoExtra: true,
        },
        { status: 400 }
      );
    }

    const { completion, isExtraWork } = outcome;

    return NextResponse.json({
      success: true,
      alreadyDone: false,
      completionId: completion.id,
      completedAt: completion.completed_at,
      isExtraWork,
      bonusXp: isExtraWork ? 50 : 25,
    });
  } catch (error) {
    console.error('Error marking link done:', error);
    return NextResponse.json({ error: 'লিংক সম্পন্ন রেকর্ড ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
