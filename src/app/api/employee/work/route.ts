import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'EMPLOYEE') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const searchQuery = searchParams.get('q')?.trim() || '';
  const sectionFilter = searchParams.get('sectionId') || '';

  try {
    // 1. Fetch employee assignments
    const assignments = await prisma.assignment.findMany({
      where: { employee_id: session.userId },
      include: {
        section: {
          select: { id: true, name: true, is_active: true },
        },
      },
    });

    // Filter to active sections only
    const activeAssignedSections = assignments
      .map((a) => a.section)
      .filter((s) => s.is_active);

    const assignedSectionIds = activeAssignedSections.map((s) => s.id);

    // If no assigned sections, return empty
    if (assignedSectionIds.length === 0) {
      return NextResponse.json({
        assignedSections: [],
        todoLinks: [],
        completedLinks: [],
        progress: { completedToday: 0, totalAssigned: 0, percentage: 0 },
        undoEnabled: true,
      });
    }

    // 2. Filter section if selected
    const targetSectionIds = sectionFilter && assignedSectionIds.includes(sectionFilter)
      ? [sectionFilter]
      : assignedSectionIds;

    // 3. Query all active links from target assigned sections (Acceptance Test 2 Rule)
    const linkWhere: {
      section_id: { in: string[] };
      is_active: boolean;
      OR?: Array<{ title?: { contains: string; mode: 'insensitive' }; url?: { contains: string; mode: 'insensitive' } }>;
    } = {
      section_id: { in: targetSectionIds },
      is_active: true,
    };

    if (searchQuery) {
      linkWhere.OR = [
        { title: { contains: searchQuery, mode: 'insensitive' } },
        { url: { contains: searchQuery, mode: 'insensitive' } },
      ];
    }

    const allLinks = await prisma.groupLink.findMany({
      where: linkWhere,
      include: {
        section: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    // 4. Query active completions for this employee
    const activeCompletions = await prisma.linkCompletion.findMany({
      where: {
        employee_id: session.userId,
        undone_at: null,
      },
      select: {
        id: true,
        group_link_id: true,
        completed_at: true,
      },
    });

    const completionMap = new Map<string, { id: string; completed_at: Date }>();
    activeCompletions.forEach((c) => {
      completionMap.set(c.group_link_id, { id: c.id, completed_at: c.completed_at });
    });

    // 5. Separate into To Do and Completed
    const todoLinks: Array<{
      id: string;
      url: string;
      title: string | null;
      section_id: string;
      section_name: string;
    }> = [];

    const completedLinks: Array<{
      id: string;
      url: string;
      title: string | null;
      section_id: string;
      section_name: string;
      completion_id: string;
      completed_at: Date;
    }> = [];

    allLinks.forEach((link) => {
      const completion = completionMap.get(link.id);
      if (completion) {
        completedLinks.push({
          id: link.id,
          url: link.url,
          title: link.title,
          section_id: link.section.id,
          section_name: link.section.name,
          completion_id: completion.id,
          completed_at: completion.completed_at,
        });
      } else {
        todoLinks.push({
          id: link.id,
          url: link.url,
          title: link.title,
          section_id: link.section.id,
          section_name: link.section.name,
        });
      }
    });

    // Sort completed links by most recent completion
    completedLinks.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());

    // 6. Calculate Progress for Today
    // Determine start of today in Asia/Dhaka time (UTC+6)
    const now = new Date();
    const dhakaOffsetMs = 6 * 60 * 60 * 1000;
    const dhakaNow = new Date(now.getTime() + dhakaOffsetMs);
    const startOfDhakaDay = new Date(Date.UTC(dhakaNow.getUTCFullYear(), dhakaNow.getUTCMonth(), dhakaNow.getUTCDate()) - dhakaOffsetMs);

    const completedTodayCount = completedLinks.filter(
      (c) => new Date(c.completed_at).getTime() >= startOfDhakaDay.getTime()
    ).length;

    const totalAssignedCount = allLinks.length;
    const progressPercent = totalAssignedCount > 0
      ? Math.round((completedTodayCount / totalAssignedCount) * 100)
      : 0;

    // 7. Check scoring settings for undo_enabled
    const settings = await prisma.scoringSettings.findUnique({ where: { id: 'default' } });
    const undoEnabled = settings ? settings.undo_enabled : true;

    return NextResponse.json({
      assignedSections: activeAssignedSections,
      todoLinks,
      completedLinks,
      progress: {
        completedToday: completedTodayCount,
        totalAssigned: totalAssignedCount,
        percentage: progressPercent,
      },
      undoEnabled,
    });
  } catch (error) {
    console.error('Error fetching employee work:', error);
    return NextResponse.json({ error: 'টাস্ক কিউ লোড করা যায়নি' }, { status: 500 });
  }
}
