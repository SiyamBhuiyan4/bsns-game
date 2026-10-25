import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';
import { INTENTS } from '@/lib/agent/navigator';

const phraseSchema = z.object({
  phrase: z.string().trim().min(2, 'বাক্য দিন / Enter a phrase').max(200),
  intentId: z.string().min(1),
});

async function guard() {
  try {
    await requireAdmin();
    return null;
  } catch {
    return NextResponse.json({ error: 'লগইন প্রয়োজন / Unauthorized' }, { status: 401 });
  }
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const phrases = await prisma.agentPhrase.findMany({ orderBy: { created_at: 'desc' } });
  return NextResponse.json({
    phrases,
    pages: INTENTS.map((i) => ({ id: i.id, href: i.href, labelBn: i.labelBn, labelEn: i.labelEn })),
  });
}

export async function POST(request: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const parsed = phraseSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
  }
  const intent = INTENTS.find((i) => i.id === parsed.data.intentId);
  if (!intent) return NextResponse.json({ error: 'পেজ পাওয়া যায়নি / Unknown page' }, { status: 400 });

  try {
    const phrase = await prisma.agentPhrase.create({
      data: { phrase: parsed.data.phrase.toLowerCase(), href: intent.href, label: intent.labelBn },
    });
    return NextResponse.json({ phrase }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'এই বাক্য আগেই শেখানো আছে / This phrase is already taught' }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await prisma.agentPhrase.deleteMany({ where: { id } });
  return NextResponse.json({ success: true });
}
