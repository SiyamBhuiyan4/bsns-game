import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

let currentSession: { userId: string; role: string; name: string; email: string } | null = null;

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(async () => currentSession),
}));

const mockAuditLogs: any[] = [];
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(async (data: any) => {
    mockAuditLogs.push(data);
    return { id: 'audit-' + Math.random().toString(36).substring(2), ...data };
  }),
}));

interface MockSection {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface MockGroupLink {
  id: string;
  section_id: string;
  url: string;
  is_active: boolean;
}

let mockSections: MockSection[] = [];
let mockLinks: MockGroupLink[] = [];

vi.mock('@/lib/prisma', () => ({
  default: {
    groupSection: {
      findMany: vi.fn(async () => {
        return mockSections.map((sec) => ({
          ...sec,
          _count: {
            group_links: mockLinks.filter((l) => l.section_id === sec.id).length,
            assignments: 0,
          },
        }));
      }),
      findUnique: vi.fn(async ({ where }: { where: { id?: string; name?: string } }) => {
        if (where.id) {
          const sec = mockSections.find((s) => s.id === where.id);
          if (!sec) return null;
          return {
            ...sec,
            _count: {
              group_links: mockLinks.filter((l) => l.section_id === sec.id).length,
              assignments: 0,
              csv_batches: 0,
            },
          };
        }
        if (where.name) {
          const sec = mockSections.find((s) => s.name.toLowerCase() === where.name?.toLowerCase());
          return sec || null;
        }
        return null;
      }),
      create: vi.fn(async ({ data }: { data: any }) => {
        const newSec: MockSection = {
          id: 'sec-' + Math.random().toString(36).substring(2, 8),
          name: data.name,
          description: data.description || null,
          is_active: data.is_active ?? true,
          created_at: new Date(),
          updated_at: new Date(),
        };
        mockSections.push(newSec);
        return newSec;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
        const idx = mockSections.findIndex((s) => s.id === where.id);
        if (idx === -1) throw new Error('Section not found');
        mockSections[idx] = {
          ...mockSections[idx],
          ...data,
          updated_at: new Date(),
        };
        return mockSections[idx];
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const idx = mockSections.findIndex((s) => s.id === where.id);
        if (idx === -1) throw new Error('Section not found');
        const deleted = mockSections[idx];
        mockSections.splice(idx, 1);
        return deleted;
      }),
    },
    groupLink: {
      groupBy: vi.fn(async ({ where }: { where?: { is_active?: boolean } }) => {
        const counts: Record<string, number> = {};
        mockLinks
          .filter((l) => where?.is_active === undefined || l.is_active === where.is_active)
          .forEach((l) => {
            counts[l.section_id] = (counts[l.section_id] || 0) + 1;
          });
        return Object.entries(counts).map(([section_id, count]) => ({
          section_id,
          _count: { id: count },
        }));
      }),
      count: vi.fn(async ({ where }: { where: { section_id: string; is_active?: boolean } }) => {
        return mockLinks.filter(
          (l) =>
            l.section_id === where.section_id &&
            (where.is_active === undefined || l.is_active === where.is_active)
        ).length;
      }),
    },
  },
}));

import { GET as getSections, POST as createSection } from '@/app/api/admin/sections/route';
import {
  GET as getSectionById,
  PUT as updateSection,
  DELETE as deleteSection,
} from '@/app/api/admin/sections/[id]/route';

describe('Sections Management API Verification', () => {
  beforeEach(() => {
    currentSession = {
      userId: 'admin-1',
      role: 'ADMIN',
      name: 'System Admin',
      email: 'admin@example.com',
    };
    mockAuditLogs.length = 0;
    mockSections = [
      {
        id: 'sec-1',
        name: 'Agro Groups',
        description: 'Agricultural marketing groups',
        is_active: true,
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01'),
      },
      {
        id: 'sec-2',
        name: 'Tech Groups',
        description: 'Technology discussion groups',
        is_active: false,
        created_at: new Date('2026-01-02'),
        updated_at: new Date('2026-01-02'),
      },
    ];
    mockLinks = [
      { id: 'link-1', section_id: 'sec-1', url: 'https://facebook.com/groups/agro1', is_active: true },
      { id: 'link-2', section_id: 'sec-1', url: 'https://facebook.com/groups/agro2', is_active: false },
    ];
    vi.clearAllMocks();
  });

  describe('1. Section Listing & Access Control', () => {
    it('should reject unauthorized access (no session)', async () => {
      currentSession = null;
      const res = await getSections();
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('should reject non-admin access (EMPLOYEE)', async () => {
      currentSession = {
        userId: 'emp-1',
        role: 'EMPLOYEE',
        name: 'Marketer',
        email: 'marketer@example.com',
      };
      const res = await getSections();
      expect(res.status).toBe(403);
    });

    it('should list sections with active and total link counts for admin', async () => {
      const res = await getSections();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sections).toHaveLength(2);

      const agro = data.sections.find((s: any) => s.id === 'sec-1');
      expect(agro).toBeDefined();
      expect(agro.name).toBe('Agro Groups');
      expect(agro.total_links).toBe(2);
      expect(agro.active_links).toBe(1);
      expect(agro.is_active).toBe(true);

      const tech = data.sections.find((s: any) => s.id === 'sec-2');
      expect(tech).toBeDefined();
      expect(tech.total_links).toBe(0);
      expect(tech.active_links).toBe(0);
      expect(tech.is_active).toBe(false);
    });
  });

  describe('2. Section Creation & Validation', () => {
    it('should reject section creation with name shorter than 2 characters', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/sections', {
        method: 'POST',
        body: JSON.stringify({ name: 'A' }),
      });
      const res = await createSection(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('কমপক্ষে ২ অক্ষরের');
    });

    it('should reject whitespace-only section name', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/sections', {
        method: 'POST',
        body: JSON.stringify({ name: '    ' }),
      });
      const res = await createSection(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('কমপক্ষে ২ অক্ষরের');
    });

    it('should reject duplicate section name', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/sections', {
        method: 'POST',
        body: JSON.stringify({ name: 'Agro Groups' }),
      });
      const res = await createSection(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('ইতিমধ্যে বিদ্যমান');
    });

    it('should create valid section with active status and record audit log', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/sections', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Fashion Groups',
          description: 'Fashion & apparel marketing',
          is_active: true,
        }),
      });
      const res = await createSection(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.section.name).toBe('Fashion Groups');
      expect(data.section.is_active).toBe(true);

      // Verify audit log for CREATE
      expect(mockAuditLogs).toHaveLength(1);
      expect(mockAuditLogs[0]).toMatchObject({
        actorId: 'admin-1',
        action: 'CREATE',
        entity: 'GroupSection',
        entityId: data.section.id,
        payload: {
          name: 'Fashion Groups',
          is_active: true,
        },
      });
    });

    it('should allow creating section with is_active = false', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/sections', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Draft Section',
          is_active: false,
        }),
      });
      const res = await createSection(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.section.is_active).toBe(false);
    });
  });

  describe('3. Active Toggle & Section Update', () => {
    it('should toggle active status from true to false and write audit log', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/sections/sec-1', {
        method: 'PUT',
        body: JSON.stringify({ is_active: false }),
      });
      const res = await updateSection(req, { params: Promise.resolve({ id: 'sec-1' }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.section.is_active).toBe(false);

      // Check audit log for UPDATE
      expect(mockAuditLogs).toHaveLength(1);
      expect(mockAuditLogs[0]).toMatchObject({
        actorId: 'admin-1',
        action: 'UPDATE',
        entity: 'GroupSection',
        entityId: 'sec-1',
        payload: {
          old: { name: 'Agro Groups', is_active: true },
          new: { name: 'Agro Groups', is_active: false },
        },
      });
    });

    it('should toggle active status from false to true', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/sections/sec-2', {
        method: 'PUT',
        body: JSON.stringify({ is_active: true }),
      });
      const res = await updateSection(req, { params: Promise.resolve({ id: 'sec-2' }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.section.is_active).toBe(true);
    });

    it('should validate name length during update', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/sections/sec-1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'X' }),
      });
      const res = await updateSection(req, { params: Promise.resolve({ id: 'sec-1' }) });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('কমপক্ষে ২ অক্ষরের');
    });
  });

  describe('4. Deletion Guard & Audit Logging', () => {
    it('should prevent deletion of a section that contains active links', async () => {
      // sec-1 has 1 active link and 1 inactive link
      const req = new NextRequest('http://localhost:3000/api/admin/sections/sec-1', {
        method: 'DELETE',
      });
      const res = await deleteSection(req, { params: Promise.resolve({ id: 'sec-1' }) });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/সক্রিয় লিংক|লিংক আছে/);
      expect(data.error).toContain('delete করা যাবে না');

      // Verify no audit log was created
      expect(mockAuditLogs).toHaveLength(0);
      // Verify section was NOT deleted
      expect(mockSections.some((s) => s.id === 'sec-1')).toBe(true);
    });

    it('should prevent deletion of a section that contains any links (even if inactive)', async () => {
      // Deactivate all links in sec-1
      mockLinks = mockLinks.map((l) => ({ ...l, is_active: false }));

      const req = new NextRequest('http://localhost:3000/api/admin/sections/sec-1', {
        method: 'DELETE',
      });
      const res = await deleteSection(req, { params: Promise.resolve({ id: 'sec-1' }) });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('delete করা যাবে না');
      expect(mockSections.some((s) => s.id === 'sec-1')).toBe(true);
    });

    it('should allow deletion of a section with zero links and create DELETE audit log', async () => {
      // sec-2 has 0 links
      const req = new NextRequest('http://localhost:3000/api/admin/sections/sec-2', {
        method: 'DELETE',
      });
      const res = await deleteSection(req, { params: Promise.resolve({ id: 'sec-2' }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(mockSections.some((s) => s.id === 'sec-2')).toBe(false);

      // Check DELETE audit log
      expect(mockAuditLogs).toHaveLength(1);
      expect(mockAuditLogs[0]).toMatchObject({
        actorId: 'admin-1',
        action: 'DELETE',
        entity: 'GroupSection',
        entityId: 'sec-2',
        payload: {
          name: 'Tech Groups',
        },
      });
    });
  });
});
