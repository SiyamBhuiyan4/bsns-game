import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

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

    // 2. Check if already completed (active)
    const existingActive = await prisma.linkCompletion.findFirst({
      where: {
        group_link_id: linkId,
        employee_id: session.userId,
        undone_at: null,
      },
    });

    if (existingActive) {
      return NextResponse.json({
        success: true,
        alreadyDone: true,
        completionId: existingActive.id,
        completedAt: existingActive.completed_at,
      });
    }

    // 2.5. Check section post limit for this employee
    const assignment = link.section?.assignments?.[0];
    let postLimit = assignment?.post_limit ?? null;

    if (!postLimit && prisma.sectionTarget) {
      const target = await prisma.sectionTarget.findFirst({
        where: {
          employee_id: session.userId,
          section_id: link.section_id,
          metric_type: 'POSTS_DONE',
        },
      });
      if (target) {
        postLimit = Number(target.target_value);
      }
    }

    if (postLimit && postLimit > 0) {
      const now = new Date();
      const dhakaOffsetMs = 6 * 60 * 60 * 1000;
      const dhakaNow = new Date(now.getTime() + dhakaOffsetMs);
      const startOfDhakaDay = new Date(
        Date.UTC(dhakaNow.getUTCFullYear(), dhakaNow.getUTCMonth(), dhakaNow.getUTCDate()) -
          dhakaOffsetMs
      );

      const sectionCompletions = await prisma.linkCompletion.count({
        where: {
          employee_id: session.userId,
          undone_at: null,
          completed_at: { gte: startOfDhakaDay },
          group_link: { section_id: link.section_id },
        },
      });

      if (sectionCompletions >= postLimit) {
        return NextResponse.json(
          {
            error: `"${link.section.name}" এ আপনার আজকের পোস্ট সীমা (${postLimit}টি) পূরণ হয়ে গেছে। আর পোস্ট করা যাবে না।`,
            limitReached: true,
            postLimit,
            completedToday: sectionCompletions,
          },
          { status: 400 }
        );
      }
    }

    // 3. Create or re-activate completion
    const completion = await prisma.linkCompletion.create({
      data: {
        group_link_id: linkId,
        employee_id: session.userId,
        completed_at: new Date(),
        undone_at: null,
      },
    });

    return NextResponse.json({
      success: true,
      alreadyDone: false,
      completionId: completion.id,
      completedAt: completion.completed_at,
    });
  } catch (error) {
    console.error('Error marking link done:', error);
    return NextResponse.json({ error: 'লিংক সম্পন্ন রেকর্ড ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
