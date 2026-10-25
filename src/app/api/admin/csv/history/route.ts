import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get('sectionId');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20', 10) || 20));
  const skip = (page - 1) * limit;

  try {
    const where = sectionId ? { section_id: sectionId } : undefined;

    const [total, batches] = await Promise.all([
      prisma.csvUploadBatch.count({ where }),
      prisma.csvUploadBatch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          section: { select: { id: true, name: true } },
          uploader: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    const formatted = batches.map((b) => ({
      id: b.id,
      file_name: b.file_name,
      section_id: b.section.id,
      section_name: b.section.name,
      uploader_name: b.uploader.name,
      uploader_email: b.uploader.email,
      total_rows: b.total_rows,
      inserted: b.inserted,
      duplicates: b.duplicates,
      invalid: b.invalid,
      created_at: b.created_at,
    }));

    return NextResponse.json({
      batches: formatted,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Error fetching CSV upload history:', error);
    return NextResponse.json({ error: 'আপলোড ইতিহাস লোড করা যায়নি' }, { status: 500 });
  }
}
