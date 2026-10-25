import { NextResponse } from 'next/server';
import { removeSessionCookie } from '@/lib/session';

export async function POST() {
  await removeSessionCookie();
  return NextResponse.json({ success: true, message: 'সফলভাবে লগআউট হয়েছে / Logged out successfully' });
}
