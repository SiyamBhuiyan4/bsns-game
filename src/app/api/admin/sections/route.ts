import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const sectionSchema = z.object({
  name: z.string().trim().min(2, 'সেকশনের নাম কমপক্ষে ২ অক্ষরের হতে হবে (Name must be at least 2 chars)').max(100),
  description: z.string().trim().max(500).optional().nullable(),
  is_active: z.boolean().optional().default(true),
});

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  try {
    const sections = await prisma.groupSection.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        _count: {
          select: {
            group_links: true,
            assignments: true,
          },
        },
      },
    });

    const activeCounts = await prisma.groupLink.groupBy({
      by: ['section_id'],
      where: { is_active: true },
      _count: { id: true },
    });

    const activeMap = new Map(activeCounts.map((c) => [c.section_id, c._count.id]));

    const result = sections.map((sec) => ({
      id: sec.id,
      name: sec.name,
      description: sec.description,
      is_active: sec.is_active,
      total_links: sec._count.group_links,
      active_links: activeMap.get(sec.id) || 0,
      assigned_employees: sec._count.assignments,
      created_at: sec.created_at,
    }));

    return NextResponse.json({ sections: result });
  } catch (error) {
    console.error('Error fetching sections:', error);
    return NextResponse.json({ error: 'সেকশন তালিকা লোড করা যায়নি' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parse = sectionSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.issues[0]?.message || 'অবৈধ তথ্য' }, { status: 400 });
    }

    const { name, description, is_active } = parse.data;

    // Check unique name
    const existing = await prisma.groupSection.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'এই নামের সেকশন ইতিমধ্যে বিদ্যমান (A section with this name already exists)' },
        { status: 400 }
      );
    }

    const section = await prisma.groupSection.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        is_active: is_active ?? true,
      },
    });

    // Audit log
    await createAuditLog({
      actorId: session.userId,
      action: 'CREATE',
      entity: 'GroupSection',
      entityId: section.id,
      payload: { name: section.name, is_active: section.is_active },
    });

    return NextResponse.json({ success: true, section }, { status: 201 });
  } catch (error) {
    console.error('Error creating section:', error);
    return NextResponse.json({ error: 'সেকশন তৈরি ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
