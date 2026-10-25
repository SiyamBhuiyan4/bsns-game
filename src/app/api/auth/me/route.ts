import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'লগইন করা নেই / Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    user: session,
  });
}
