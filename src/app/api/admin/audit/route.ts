import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { AuditAction, Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const actorId = searchParams.get('actor_id');
  const action = searchParams.get('action');
  const entity = searchParams.get('entity');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '25', 10) || 25));
  const skip = (page - 1) * limit;

  try {
    const where: Prisma.AuditLogWhereInput = {};

    if (actorId && actorId.trim()) {
      where.actor_id = actorId.trim();
    }

    if (action && Object.values(AuditAction).includes(action as AuditAction)) {
      where.action = action as AuditAction;
    }

    if (entity && entity.trim()) {
      where.entity = {
        contains: entity.trim(),
        mode: 'insensitive',
      };
    }

    const dateFilter: Prisma.DateTimeFilter = {};
    if (startDate) {
      const parsedStart = startDate.includes('T')
        ? new Date(startDate)
        : new Date(`${startDate}T00:00:00+06:00`);
      if (!isNaN(parsedStart.getTime())) {
        dateFilter.gte = parsedStart;
      }
    }

    if (endDate) {
      const parsedEnd = endDate.includes('T')
        ? new Date(endDate)
        : new Date(`${endDate}T23:59:59.999+06:00`);
      if (!isNaN(parsedEnd.getTime())) {
        dateFilter.lte = parsedEnd;
      }
    }

    if (dateFilter.gte || dateFilter.lte) {
      where.created_at = dateFilter;
    }

    const [total, logs, users] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return NextResponse.json({
      logs,
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'অডিট লগ আনতে ত্রুটি হয়েছে / Failed to fetch audit logs' }, { status: 500 });
  }
}
