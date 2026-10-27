import type { NextRequest } from 'next/server';

/**
 * The caller's IP for rate limiting.
 *
 * The first X-Forwarded-For entry is whatever the client sent, so it cannot be
 * trusted: rotating it gives an attacker a fresh rate-limit bucket per request.
 * Vercel sets x-vercel-forwarded-for itself; otherwise the last entry is the
 * one our own proxy appended.
 */
export function clientIp(request: NextRequest): string {
  const vercel = request.headers.get('x-vercel-forwarded-for');
  if (vercel) return vercel.split(',')[0].trim();
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return request.headers.get('x-real-ip')?.trim() || '127.0.0.1';
}
