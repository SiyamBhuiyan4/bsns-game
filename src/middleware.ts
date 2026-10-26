import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getJwtKey } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';

const secretKey = getJwtKey();
const COOKIE_NAME = 'auth_token';

interface TokenPayload {
  userId: string;
  role: 'ADMIN' | 'EMPLOYEE';
  email: string;
  name: string;
}

async function verifyAuth(request: NextRequest): Promise<TokenPayload | null> {
  const token =
    request.cookies.get(COOKIE_NAME)?.value ||
    (request.headers.get('authorization')?.startsWith('Bearer ')
      ? request.headers.get('authorization')!.slice(7).trim()
      : undefined);
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
    return {
      userId: (payload.userId || payload.id) as string,
      role: payload.role as 'ADMIN' | 'EMPLOYEE',
      email: payload.email as string,
      name: payload.name as string,
    };
  } catch {
    return null;
  }
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Caller IP as the proxy reports it, for rate-limit bucketing. */
function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip')?.trim() || '127.0.0.1';
}

/**
 * Cross-site request check for anything that writes.
 *
 * The session cookie is already SameSite=strict, so this is a second line: a
 * same-origin fetch always sends Origin on a mutating request, so a missing or
 * foreign Origin on one of these means it did not come from our own pages.
 */
function originAllowed(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!host) return false;

  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  // No Origin: fall back to Referer, which browsers still send for same-origin posts.
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Cron is machine-to-machine: it carries a bearer secret and no Origin.
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/cron') && MUTATING.has(request.method)) {
    if (!originAllowed(request)) {
      return NextResponse.json(
        { error: 'অনুরোধটি গ্রহণ করা যায়নি / Request blocked: bad origin' },
        { status: 403 }
      );
    }

    // A ceiling on writes per IP. Well above what the UI does, low enough that a
    // script hammering an endpoint gets cut off. The login routes keep their own,
    // much stricter, limit on top of this.
    const ip = clientIp(request);
    const burst = checkRateLimit(`write:${ip}`, 90, 60 * 1000);
    if (!burst.allowed) {
      return NextResponse.json(
        { error: 'অনেক বেশি অনুরোধ, কিছুক্ষণ পর চেষ্টা করুন / Too many requests' },
        { status: 429, headers: { 'Retry-After': String(burst.resetSeconds) } }
      );
    }
  }

  const user = await verifyAuth(request);

  // Protect /api/admin/* API routes
  if (pathname.startsWith('/api/admin')) {
    if (!user) {
      return NextResponse.json({ error: 'লগইন করা নেই / Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'অনুমতি নেই / Forbidden' }, { status: 403 });
    }
    return NextResponse.next();
  }

  // Protect /api/employee/* API routes
  if (pathname.startsWith('/api/employee')) {
    if (!user) {
      return NextResponse.json({ error: 'লগইন করা নেই / Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'EMPLOYEE' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'অনুমতি নেই / Forbidden' }, { status: 403 });
    }
    return NextResponse.next();
  }

  // Root path routing
  if (pathname === '/') {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (user.role === 'ADMIN') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/employee/dashboard', request.url));
  }

  // Login page access
  if (pathname === '/login') {
    if (user) {
      if (user.role === 'ADMIN') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      }
      return NextResponse.redirect(new URL('/employee/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Admin passcode page access
  if (pathname === '/admin-login') {
    if (user?.role === 'ADMIN') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Protect Admin routes
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const loginUrl = new URL('/admin-login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (user.role !== 'ADMIN') {
      // Forbidden: redirect employee away from admin pages
      return NextResponse.redirect(new URL('/employee/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Protect Employee routes
  if (pathname.startsWith('/employee')) {
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (user.role !== 'EMPLOYEE') {
      // Redirect admin to admin dashboard
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/admin-login',
    '/admin/:path*',
    '/employee/:path*',
    // Every API route, so the cross-site check covers the ones that are not
    // under /api/admin or /api/employee (leads, targets, plan, products, ...).
    '/api/:path*',
  ],
};
