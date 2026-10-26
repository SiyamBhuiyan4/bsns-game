import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { signToken } from '@/lib/auth';
import { setSessionCookie } from '@/lib/session';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';
import { createAuditLog } from '@/lib/audit';

const adminLoginSchema = z.object({
  passcode: z.string().min(1, { message: 'পাসকোড দিন / Please enter the passcode' }),
});

function passcodeMatches(input: string, expected: string): boolean {
  // Digest first: equal-length buffers, so neither the length of the real
  // passcode nor how far a guess matched is observable from the timing.
  const a = createHash('sha256').update(input).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  try {
    // 1. IP extraction and Rate Limiting (stricter than employee login: short numeric passcode)
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp?.trim() || '127.0.0.1');
    const rateKey = `admin:${ip}`;

    const rateCheck = checkRateLimit(rateKey, 5, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `অতিরিক্ত চেষ্টার কারণে লগইন সাময়িক বন্ধ আছে। দয়া করে ${rateCheck.resetSeconds} সেকেন্ড পর চেষ্টা করুন। (Too many attempts. Please try again in ${rateCheck.resetSeconds}s)`,
        },
        { status: 429, headers: { 'Retry-After': String(rateCheck.resetSeconds) } }
      );
    }

    // 2. Validate input
    const body = await request.json();
    const parseResult = adminLoginSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || 'অবৈধ তথ্য / Invalid input' },
        { status: 400 }
      );
    }

    const expected = process.env.ADMIN_PASSCODE;
    if (!expected) {
      console.error('ADMIN_PASSCODE is not configured');
      return NextResponse.json(
        { error: 'সার্ভারে সমস্যা হয়েছে, কিছুক্ষণ পর চেষ্টা করুন / Internal server error' },
        { status: 500 }
      );
    }

    // 3. Verify passcode
    if (!passcodeMatches(parseResult.data.passcode.trim(), expected)) {
      return NextResponse.json({ error: 'পাসকোড সঠিক নয় / Invalid passcode' }, { status: 401 });
    }

    // 4. Sign in as the admin account
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN', is_active: true },
      orderBy: { created_at: 'asc' },
    });
    if (!admin) {
      return NextResponse.json(
        { error: 'কোনো সক্রিয় অ্যাডমিন অ্যাকাউন্ট নেই / No active admin account' },
        { status: 403 }
      );
    }

    resetRateLimit(rateKey);

    const token = await signToken({
      userId: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      phone: admin.phone,
    });
    await setSessionCookie(token);

    await createAuditLog({
      actorId: admin.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: admin.id,
      payload: { method: 'passcode', role: admin.role, ip },
    });

    return NextResponse.json({ success: true, redirectUrl: '/admin/dashboard' });
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { error: 'সার্ভারে সমস্যা হয়েছে, কিছুক্ষণ পর চেষ্টা করুন / Internal server error' },
      { status: 500 }
    );
  }
}
