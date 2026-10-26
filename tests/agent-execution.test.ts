import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseMessage } from '../src/lib/agent/router';
import { executeCommand } from '../src/lib/agent/commands';

const mockUsers: any[] = [
  {
    id: 'user-1',
    name: 'Arif',
    email: 'arif@example.com',
    role: 'EMPLOYEE',
    is_active: true,
    can_view_all_customers: false,
    password_hash: 'oldhash',
  },
  {
    id: 'user-2',
    name: 'akkas',
    email: 'akkas@example.com',
    role: 'EMPLOYEE',
    is_active: true,
    can_view_all_customers: false,
    password_hash: 'oldhash',
  },
];

const mockSections: any[] = [
  {
    id: 'sec-1',
    name: 'Dhaka Farmers',
    is_active: true,
  },
];

const mockAssignments: any[] = [];
const mockAuditLogs: any[] = [];

vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findMany: vi.fn(async () => mockUsers),
      findFirst: vi.fn(async ({ where }: any) => {
        if (where?.email) {
          return mockUsers.find((u) => u.email.toLowerCase() === where.email.toLowerCase()) || null;
        }
        if (where?.name?.contains) {
          const query = where.name.contains.toLowerCase();
          return mockUsers.find((u) => u.name.toLowerCase().includes(query)) || null;
        }
        if (where?.OR) {
          for (const cond of where.OR) {
            if (cond.email) {
              const u = mockUsers.find((u) => u.email.toLowerCase() === cond.email.toLowerCase());
              if (u) return u;
            }
            if (cond.name?.contains) {
              const u = mockUsers.find((u) => u.name.toLowerCase().includes(cond.name.contains.toLowerCase()));
              if (u) return u;
            }
          }
        }
        return null;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        if (where?.email) {
          return mockUsers.find((u) => u.email.toLowerCase() === where.email.toLowerCase()) || null;
        }
        if (where?.id) {
          return mockUsers.find((u) => u.id === where.id) || null;
        }
        return null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const created = { id: 'user-' + (mockUsers.length + 1), ...data };
        mockUsers.push(created);
        return created;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const u = mockUsers.find((x) => x.id === where.id);
        if (u) Object.assign(u, data);
        return u;
      }),
    },
    groupSection: {
      findMany: vi.fn(async () => mockSections),
      create: vi.fn(async ({ data }: any) => {
        const created = { id: 'sec-' + (mockSections.length + 1), ...data };
        mockSections.push(created);
        return created;
      }),
    },
    assignment: {
      findMany: vi.fn(async ({ where }: any) => {
        return mockAssignments.filter(
          (a) => a.employee_id === where.employee_id && a.section_id === where.section_id
        );
      }),
      create: vi.fn(async ({ data }: any) => {
        const created = { id: 'asgn-' + (mockAssignments.length + 1), ...data };
        mockAssignments.push(created);
        return created;
      }),
    },
    groupLink: {
      findMany: vi.fn(async () => []),
      createMany: vi.fn(async () => ({ count: 1 })),
    },
  },
}));

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(async (log: any) => {
    mockAuditLogs.push(log);
    return { id: 'audit-' + mockAuditLogs.length, ...log };
  }),
}));

vi.mock('@/lib/auth', () => ({
  hashPassword: vi.fn(async (pwd: string) => `hashed_${pwd}`),
}));

describe('Natural Language Commands End-to-End Execution', () => {
  const ctxPreview = { actorId: 'admin-1', confirm: false };
  const ctxConfirm = { actorId: 'admin-1', confirm: true };

  it('parses and executes multiline employee creation', async () => {
    const input = `akkas nam er employee profile banao\nnew_akkas@gmail.com\n000000`;
    const parsed = parseMessage(input);

    expect(parsed.command).toBe('team');
    expect(parsed.args).toEqual([
      'add',
      'name=akkas',
      'password=000000',
      'email=new_akkas@gmail.com',
    ]);

    // Preview
    const previewRes = await executeCommand(parsed.command!, parsed.args, ctxPreview);
    expect(previewRes.needsConfirmation).toBe(true);
    expect(previewRes.reply).toContain('akkas');
    expect(previewRes.reply).toContain('new_akkas@gmail.com');
    // Ensure password is never leaked in the reply
    expect(previewRes.reply).not.toContain('000000');

    // Confirm
    const confirmRes = await executeCommand(parsed.command!, parsed.args, ctxConfirm);
    expect(confirmRes.reply).toContain('তৈরি হয়েছে');
    const createdUser = mockUsers.find((u) => u.email === 'new_akkas@gmail.com');
    expect(createdUser).toBeDefined();
    expect(createdUser.password_hash).toBe('hashed_000000');
  });

  it('parses and executes section assignment (Arif ke Dhaka Farmers e assign koro)', async () => {
    const input = 'Arif ke Dhaka Farmers e assign koro';
    const parsed = parseMessage(input);

    expect(parsed.command).toBe('assign');
    expect(parsed.args).toEqual(['Arif', 'to', 'Dhaka Farmers']);

    // Preview
    const previewRes = await executeCommand(parsed.command!, parsed.args, ctxPreview);
    expect(previewRes.needsConfirmation).toBe(true);
    expect(previewRes.reply).toContain('Arif');
    expect(previewRes.reply).toContain('Dhaka Farmers');

    // Confirm
    const confirmRes = await executeCommand(parsed.command!, parsed.args, ctxConfirm);
    expect(confirmRes.reply).toContain('যুক্ত করা হয়েছে');
    expect(mockAssignments.some((a) => a.employee_id === 'user-1' && a.section_id === 'sec-1')).toBe(true);
  });

  it('parses and executes customer permission grant (give Arif permission to view all customers)', async () => {
    const input = 'give Arif permission to view all customers';
    const parsed = parseMessage(input);

    expect(parsed.command).toBe('permission');
    expect(parsed.args).toEqual(['Arif', 'grant']);

    // Preview
    const previewRes = await executeCommand(parsed.command!, parsed.args, ctxPreview);
    expect(previewRes.needsConfirmation).toBe(true);

    // Confirm
    const confirmRes = await executeCommand(parsed.command!, parsed.args, ctxConfirm);
    expect(confirmRes.reply).toContain('অনুমতি চালু করা হয়েছে');
    const arif = mockUsers.find((u) => u.id === 'user-1');
    expect(arif.can_view_all_customers).toBe(true);
  });

  it('parses and executes customer permission revoke (Arif er customer access bondho koro)', async () => {
    const input = 'Arif er customer access bondho koro';
    const parsed = parseMessage(input);

    expect(parsed.command).toBe('permission');
    expect(parsed.args).toEqual(['Arif', 'revoke']);

    // Confirm
    const confirmRes = await executeCommand(parsed.command!, parsed.args, ctxConfirm);
    expect(confirmRes.reply).toContain('অনুমতি বন্ধ করা হয়েছে');
    const arif = mockUsers.find((u) => u.id === 'user-1');
    expect(arif.can_view_all_customers).toBe(false);
  });

  it('parses and executes password reset (set password of akkas to 654321)', async () => {
    const input = 'set password of akkas to 654321';
    const parsed = parseMessage(input);

    expect(parsed.command).toBe('password');
    expect(parsed.args).toEqual(['akkas', '654321']);

    // Preview
    const previewRes = await executeCommand(parsed.command!, parsed.args, ctxPreview);
    expect(previewRes.needsConfirmation).toBe(true);
    expect(previewRes.reply).not.toContain('654321');

    // Confirm
    const confirmRes = await executeCommand(parsed.command!, parsed.args, ctxConfirm);
    expect(confirmRes.reply).toContain('পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে');
    const akkas = mockUsers.find((u) => u.id === 'user-2');
    expect(akkas.password_hash).toBe('hashed_654321');
  });
});
