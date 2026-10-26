import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-marketing-system-2026-secure-random';
const secretKey = new TextEncoder().encode(JWT_SECRET);
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
    const { payload } = await jwtVerify(token, secretKey);
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
    '/api/admin/:path*',
    '/api/employee/:path*',
  ],
};
