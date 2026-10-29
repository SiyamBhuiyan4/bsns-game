import { cookies } from 'next/headers';
import { verifyToken, SessionUser } from './auth';
import prisma from './prisma';

export const COOKIE_NAME = 'auth_token';

/**
 * An employee token stays valid for 7 days, so the account is checked on every
 * request: a deactivated, deleted or re-roled employee loses access at once
 * instead of when the cookie expires. Reads come from the cached store snapshot.
 */
export async function isSessionAccountActive(session: SessionUser): Promise<boolean> {
  if (session.role !== 'EMPLOYEE') return true;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { is_active: true, role: true, password_changed_at: true },
  });
  if (!user || user.is_active === false || user.role !== 'EMPLOYEE') return false;
  // A password reset signs out every session that was opened with the old password.
  if (user.password_changed_at && session.iat !== undefined) {
    const changedAt = Math.floor(new Date(user.password_changed_at).getTime() / 1000);
    if (session.iat < changedAt) return false;
  }
  return true;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await verifyToken(token);
  if (!session) return null;
  try {
    return (await isSessionAccountActive(session)) ? session : null;
  } catch (error) {
    // Store unreachable (a Telegram hiccup): keep the verified session rather than
    // logging every employee out and clearing their cookie over a transient error.
    console.error('Session account check failed:', error);
    return session;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function removeSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }
  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireAuth();
  if (session.role !== 'ADMIN') {
    throw new Error('FORBIDDEN');
  }
  return session;
}

export async function requireEmployee(): Promise<SessionUser> {
  const session = await requireAuth();
  if (session.role !== 'EMPLOYEE') {
    throw new Error('FORBIDDEN');
  }
  return session;
}
