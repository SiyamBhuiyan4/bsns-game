import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { MetricType } from '@prisma/client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: employeeId } = await params;

    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        is_active: true,
        created_at: true,
      },
    });

    if (!employee || employee.role !== 'EMPLOYEE') {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Dhaka time boundaries for Today
    const now = new Date();
    const dhakaOffsetMs = 6 * 60 * 60 * 1000;
    const dhakaNow = new Date(now.getTime() + dhakaOffsetMs);
    const startOfDhakaDay = new Date(
      Date.UTC(dhakaNow.getUTCFullYear(), dhakaNow.getUTCMonth(), dhakaNow.getUTCDate()) - dhakaOffsetMs
    );
    const endOfDhakaDay = new Date(startOfDhakaDay.getTime() + 24 * 60 * 60 * 1000 - 1);

    // 1. Fetch Assignments & Sections
    const assignments = await prisma.assignment.findMany({
      where: { employee_id: employeeId },
      include: {
        section: { select: { id: true, name: true, is_active: true } },
      },
    });

    // Count today's completed links per section
    const todayCompletions = await prisma.linkCompletion.findMany({
      where: {
        employee_id: employeeId,
        undone_at: null,
        completed_at: { gte: startOfDhakaDay, lte: endOfDhakaDay },
      },
      select: {
        id: true,
        group_link_id: true,
        group_link: { select: { section_id: true } },
      },
    });

    const sectionTodayCounts: Record<string, number> = {};
    for (const c of todayCompletions) {
      const sId = c.group_link?.section_id;
      if (sId) {
        sectionTodayCounts[sId] = (sectionTodayCounts[sId] || 0) + 1;
      }
    }

    const assignedSections = assignments.map((a) => {
      const todayCount = sectionTodayCounts[a.section_id] || 0;
      const limit = a.post_limit && Number(a.post_limit) > 0 ? Number(a.post_limit) : null;
      return {
        section_id: a.section_id,
        section_name: a.section.name,
        post_limit: limit,
        today_completed: todayCount,
        is_limit_reached: limit !== null && todayCount >= limit,
        remaining: limit !== null ? Math.max(0, limit - todayCount) : null,
      };
    });

    // 2. Fetch Employee Targets with Live Progress
    const targets = await prisma.sectionTarget.findMany({
      where: { employee_id: employeeId },
      include: {
        section: { select: { id: true, name: true } },
      },
      orderBy: [{ period_start: 'desc' }, { created_at: 'desc' }],
    });

    const targetsWithProgress = await Promise.all(
      targets.map(async (t) => {
        let achieved_value = 0;
        try {
          const pStart = t.period_type === 'DAILY' ? startOfDhakaDay : t.period_start ? new Date(t.period_start) : startOfDhakaDay;
          const pEnd = t.period_type === 'DAILY' ? endOfDhakaDay : t.period_end ? new Date(t.period_end) : endOfDhakaDay;

          if (t.metric_type === MetricType.POSTS_DONE) {
            const whereClause: any = {
              employee_id: employeeId,
              undone_at: null,
              completed_at: { gte: pStart, lte: pEnd },
            };
            if (t.section_id) {
              whereClause.group_link = { section_id: t.section_id };
            }
            achieved_value = await prisma.linkCompletion.count({ where: whereClause });
          } else {
            const entries = await prisma.dailyEntry.findMany({
              where: {
                employee_id: employeeId,
                date: { gte: pStart, lte: pEnd },
              },
            });
            const key = t.metric_type.toLowerCase();
            achieved_value = entries.reduce((acc, e: any) => acc + (Number(e[key]) || 0), 0);
          }
        } catch {
          achieved_value = 0;
        }

        const targetNum = Number(t.target_value) || 1;
        const percentage = Math.min(Math.round((achieved_value / targetNum) * 100), 100);

        return {
          id: t.id,
          metric_type: t.metric_type,
          section_id: t.section_id,
          section_name: t.section?.name || null,
          period_type: t.period_type,
          period_start: t.period_start,
          target_value: targetNum,
          achieved_value,
          percentage,
          is_met: achieved_value >= targetNum,
        };
      })
    );

    // 3. Recent Completed Links History (last 30)
    const recentCompletions = await prisma.linkCompletion.findMany({
      where: {
        employee_id: employeeId,
        undone_at: null,
      },
      orderBy: { completed_at: 'desc' },
      take: 30,
      include: {
        group_link: {
          select: {
            id: true,
            title: true,
            url: true,
            section: { select: { id: true, name: true } },
          },
        },
      },
    });

    // 4. Recent Leads (last 15)
    const recentLeads = await prisma.lead.findMany({
      where: { employee_id: employeeId },
      orderBy: { created_at: 'desc' },
      take: 15,
      include: {
        product: { select: { id: true, name: true } },
      },
    });

    // 5. Total counts
    const totalCompletedLinks = await prisma.linkCompletion.count({
      where: { employee_id: employeeId, undone_at: null },
    });
    const totalLeads = await prisma.lead.count({
      where: { employee_id: employeeId },
    });

    return NextResponse.json({
      employee,
      assignedSections,
      targets: targetsWithProgress,
      recentCompletions: recentCompletions.map((c) => ({
        id: c.id,
        link_id: c.group_link.id,
        title: c.group_link.title || c.group_link.url,
        url: c.group_link.url,
        section_name: c.group_link.section?.name || 'General',
        completed_at: c.completed_at,
      })),
      recentLeads: recentLeads.map((l) => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        product_name: l.product?.name || 'General Product',
        status: l.status,
        sale_amount: l.sale_amount,
        created_at: l.created_at,
      })),
      stats: {
        totalCompletedLinks,
        todayCompletedLinks: todayCompletions.length,
        totalLeads,
      },
    });
  } catch (error) {
    console.error('Error fetching employee work profile:', error);
    return NextResponse.json({ error: 'Failed to fetch employee work profile' }, { status: 500 });
  }
}
