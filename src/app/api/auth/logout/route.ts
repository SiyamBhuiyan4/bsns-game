import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, getSession, removeSessionCookie } from '@/lib/session';

export async function POST() {
  await removeSessionCookie();
  return NextResponse.json({ success: true, message: 'সফলভাবে লগআউট হয়েছে / Logged out successfully' });
}

/**
 * Where a page sends someone whose cookie still verifies but whose account was deactivated or
 * deleted. The middleware only checks the token, so without clearing the cookie /login would
 * bounce them straight back to the panel and loop. A live session is never cleared here, so a
 * cross-site link cannot log anyone out.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  const res = NextResponse.redirect(new URL(session ? '/' : '/login', request.url));
  if (!session) res.cookies.delete(COOKIE_NAME);
  return res;
}
