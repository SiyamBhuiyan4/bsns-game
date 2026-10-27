import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { checkTargetOverlap } from '@/lib/targets';
import { MetricType, PeriodType, Prisma } from '@prisma/client';
import { endOfMonth } from 'date-fns';
import { z } from 'zod';

const targetSchema = z.object({
  section_id: z.string().uuid().nullable().optional(),
  employee_id: z.string().uuid().nullable().optional(),
  metric_type: z.nativeEnum(MetricType),
  target_value: z.number().positive(),
  period_type: z.nativeEnum(PeriodType).default(PeriodType.MONTHLY),
  period_start: z.string().nullable().optional(),
  period_end: z.string().nullable().optional(),
});

const bulkJobsSchema = z.object({
  employee_id: z.string().uuid().nullable().optional(),
  period_type: z.nativeEnum(PeriodType).default(PeriodType.DAILY),
  period_start: z.string().nullable().optional(),
  period_end: z.string().nullable().optional(),
  jobs: z.array(
    z.object({
      id: z.string().optional(),
      section_id: z.string().uuid().nullable().optional(),
      metric_type: z.nativeEnum(MetricType),
      target_value: z.number().positive(),
    })
  ).min(1),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sectionId = searchParams.get('section_id');
    const employeeId = searchParams.get('employee_id');
    const periodType = searchParams.get('period_type') as PeriodType | null;

    const where: any = {};
    if (sectionId) where.section_id = sectionId;
    // Employees see only their own targets: a colleague's quota and results are not theirs to read.
    if (session.role !== 'ADMIN') {
      where.employee_id = session.userId;
    } else if (employeeId) {
      where.employee_id = employeeId;
    }
    if (periodType) where.period_type = periodType;

    const targets = await prisma.sectionTarget.findMany({
      where,
      include: {
        section: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true, email: true } },
        employee: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ period_start: 'desc' }, { created_at: 'desc' }],
    });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const targetsWithProgress = await Promise.all(
      targets.map(async (t) => {
        let achieved_value = 0;
        try {
          const pStart =
            t.period_type === PeriodType.DAILY
              ? todayStart
              : t.period_start
              ? new Date(t.period_start)
              : monthStart;
          const pEnd =
            t.period_type === PeriodType.DAILY
              ? todayEnd
              : t.period_end
              ? new Date(t.period_end)
              : monthEnd;

          if (t.metric_type === MetricType.POSTS_DONE) {
            const completionWhere: any = {
              undone_at: null,
              completed_at: { gte: pStart, lte: pEnd },
            };
            if (t.employee_id) completionWhere.employee_id = t.employee_id;
            achieved_value = await prisma.linkCompletion.count({ where: completionWhere });
          } else {
            const entryWhere: any = {
              date: { gte: pStart, lte: pEnd },
            };
            if (t.employee_id) entryWhere.employee_id = t.employee_id;
            const entries = await prisma.dailyEntry.findMany({ where: entryWhere });
            const key = t.metric_type.toLowerCase();
            achieved_value = entries.reduce(
              (acc, e: any) => acc + (Number(e[key]) || 0),
              0
            );
          }
        } catch {
          achieved_value = 0;
        }

        return {
          ...t,
          achieved_value,
        };
      })
    );

    return NextResponse.json({ targets: targetsWithProgress });
  } catch (error) {
    console.error('Error fetching targets:', error);
    return NextResponse.json({ error: 'Failed to fetch targets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();

    // Check if bulk jobs payload is provided
    if (Array.isArray(body.jobs) && body.jobs.length > 0) {
      const parsedBulk = bulkJobsSchema.safeParse(body);
      if (!parsedBulk.success) {
        return NextResponse.json({ error: 'Validation error', details: parsedBulk.error.format() }, { status: 400 });
      }

      const { employee_id, period_type, period_start, period_end, jobs } = parsedBulk.data;
      const pStart = period_start ? new Date(period_start) : null;
      let pEnd = period_end ? new Date(period_end) : null;
      if (period_type === PeriodType.MONTHLY && pStart && !pEnd) {
        pEnd = endOfMonth(pStart);
      }

      // 1. Auto-merge any duplicate jobs in the incoming payload (e.g. 2 + 3 = 5)
      const mergedMap = new Map<string, { id?: string; section_id?: string | null; metric_type: MetricType; target_value: number }>();
      for (const job of jobs) {
        const secKey = job.metric_type === MetricType.POSTS_DONE ? (job.section_id || 'ALL') : 'NONE';
        const key = `${job.metric_type}__${secKey}`;
        const existing = mergedMap.get(key);
        if (existing) {
          existing.target_value = Number(existing.target_value) + Number(job.target_value);
          if (!existing.id && job.id) existing.id = job.id;
        } else {
          mergedMap.set(key, { ...job, target_value: Number(job.target_value) });
        }
      }
      const uniqueJobs = Array.from(mergedMap.values());

      // Execute all updates inside a single $transaction so all in-memory changes
      // are committed in exactly ONE atomic, lightning-fast Telegram snapshot write!
      const savedTargets = await prisma.$transaction(async (tx: any) => {
        const results: any[] = [];

        for (const job of uniqueJobs) {
          const { id: jobId, section_id, metric_type, target_value } = job;
          let target: any = null;

          const overlapWhere: any = {
            metric_type,
            ...(employee_id ? { employee_id } : { employee_id: null }),
            ...(section_id ? { section_id } : { section_id: null }),
          };
          const existingTargets = await tx.sectionTarget.findMany({
            where: overlapWhere,
          });

          // Match existing target by explicit jobId, or matching period_type
          const matched =
            (jobId ? existingTargets.find((t: any) => t.id === jobId) : null) ||
            existingTargets.find((t: any) => t.period_type === period_type) ||
            (jobId ? await tx.sectionTarget.findUnique({ where: { id: jobId } }) : null);

          if (matched) {
            target = await tx.sectionTarget.update({
              where: { id: matched.id },
              data: {
                target_value,
                section_id: section_id || null,
                metric_type,
                period_type,
                period_start: pStart,
                period_end: pEnd,
                set_by: session.id,
              },
              include: { section: true, employee: true },
            });

            // Clean up any duplicate records in DB for this exact same target
            const otherDuplicates = existingTargets.filter((t: any) => t.id !== matched.id && t.period_type === period_type);
            for (const dup of otherDuplicates) {
              try {
                await tx.sectionTarget.delete({ where: { id: dup.id } });
              } catch (delErr) {
                console.error('Error removing duplicate target record:', delErr);
              }
            }
          } else {
            target = await tx.sectionTarget.create({
              data: {
                section_id: section_id || null,
                employee_id: employee_id ?? null,
                metric_type,
                target_value,
                period_type,
                period_start: pStart,
                period_end: pEnd,
                set_by: session.id,
              },
              include: { section: true, employee: true },
            });
          }

          // Auto-assign employee to this group section in Assignment ONLY if metric is POSTS_DONE and section_id is chosen
          if (metric_type === MetricType.POSTS_DONE && employee_id && section_id) {
            try {
              const existingAssign = await tx.assignment.findFirst({
                where: { employee_id, section_id },
              });
              const postLimit = target_value ? Math.round(Number(target_value)) : null;
              if (!existingAssign) {
                await tx.assignment.create({
                  data: {
                    employee_id,
                    section_id,
                    post_limit: postLimit,
                    assigned_by: session.id || session.userId,
                  },
                });
              } else {
                await tx.assignment.update({
                  where: { id: existingAssign.id },
                  data: { post_limit: postLimit },
                });
              }
            } catch (assignErr) {
              console.error('Auto-assignment warning:', assignErr);
            }
          }

          results.push(target);
        }

        // Single batch audit log for the entire operation
        await createAuditLog({
          tx,
          actorId: session.id,
          action: 'TARGET_SET',
          entity: 'SectionTarget',
          entityId: employee_id || null,
          payload: {
            employee_id: employee_id || null,
            period_type,
            jobCount: uniqueJobs.length,
            jobs: uniqueJobs,
          },
        });

        return results;
      });

      return NextResponse.json({ success: true, count: savedTargets.length, targets: savedTargets }, { status: 200 });
    }

    // Single target creation / upsert
    const parsed = targetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.format() }, { status: 400 });
    }

    const { section_id, employee_id, metric_type, target_value, period_type, period_start, period_end } = parsed.data;

    const pStart = period_start ? new Date(period_start) : null;
    let pEnd = period_end ? new Date(period_end) : null;

    if (period_type === PeriodType.CUSTOM && (!pStart || !pEnd)) {
      return NextResponse.json({ error: 'Custom period requires both start and end dates' }, { status: 400 });
    }
    if (period_type === PeriodType.CUSTOM && pStart && pEnd && pStart > pEnd) {
      return NextResponse.json({ error: 'Start date must be before or equal to end date' }, { status: 400 });
    }
    if (period_type === PeriodType.MONTHLY && !pStart) {
      return NextResponse.json({ error: 'Monthly period requires start date (month)' }, { status: 400 });
    }
    if (period_type === PeriodType.MONTHLY && pStart && !pEnd) {
      pEnd = endOfMonth(pStart);
    }

    // Check for existing targets of same section, metric, and period type
    const overlapWhere: any = {
      metric_type,
      ...(employee_id ? { employee_id } : { employee_id: null }),
      ...(section_id ? { section_id } : { section_id: null }),
    };
    const existingTargets = await prisma.sectionTarget.findMany({
      where: overlapWhere,
    });

    const candidate = {
      period_type,
      period_start: pStart,
      period_end: pEnd,
    };

    // If there is an existing target
    for (const existing of existingTargets) {
      if (existing.period_type === candidate.period_type) {
        if (existing.period_type === PeriodType.DAILY) {
          // Gracefully update the daily target instead of throwing 409
          const updated = await prisma.sectionTarget.update({
            where: { id: existing.id },
            data: {
              target_value,
              period_start: pStart,
              period_end: pEnd,
              set_by: session.id,
            },
            include: { section: true, employee: true },
          });

          if (metric_type === MetricType.POSTS_DONE && employee_id && section_id) {
            try {
              const existingAssign = await prisma.assignment.findFirst({
                where: { employee_id, section_id },
              });
              const postLimit = target_value ? Math.round(Number(target_value)) : null;
              if (existingAssign) {
                await prisma.assignment.update({
                  where: { id: existingAssign.id },
                  data: { post_limit: postLimit },
                });
              } else {
                await prisma.assignment.create({
                  data: {
                    employee_id,
                    section_id,
                    post_limit: postLimit,
                    assigned_by: session.id || session.userId,
                  },
                });
              }
            } catch (assignErr) {
              console.error('Auto-assignment warning:', assignErr);
            }
          }

          await createAuditLog({
            actorId: session.id,
            action: 'TARGET_SET',
            entity: 'SectionTarget',
            entityId: updated.id,
            payload: { section_id: section_id || null, employee_id: employee_id || null, metric_type, target_value, period_type },
          });

          return NextResponse.json({ target: updated }, { status: 200 });
        }
        if (checkTargetOverlap(existing, candidate)) {
          return NextResponse.json(
            { error: 'Target period overlaps with an existing target for this metric.' },
            { status: 409 }
          );
        }
      }
    }

    const target = await prisma.sectionTarget.create({
      data: {
        section_id: section_id || null,
        employee_id: employee_id ?? null,
        metric_type,
        target_value,
        period_type,
        period_start: pStart,
        period_end: pEnd,
        set_by: session.id,
      },
      include: {
        section: true,
        employee: true,
      },
    });

    // Auto-assign employee to this group section in Assignment ONLY if metric is POSTS_DONE and a specific section_id is chosen!
    if (metric_type === MetricType.POSTS_DONE && employee_id && section_id) {
      try {
        const existingAssign = await prisma.assignment.findFirst({
          where: { employee_id, section_id },
        });
        const postLimit = target_value ? Math.round(Number(target_value)) : null;
        if (!existingAssign) {
          await prisma.assignment.create({
            data: {
              employee_id,
              section_id,
              post_limit: postLimit,
              assigned_by: session.id || session.userId,
            },
          });
        } else {
          await prisma.assignment.update({
            where: { id: existingAssign.id },
            data: { post_limit: postLimit },
          });
        }
      } catch (assignErr) {
        console.error('Auto-assignment warning:', assignErr);
      }
    }

    await createAuditLog({
      actorId: session.id,
      action: 'TARGET_SET',
      entity: 'SectionTarget',
      entityId: target.id,
      payload: {
        section_id: section_id || null,
        employee_id: employee_id || null,
        metric_type,
        target_value,
        period_type,
      },
    });

    return NextResponse.json({ target }, { status: 201 });
  } catch (error) {
    console.error('Error creating target:', error);
    return NextResponse.json({ error: 'Failed to create target' }, { status: 500 });
  }
}
