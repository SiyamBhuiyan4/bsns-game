import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { verifyPassword, signToken } from '@/lib/auth';
import { setSessionCookie } from '@/lib/session';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';
import { createAuditLog } from '@/lib/audit';

const loginSchema = z.object({
  email: z.string().email({ message: 'সঠিক ইমেইল ঠিকানা দিন / Please enter a valid email' }),
  password: z.string().min(6, { message: 'পাসওয়ার্ড ন্যূনতম ৬ অক্ষরের হতে হবে / Password must be at least 6 characters' }),
});

export async function POST(request: NextRequest) {
  try {
    // 1. IP extraction and Rate Limiting
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp?.trim() || '127.0.0.1');
    
    const rateCheck = checkRateLimit(ip, 5, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `অতিরিক্ত চেষ্টার কারণে লগইন সাময়িক বন্ধ আছে। দয়া করে ${rateCheck.resetSeconds} সেকেন্ড পর চেষ্টা করুন। (Too many attempts. Please try again in ${rateCheck.resetSeconds}s)`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateCheck.resetSeconds),
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateCheck.resetSeconds),
          },
        }
      );
    }

    // 2. Validate input
    const body = await request.json();
    const parseResult = loginSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: parseResult.error.issues[0]?.message || 'অবৈধ তথ্য / Invalid input',
        },
        { status: 400 }
      );
    }

    const { email, password } = parseResult.data;

    // 3. Lookup user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Admins sign in through the separate passcode page (/admin-login)
    if (!user || user.role === 'ADMIN') {
      return NextResponse.json(
        { error: 'ইমেইল বা পাসওয়ার্ড সঠিক নয় / Invalid email or password' },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { error: 'আপনার অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন। / Your account is deactivated.' },
        { status: 403 }
      );
    }

    // 4. Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'ইমেইল বা পাসওয়ার্ড সঠিক নয় / Invalid email or password' },
        { status: 401 }
      );
    }

    // Reset rate limit on success
    resetRateLimit(ip);

    // 5. Generate token & set cookie
    const token = await signToken({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
    });

    await setSessionCookie(token);

    // 6. Log audit
    await createAuditLog({
      actorId: user.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      payload: { email: user.email, role: user.role, ip },
    });

    const redirectUrl = '/employee/dashboard';

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
      redirectUrl,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'সার্ভারে সমস্যা হয়েছে, কিছুক্ষণ পর চেষ্টা করুন / Internal server error' },
      { status: 500 }
    );
  }
}
