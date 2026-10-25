import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock session
let currentSession: { userId: string; role: string; name: string; email: string } | null = {
  userId: 'emp-123',
  role: 'EMPLOYEE',
  name: 'Test Marketer',
  email: 'marketer@example.com',
};

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(async () => currentSession),
}));

// Mock Audit Log
const mockAuditLogs: any[] = [];
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(async (data: any) => {
    mockAuditLogs.push(data);
    return { id: 'audit-' + Date.now(), ...data };
  }),
}));

// Mock Prisma
const mockAssignments = [
  {
    id: 'assign-1',
    employee_id: 'emp-123',
    section_id: 'sec-agro',
    section: { id: 'sec-agro', name: 'Agro Groups', is_active: true },
  },
];

const mockLinks = [
  {
    id: 'link-1',
    section_id: 'sec-agro',
    url: 'https://facebook.com/groups/agro1',
    title: 'Agro Group 1',
    is_active: true,
    section: {
      id: 'sec-agro',
      name: 'Agro Groups',
      is_active: true,
      assignments: [{ id: 'assign-1', employee_id: 'emp-123' }],
    },
  },
  {
    id: 'link-2',
    section_id: 'sec-restaurant',
    url: 'https://facebook.com/groups/restaurant1',
    title: 'Restaurant Group 1',
    is_active: true,
    section: {
      id: 'sec-restaurant',
      name: 'Restaurant Groups',
      is_active: true,
      assignments: [], // Not assigned to emp-123
    },
  },
  {
    id: 'link-inactive',
    section_id: 'sec-agro',
    url: 'https://facebook.com/groups/agro-inactive',
    title: 'Inactive Agro Group',
    is_active: false,
    section: {
      id: 'sec-agro',
      name: 'Agro Groups',
      is_active: true,
      assignments: [{ id: 'assign-1', employee_id: 'emp-123' }],
    },
  },
];

let mockCompletions: any[] = [];
let mockScoringSettings: any = {
  id: 'default',
  undo_enabled: true,
};

vi.mock('@/lib/prisma', () => ({
  default: {
    assignment: {
      findMany: vi.fn(async ({ where }: any) => {
        return mockAssignments.filter((a) => a.employee_id === where.employee_id);
      }),
    },
    groupLink: {
      findMany: vi.fn(async ({ where }: any) => {
        return mockLinks.filter((l) => {
          if (where.section_id?.in && !where.section_id.in.includes(l.section_id)) return false;
          if (where.is_active !== undefined && l.is_active !== where.is_active) return false;
          return true;
        });
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        return mockLinks.find((l) => l.id === where.id) || null;
      }),
    },
    linkCompletion: {
      findMany: vi.fn(async ({ where }: any) => {
        return mockCompletions.filter((c) => {
          if (where.employee_id && c.employee_id !== where.employee_id) return false;
          if (where.undone_at === null && c.undone_at !== null) return false;
          return true;
        });
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        const matches = mockCompletions.filter((c) => {
          if (where.group_link_id && c.group_link_id !== where.group_link_id) return false;
          if (where.employee_id && c.employee_id !== where.employee_id) return false;
          if (where.undone_at === null && c.undone_at !== null) return false;
          if (where.undone_at && where.undone_at.not === null && c.undone_at === null) return false;
          return true;
        });
        return matches[0] || null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const item = {
          id: 'comp-' + (mockCompletions.length + 1),
          ...data,
          completed_at: data.completed_at || new Date(),
          undone_at: data.undone_at || null,
        };
        mockCompletions.push(item);
        return item;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const item = mockCompletions.find((c) => c.id === where.id);
        if (item) {
          Object.assign(item, data);
        }
        return item;
      }),
    },
    scoringSettings: {
      findUnique: vi.fn(async () => mockScoringSettings),
    },
  },
}));

// Import Handlers
import { GET as getWorkQueue } from '../src/app/api/employee/work/route';
import { POST as markLinkDone } from '../src/app/api/employee/work/[linkId]/done/route';
import { POST as undoLink } from '../src/app/api/employee/work/[linkId]/undo/route';
import { POST as markLinkCompleteAlias } from '../src/app/api/employee/work/[linkId]/complete/route';
import { GET as getLinksAlias } from '../src/app/api/employee/links/route';
import { GET as getTasksAlias } from '../src/app/api/employee/tasks/route';

describe('Employee Task Queue & One-Click Complete / Undo Engine', () => {
  beforeEach(() => {
    mockCompletions = [];
    mockAuditLogs.length = 0;
    mockScoringSettings = { id: 'default', undo_enabled: true };
    currentSession = {
      userId: 'emp-123',
      role: 'EMPLOYEE',
      name: 'Test Marketer',
      email: 'marketer@example.com',
    };
  });

  describe('1. Section Isolation (Marketer only sees assigned section links)', () => {
    it('returns only links belonging to the assigned section', async () => {
      const req = new NextRequest('http://localhost:3000/api/employee/work');
      const res = await getWorkQueue(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.todoLinks.length).toBe(1);
      expect(data.todoLinks[0].id).toBe('link-1');
      expect(data.todoLinks[0].section_id).toBe('sec-agro');

      // Unassigned 'sec-restaurant' link is NEVER returned
      const hasRestaurant = data.todoLinks.some((l: any) => l.section_id === 'sec-restaurant');
      expect(hasRestaurant).toBe(false);
    });

    it('rejects attempt to filter by unassigned section, falling back to assigned sections', async () => {
      const req = new NextRequest('http://localhost:3000/api/employee/work?sectionId=sec-restaurant');
      const res = await getWorkQueue(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      // Still only returns assigned agro links
      expect(data.todoLinks.every((l: any) => l.section_id === 'sec-agro')).toBe(true);
    });

    it('denies mark done if employee is not assigned to the link section (403 Forbidden)', async () => {
      const req = new NextRequest('http://localhost:3000/api/employee/work/link-2/done', { method: 'POST' });
      const res = await markLinkDone(req, { params: Promise.resolve({ linkId: 'link-2' }) });
      expect(res.status).toBe(403);
    });

    it('returns 404 if link does not exist', async () => {
      const req = new NextRequest('http://localhost:3000/api/employee/work/non-existent/done', { method: 'POST' });
      const res = await markLinkDone(req, { params: Promise.resolve({ linkId: 'non-existent' }) });
      expect(res.status).toBe(404);
    });

    it('denies mark done if link is inactive (403 Forbidden)', async () => {
      const req = new NextRequest('http://localhost:3000/api/employee/work/link-inactive/done', { method: 'POST' });
      const res = await markLinkDone(req, { params: Promise.resolve({ linkId: 'link-inactive' }) });
      expect(res.status).toBe(403);
    });
  });

  describe('2. One-Click Complete & Duplicate Click Handling', () => {
    it('marks task done and creates LinkCompletion record', async () => {
      const req = new NextRequest('http://localhost:3000/api/employee/work/link-1/done', { method: 'POST' });
      const res = await markLinkDone(req, { params: Promise.resolve({ linkId: 'link-1' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.alreadyDone).toBe(false);
      expect(data.completionId).toBeDefined();

      expect(mockCompletions.length).toBe(1);
      expect(mockCompletions[0].group_link_id).toBe('link-1');
      expect(mockCompletions[0].employee_id).toBe('emp-123');
      expect(mockCompletions[0].undone_at).toBeNull();
    });

    it('handles duplicate clicks gracefully without error and without duplicate records', async () => {
      // First click
      const req1 = new NextRequest('http://localhost:3000/api/employee/work/link-1/done', { method: 'POST' });
      const res1 = await markLinkDone(req1, { params: Promise.resolve({ linkId: 'link-1' }) });
      const data1 = await res1.json();
      expect(res1.status).toBe(200);

      // Second duplicate click
      const req2 = new NextRequest('http://localhost:3000/api/employee/work/link-1/done', { method: 'POST' });
      const res2 = await markLinkDone(req2, { params: Promise.resolve({ linkId: 'link-1' }) });
      const data2 = await res2.json();

      expect(res2.status).toBe(200);
      expect(data2.success).toBe(true);
      expect(data2.alreadyDone).toBe(true);
      expect(data2.completionId).toBe(data1.completionId);

      // Still only 1 record created
      expect(mockCompletions.length).toBe(1);
    });

    it('also functions correctly via alias /complete', async () => {
      const req = new NextRequest('http://localhost:3000/api/employee/work/link-1/complete', { method: 'POST' });
      const res = await markLinkCompleteAlias(req, { params: Promise.resolve({ linkId: 'link-1' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('3. Undo Link Completion & Settings Enforcement', () => {
    it('successfully undos completion when undo is enabled and creates audit log', async () => {
      // 1. Mark done first
      mockCompletions.push({
        id: 'comp-100',
        group_link_id: 'link-1',
        employee_id: 'emp-123',
        completed_at: new Date(),
        undone_at: null,
      });

      // 2. Undo
      const req = new NextRequest('http://localhost:3000/api/employee/work/link-1/undo', { method: 'POST' });
      const res = await undoLink(req, { params: Promise.resolve({ linkId: 'link-1' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockCompletions[0].undone_at).not.toBeNull();

      // Check audit log
      expect(mockAuditLogs.length).toBe(1);
      expect(mockAuditLogs[0].action).toBe('UNDO');
      expect(mockAuditLogs[0].actorId).toBe('emp-123');
      expect(mockAuditLogs[0].entity).toBe('LinkCompletion');
    });

    it('blocks undo when undo_enabled is false in ScoringSettings (403 Forbidden)', async () => {
      mockScoringSettings.undo_enabled = false;
      mockCompletions.push({
        id: 'comp-100',
        group_link_id: 'link-1',
        employee_id: 'emp-123',
        completed_at: new Date(),
        undone_at: null,
      });

      const req = new NextRequest('http://localhost:3000/api/employee/work/link-1/undo', { method: 'POST' });
      const res = await undoLink(req, { params: Promise.resolve({ linkId: 'link-1' }) });

      expect(res.status).toBe(403);
      expect(mockCompletions[0].undone_at).toBeNull(); // remains not undone
    });

    it('handles duplicate undo clicks gracefully', async () => {
      mockCompletions.push({
        id: 'comp-100',
        group_link_id: 'link-1',
        employee_id: 'emp-123',
        completed_at: new Date(),
        undone_at: new Date(), // Already undone
      });

      const req = new NextRequest('http://localhost:3000/api/employee/work/link-1/undo', { method: 'POST' });
      const res = await undoLink(req, { params: Promise.resolve({ linkId: 'link-1' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.alreadyUndone).toBe(true);
    });
  });

  describe('4. Route Aliases /api/employee/links and /api/employee/tasks', () => {
    it('resolves GET /api/employee/links to work queue', async () => {
      const req = new NextRequest('http://localhost:3000/api/employee/links');
      const res = await getLinksAlias(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.assignedSections).toBeDefined();
      expect(data.todoLinks).toBeDefined();
    });

    it('resolves GET /api/employee/tasks to work queue', async () => {
      const req = new NextRequest('http://localhost:3000/api/employee/tasks');
      const res = await getTasksAlias(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.assignedSections).toBeDefined();
      expect(data.todoLinks).toBeDefined();
    });
  });
});
