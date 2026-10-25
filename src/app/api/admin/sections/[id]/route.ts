import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const updateSectionSchema = z.object({
  name: z.string().trim().min(2, 'সেকশনের নাম কমপক্ষে ২ অক্ষরের হতে হবে (Name must be at least 2 chars)').max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  is_active: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const [section, activeLinksCount] = await Promise.all([
      prisma.groupSection.findUnique({
        where: { id },
        include: {
          assignments: {
            include: {
              employee: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
          _count: {
            select: {
              group_links: true,
              assignments: true,
              csv_batches: true,
            },
          },
        },
      }),
      prisma.groupLink.count({
        where: { section_id: id, is_active: true },
      }),
    ]);

    if (!section) {
      return NextResponse.json({ error: 'সেকশন পাওয়া যায়নি (Section not found)' }, { status: 404 });
    }

    return NextResponse.json({
      section: {
        ...section,
        active_links_count: activeLinksCount,
      },
    });
  } catch (error) {
    console.error('Error fetching section:', error);
    return NextResponse.json({ error: 'সার্ভার ত্রুটি' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parse = updateSectionSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.issues[0]?.message || 'অবৈধ তথ্য' }, { status: 400 });
    }

    const currentSection = await prisma.groupSection.findUnique({ where: { id } });
    if (!currentSection) {
      return NextResponse.json({ error: 'সেকশন পাওয়া যায়নি' }, { status: 404 });
    }

    const { name, description, is_active } = parse.data;

    // If name changed, check uniqueness
    if (name && name.trim().toLowerCase() !== currentSection.name.toLowerCase()) {
      const existing = await prisma.groupSection.findUnique({
        where: { name: name.trim() },
      });
      if (existing && existing.id !== id) {
        return NextResponse.json(
          { error: 'এই নামের সেকশন ইতিমধ্যে অন্য একটি রয়েছে' },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.groupSection.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(is_active !== undefined ? { is_active } : {}),
      },
    });

    await createAuditLog({
      actorId: session.userId,
      action: 'UPDATE',
      entity: 'GroupSection',
      entityId: id,
      payload: {
        old: { name: currentSection.name, is_active: currentSection.is_active },
        new: { name: updated.name, is_active: updated.is_active },
      },
    });

    return NextResponse.json({ success: true, section: updated });
  } catch (error) {
    console.error('Error updating section:', error);
    return NextResponse.json({ error: 'সেকশন আপডেট ব্যর্থ হয়েছে' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const section = await prisma.groupSection.findUnique({
      where: { id },
      include: {
        _count: {
          select: { group_links: true },
        },
      },
    });

    if (!section) {
      return NextResponse.json({ error: 'সেকশন পাওয়া যায়নি' }, { status: 404 });
    }

    // Specific guard: cannot delete sections that contain active links
    const activeLinksCount = await prisma.groupLink.count({
      where: { section_id: id, is_active: true },
    });
    if (activeLinksCount > 0) {
      return NextResponse.json(
        {
          error: `এই section-এ ${activeLinksCount}টি সক্রিয় লিংক রয়েছে, তাই delete করা যাবে না। Deactivate করুন। (Cannot delete sections that contain active links. Please deactivate it instead.)`,
        },
        { status: 400 }
      );
    }

    // Specification rule:
    // "Delete is allowed only when the section has no group links. Otherwise, deactivate it."
    if (section._count.group_links > 0) {
      return NextResponse.json(
        {
          error: 'এই section-এ লিংক আছে, তাই delete করা যাবে না। Deactivate করুন। (This section has links and cannot be deleted. Please deactivate it instead.)',
        },
        { status: 400 }
      );
    }

    await prisma.groupSection.delete({ where: { id } });

    await createAuditLog({
      actorId: session.userId,
      action: 'DELETE',
      entity: 'GroupSection',
      entityId: id,
      payload: { name: section.name },
    });

    return NextResponse.json({
      success: true,
      message: 'সেকশন সফলভাবে মুছে ফেলা হয়েছে (Section deleted successfully)',
    });
  } catch (error) {
    console.error('Error deleting section:', error);
    return NextResponse.json({ error: 'সেকশন ডিলিট ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
