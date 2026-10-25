import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { normalizeUrl, isValidHttpUrl, sanitizeCsvCell } from '@/lib/csv';
import { z } from 'zod';

const updateLinkSchema = z.object({
  url: z.string().optional(),
  title: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  const { id: sectionId, linkId } = await params;

  try {
    const body = await request.json();
    const parse = updateLinkSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.issues[0]?.message || 'অবৈধ তথ্য' }, { status: 400 });
    }

    const currentLink = await prisma.groupLink.findUnique({
      where: { id: linkId },
    });

    if (!currentLink || currentLink.section_id !== sectionId) {
      return NextResponse.json({ error: 'লিংক পাওয়া যায়নি' }, { status: 404 });
    }

    let normalizedUrl = currentLink.url;
    if (parse.data.url && parse.data.url !== currentLink.url) {
      normalizedUrl = normalizeUrl(parse.data.url);
      if (!isValidHttpUrl(normalizedUrl)) {
        return NextResponse.json({ error: 'সঠিক HTTP/HTTPS লিঙ্ক প্রদান করুন' }, { status: 400 });
      }

      // Check duplicate
      const duplicate = await prisma.groupLink.findFirst({
        where: {
          section_id: sectionId,
          url: normalizedUrl,
          id: { not: linkId },
        },
      });
      if (duplicate) {
        return NextResponse.json({ error: 'এই সেকশনে একই URL ইতিমধ্যে রয়েছে' }, { status: 400 });
      }
    }

    const updated = await prisma.groupLink.update({
      where: { id: linkId },
      data: {
        url: normalizedUrl,
        ...(parse.data.title !== undefined ? { title: parse.data.title ? sanitizeCsvCell(parse.data.title) : null } : {}),
        ...(parse.data.is_active !== undefined ? { is_active: parse.data.is_active } : {}),
      },
    });

    await createAuditLog({
      actorId: session.userId,
      action: 'UPDATE',
      entity: 'GroupLink',
      entityId: linkId,
      payload: {
        old: { url: currentLink.url, title: currentLink.title, is_active: currentLink.is_active },
        new: { url: updated.url, title: updated.title, is_active: updated.is_active },
      },
    });

    return NextResponse.json({ success: true, link: updated });
  } catch (error) {
    console.error('Error updating link:', error);
    return NextResponse.json({ error: 'লিংক আপডেট ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
