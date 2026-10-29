import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../src/middleware';

const req = (path: string, method = 'GET') =>
  new NextRequest(`https://app.test${path}`, {
    method,
    headers: { host: 'app.test', origin: 'https://app.test', 'x-vercel-forwarded-for': `10.0.${Math.floor(Math.random() * 250)}.1` },
  });

describe('middleware backstop', () => {
  it('answers nothing from a data API without a login', async () => {
    for (const path of ['/api/leads', '/api/plan', '/api/products', '/api/targets/today', '/api/campaigns', '/api/auth/me']) {
      const res = await middleware(req(path));
      expect(res.status, path).toBe(401);
    }
  });

  it('still lets the sign-in routes and cron through to their own checks', async () => {
    for (const [path, method] of [['/api/auth/login', 'POST'], ['/api/auth/admin-login', 'POST'], ['/api/auth/logout', 'GET'], ['/api/cron/daily-lock', 'GET']] as const) {
      const res = await middleware(req(path, method));
      expect(res.status, path).not.toBe(401);
    }
  });
});
