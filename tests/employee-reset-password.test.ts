import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';

let currentSession: { userId: string; role: string; name: string; email: string } | null = null;

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(async () => currentSession),
}));

const mockAuditLogs: any[] = [];
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(async (data: any) => {
    mockAuditLogs.push(data);
    return { id: 'audit-' + Date.now(), ...data };
  }),
}));

const mockUsers: Record<string, any> = {
  'emp-1': {
    id: 'emp-1',
    name: 'Rahim Employee',
    email: 'rahim@example.com',
    role: 'EMPLOYEE',
    password_hash: '$2a$12$oldhash',
  },
  'admin-1': {
    id: 'admin-1',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'ADMIN',
    password_hash: '$2a$12$oldadminhash',
  },
};

let updatedUser: any = null;

vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return mockUsers[where.id] || null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
        updatedUser = { id: where.id, ...data };
        return updatedUser;
      }),
    },
  },
}));

import { POST } from '@/app/api/admin/employees/[id]/reset-password/route';

describe('Admin Reset Password Route & Security Verification', () => {
  beforeEach(() => {
    mockAuditLogs.length = 0;
    updatedUser = null;
    currentSession = null;
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 403', async () => {
    currentSession = null;
    const req = new NextRequest('http://localhost:3000/api/admin/employees/emp-1/reset-password', {
      method: 'POST',
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'emp-1' }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Unauthorized');
  });

  it('rejects non-admin (EMPLOYEE) requests with 403', async () => {
    currentSession = {
      userId: 'emp-2',
      role: 'EMPLOYEE',
      name: 'Another Employee',
      email: 'another@example.com',
    };
    const req = new NextRequest('http://localhost:3000/api/admin/employees/emp-1/reset-password', {
      method: 'POST',
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'emp-1' }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Unauthorized');
  });

  it('returns 404 when employee is not found', async () => {
    currentSession = {
      userId: 'admin-1',
      role: 'ADMIN',
      name: 'Admin User',
      email: 'admin@example.com',
    };
    const req = new NextRequest('http://localhost:3000/api/admin/employees/unknown-id/reset-password', {
      method: 'POST',
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'unknown-id' }) });
    expect(res.status).toBe(404);
  });

  it('returns 404 when targeted user is not an EMPLOYEE', async () => {
    currentSession = {
      userId: 'admin-1',
      role: 'ADMIN',
      name: 'Admin User',
      email: 'admin@example.com',
    };
    const req = new NextRequest('http://localhost:3000/api/admin/employees/admin-1/reset-password', {
      method: 'POST',
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'admin-1' }) });
    expect(res.status).toBe(404);
  });

  it('successfully resets password, hashes with bcrypt cost 12, logs audit, and returns temp password', async () => {
    currentSession = {
      userId: 'admin-1',
      role: 'ADMIN',
      name: 'Admin User',
      email: 'admin@example.com',
    };
    const req = new NextRequest('http://localhost:3000/api/admin/employees/emp-1/reset-password', {
      method: 'POST',
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'emp-1' }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.temporaryPassword).toBeDefined();
    expect(typeof body.temporaryPassword).toBe('string');
    expect(body.temporaryPassword.length).toBe(10);

    // Verify password update in db
    expect(updatedUser).toBeDefined();
    expect(updatedUser.id).toBe('emp-1');
    expect(updatedUser.password_hash).toBeDefined();

    // Verify bcrypt cost 12
    const rounds = bcrypt.getRounds(updatedUser.password_hash);
    expect(rounds).toBe(12);

    // Verify temporary password can be verified against the new hash
    const isValid = await bcrypt.compare(body.temporaryPassword, updatedUser.password_hash);
    expect(isValid).toBe(true);

    // Verify Audit Log
    expect(mockAuditLogs.length).toBe(1);
    expect(mockAuditLogs[0]).toEqual({
      actorId: 'admin-1',
      action: 'UPDATE',
      entity: 'User',
      entityId: 'emp-1',
      payload: {
        action: 'PASSWORD_RESET',
        employeeEmail: 'rahim@example.com',
      },
    });
  });
});
