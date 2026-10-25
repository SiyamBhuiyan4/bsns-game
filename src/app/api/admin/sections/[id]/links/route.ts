import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { normalizeUrl, isValidHttpUrl, sanitizeCsvCell } from '@/lib/csv';
import { z } from 'zod';

const createLinkSchema = z.object({
  url: z.string().min(5, 'সঠিক লিঙ্ক দিন'),
  title: z.string().max(200).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  const { id: sectionId } = await params;
  const { searchParams } = new URL(request.url);

  const query = searchParams.get('q')?.trim() || '';
  const statusFilter = searchParams.get('status') || 'ALL'; // ALL, ACTIVE, INACTIVE
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.max(1, parseInt(searchParams.get('limit') || '25', 10));
  const skip = (page - 1) * limit;

  try {
    const where: {
      section_id: string;
      is_active?: boolean;
      OR?: Array<{ title?: { contains: string; mode: 'insensitive' }; url?: { contains: string; mode: 'insensitive' } }>;
    } = {
      section_id: sectionId,
    };

    if (statusFilter === 'ACTIVE') {
      where.is_active = true;
    } else if (statusFilter === 'INACTIVE') {
      where.is_active = false;
    }

    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { url: { contains: query, mode: 'insensitive' } },
      ];
    }

    const [total, links] = await Promise.all([
      prisma.groupLink.count({ where }),
      prisma.groupLink.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          uploaded_batch: {
            select: { id: true, file_name: true, created_at: true },
          },
          _count: {
            select: {
              completions: {
                where: { undone_at: null },
              },
            },
          },
        },
      }),
    ]);

    const formattedLinks = links.map((l) => ({
      id: l.id,
      url: l.url,
      title: l.title,
      is_active: l.is_active,
      created_at: l.created_at,
      batch_file: l.uploaded_batch?.file_name || null,
      completions_count: l._count.completions,
    }));

    return NextResponse.json({
      links: formattedLinks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching group links:', error);
    return NextResponse.json({ error: 'লিংক লোড করা যায়নি' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  const { id: sectionId } = await params;

  try {
    const body = await request.json();
    const parse = createLinkSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.issues[0]?.message || 'অবৈধ তথ্য' }, { status: 400 });
    }

    const normalized = normalizeUrl(parse.data.url);
    if (!isValidHttpUrl(normalized)) {
      return NextResponse.json({ error: 'সঠিক HTTP/HTTPS লিঙ্ক প্রদান করুন' }, { status: 400 });
    }

    // Check duplicate in same section
    const existing = await prisma.groupLink.findUnique({
      where: {
        section_id_url: {
          section_id: sectionId,
          url: normalized,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'এই লিঙ্কটি এই সেকশনে ইতিমধ্যে যুক্ত আছে (Link already exists in this section)' },
        { status: 400 }
      );
    }

    const sanitizedTitle = parse.data.title ? sanitizeCsvCell(parse.data.title) : null;

    const link = await prisma.groupLink.create({
      data: {
        section_id: sectionId,
        url: normalized,
        title: sanitizedTitle,
        is_active: true,
      },
    });

    await createAuditLog({
      actorId: session.userId,
      action: 'CREATE',
      entity: 'GroupLink',
      entityId: link.id,
      payload: { sectionId, url: link.url, title: link.title },
    });

    return NextResponse.json({ success: true, link }, { status: 201 });
  } catch (error) {
    console.error('Error creating group link:', error);
    return NextResponse.json({ error: 'লিঙ্ক তৈরি ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
