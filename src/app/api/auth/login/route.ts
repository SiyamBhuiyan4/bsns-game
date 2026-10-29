import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { verifyPassword, signToken } from '@/lib/auth';
import { setSessionCookie } from '@/lib/session';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/client-ip';

// bcrypt hash of a random string nobody knows; compared against when the account does not exist.
const DUMMY_HASH = '$2b$12$dzRpfAKNFDfY.qT324ZcseEfW3mnouJmZP/W6VnCIDChJDoZxdQIq';
import { createAuditLog } from '@/lib/audit';

const loginSchema = z.object({
  email: z.string().email({ message: 'সঠিক ইমেইল ঠিকানা দিন / Please enter a valid email' }),
  password: z.string().min(6, { message: 'পাসওয়ার্ড ন্যূনতম ৬ অক্ষরের হতে হবে / Password must be at least 6 characters' }),
});

export async function POST(request: NextRequest) {
  try {
    // 1. IP extraction and Rate Limiting
    // The leftmost X-Forwarded-For entry is whatever the client sent; clientIp reads the one the platform set.
    const ip = clientIp(request);

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
    const accountKey = `acct:${email.toLowerCase().trim()}`;

    // Per-account limit as well, so one email cannot be guessed from many addresses.
    const accountCheck = checkRateLimit(accountKey, 10, 15 * 60 * 1000);
    if (!accountCheck.allowed) {
      return NextResponse.json(
        {
          error: `অতিরিক্ত চেষ্টার কারণে লগইন সাময়িক বন্ধ আছে। দয়া করে ${accountCheck.resetSeconds} সেকেন্ড পর চেষ্টা করুন। (Too many attempts. Please try again in ${accountCheck.resetSeconds}s)`,
        },
        { status: 429, headers: { 'Retry-After': String(accountCheck.resetSeconds) } }
      );
    }

    // 3. Lookup user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // 4. Verify password. A missing or admin account still pays for one bcrypt check, so the
    // response time does not reveal which emails exist. Admins sign in through /admin-login.
    const candidate = user && user.role !== 'ADMIN' ? user : null;
    const isPasswordValid = await verifyPassword(password, candidate?.password_hash ?? DUMMY_HASH);
    if (!candidate || !isPasswordValid) {
      return NextResponse.json(
        { error: 'ইমেইল বা পাসওয়ার্ড সঠিক নয় / Invalid email or password' },
        { status: 401 }
      );
    }

    // Only someone who knows the password learns the account is switched off.
    if (!candidate.is_active) {
      return NextResponse.json(
        { error: 'আপনার অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন। / Your account is deactivated.' },
        { status: 403 }
      );
    }

    // Reset rate limit on success
    resetRateLimit(ip);
    resetRateLimit(accountKey);

    // 5. Generate token & set cookie
    const token = await signToken({
      userId: candidate.id,
      name: candidate.name,
      email: candidate.email,
      role: candidate.role,
      phone: candidate.phone,
    });

    await setSessionCookie(token);

    // 6. Log audit
    await createAuditLog({
      actorId: candidate.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: candidate.id,
      payload: { email: candidate.email, role: candidate.role, ip },
    });

    const redirectUrl = '/employee/dashboard';

    return NextResponse.json({
      success: true,
      user: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        role: candidate.role,
        phone: candidate.phone,
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
