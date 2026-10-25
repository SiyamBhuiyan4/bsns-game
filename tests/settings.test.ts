import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import prisma from '../src/lib/prisma';
import { hashPassword } from '../src/lib/auth';
import { UserRole, AuditAction } from '@prisma/client';
import { NextRequest } from 'next/server';

// Mock session user
const mockSessionUser = {
  id: '',
  userId: '',
  name: '',
  email: '',
  role: 'ADMIN' as 'ADMIN' | 'EMPLOYEE',
};

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(async () => {
    if (!mockSessionUser.userId) return null;
    return { ...mockSessionUser };
  }),
  requireAuth: vi.fn(async () => {
    if (!mockSessionUser.userId) throw new Error('UNAUTHORIZED');
    return { ...mockSessionUser };
  }),
  requireAdmin: vi.fn(async () => {
    if (!mockSessionUser.userId) throw new Error('UNAUTHORIZED');
    if (mockSessionUser.role !== 'ADMIN') throw new Error('FORBIDDEN');
    return { ...mockSessionUser };
  }),
  requireEmployee: vi.fn(async () => {
    if (!mockSessionUser.userId) throw new Error('UNAUTHORIZED');
    if (mockSessionUser.role !== 'EMPLOYEE') throw new Error('FORBIDDEN');
    return { ...mockSessionUser };
  }),
}));

// Import route handlers and schemas
import {
  GET as getSettings,
  PUT as putSettings,
  PATCH as patchSettings,
} from '../src/app/api/admin/settings/route';
import {
  sectionWeightsSchema,
  updateSettingsSchema,
} from '../src/lib/settings';

describe('Settings Module Tests (Section 8.10)', () => {
  let adminUser: any;
  let employeeUser: any;
  let originalSettings: any;

  beforeAll(async () => {
    const passwordHash = '$2a$12$e80yq9N0k8l8M9v5.XmYmOG6rM9V6Y.N.O1J2K3L4M5N6O7P8Q9R';

    adminUser = await prisma.user.create({
      data: {
        name: 'Settings Admin',
        email: `settings_admin_${Date.now()}@example.com`,
        password_hash: passwordHash,
        role: UserRole.ADMIN,
      },
    });

    employeeUser = await prisma.user.create({
      data: {
        name: 'Settings Employee',
        email: `settings_emp_${Date.now()}@example.com`,
        password_hash: passwordHash,
        role: UserRole.EMPLOYEE,
      },
    });

    // Save existing settings so we can restore them in afterAll
    originalSettings = await prisma.scoringSettings.findUnique({
      where: { id: 'default' },
    });
  });

  afterAll(async () => {
    // Restore original settings
    if (originalSettings) {
      await prisma.scoringSettings.upsert({
        where: { id: 'default' },
        create: {
          id: 'default',
          section_weights: originalSettings.section_weights,
          achievement_cap: originalSettings.achievement_cap,
          failing_threshold: originalSettings.failing_threshold,
          undo_enabled: originalSettings.undo_enabled,
          employee_edit_window_days: originalSettings.employee_edit_window_days,
          weekly_report_day: originalSettings.weekly_report_day,
          weekly_report_time: originalSettings.weekly_report_time,
          language_default: originalSettings.language_default,
          digit_style: originalSettings.digit_style,
        },
        update: {
          section_weights: originalSettings.section_weights,
          achievement_cap: originalSettings.achievement_cap,
          failing_threshold: originalSettings.failing_threshold,
          undo_enabled: originalSettings.undo_enabled,
          employee_edit_window_days: originalSettings.employee_edit_window_days,
          weekly_report_day: originalSettings.weekly_report_day,
          weekly_report_time: originalSettings.weekly_report_time,
          language_default: originalSettings.language_default,
          digit_style: originalSettings.digit_style,
        },
      });
    }

    // Clean up test audit logs and users
    if (adminUser) {
      await prisma.auditLog.deleteMany({
        where: { actor_id: adminUser.id },
      });
      await prisma.user.delete({ where: { id: adminUser.id } }).catch(() => {});
    }

    if (employeeUser) {
      await prisma.user.delete({ where: { id: employeeUser.id } }).catch(() => {});
    }
  });

  // ==========================================
  // 1. ZOD VALIDATION UNIT TESTS
  // ==========================================
  describe('Zod Validation Rules', () => {
    it('should validate section_weights when sum is exactly 100 and all 5 keys are present', () => {
      const validWeights = {
        SALES_PROFIT: 30,
        CONTENT: 20,
        NEW_BUYERS_B2B: 20,
        RETENTION: 15,
        INBOX_FOLLOWUP: 15,
      };

      const result = sectionWeightsSchema.safeParse(validWeights);
      expect(result.success).toBe(true);
    });

    it('should reject section_weights if the sum is not 100', () => {
      const underWeights = {
        SALES_PROFIT: 30,
        CONTENT: 20,
        NEW_BUYERS_B2B: 20,
        RETENTION: 15,
        INBOX_FOLLOWUP: 10, // Sum = 95
      };
      const resultUnder = sectionWeightsSchema.safeParse(underWeights);
      expect(resultUnder.success).toBe(false);

      const overWeights = {
        SALES_PROFIT: 35,
        CONTENT: 20,
        NEW_BUYERS_B2B: 20,
        RETENTION: 15,
        INBOX_FOLLOWUP: 15, // Sum = 105
      };
      const resultOver = sectionWeightsSchema.safeParse(overWeights);
      expect(resultOver.success).toBe(false);
    });

    it('should reject section_weights if any required section key is missing', () => {
      const missingKey = {
        SALES_PROFIT: 50,
        CONTENT: 50,
      };
      const result = sectionWeightsSchema.safeParse(missingKey);
      expect(result.success).toBe(false);
    });

    it('should reject section_weights if any value is negative', () => {
      const negativeWeight = {
        SALES_PROFIT: 110,
        CONTENT: -10,
        NEW_BUYERS_B2B: 0,
        RETENTION: 0,
        INBOX_FOLLOWUP: 0,
      };
      const result = sectionWeightsSchema.safeParse(negativeWeight);
      expect(result.success).toBe(false);
    });

    it('should validate achievement_cap > 0 and reject <= 0', () => {
      expect(updateSettingsSchema.safeParse({ achievement_cap: 1.0 }).success).toBe(true);
      expect(updateSettingsSchema.safeParse({ achievement_cap: 1.2 }).success).toBe(true);
      expect(updateSettingsSchema.safeParse({ achievement_cap: 999 }).success).toBe(true);

      expect(updateSettingsSchema.safeParse({ achievement_cap: 0 }).success).toBe(false);
      expect(updateSettingsSchema.safeParse({ achievement_cap: -0.5 }).success).toBe(false);
      expect(updateSettingsSchema.safeParse({ achievement_cap: -100 }).success).toBe(false);
    });

    it('should validate failing_threshold between 0 and 1, and reject out-of-range', () => {
      expect(updateSettingsSchema.safeParse({ failing_threshold: 0.8 }).success).toBe(true);
      expect(updateSettingsSchema.safeParse({ failing_threshold: 0 }).success).toBe(true);
      expect(updateSettingsSchema.safeParse({ failing_threshold: 1 }).success).toBe(true);

      expect(updateSettingsSchema.safeParse({ failing_threshold: -0.1 }).success).toBe(false);
      expect(updateSettingsSchema.safeParse({ failing_threshold: 1.01 }).success).toBe(false);
      expect(updateSettingsSchema.safeParse({ failing_threshold: 80 }).success).toBe(false);
    });

    it('should validate employee_edit_window_days as >= 0 integer and reject invalid', () => {
      expect(updateSettingsSchema.safeParse({ employee_edit_window_days: 0 }).success).toBe(true);
      expect(updateSettingsSchema.safeParse({ employee_edit_window_days: 1 }).success).toBe(true);
      expect(updateSettingsSchema.safeParse({ employee_edit_window_days: 7 }).success).toBe(true);

      expect(updateSettingsSchema.safeParse({ employee_edit_window_days: -1 }).success).toBe(false);
      expect(updateSettingsSchema.safeParse({ employee_edit_window_days: 1.5 }).success).toBe(false);
    });
  });

  // ==========================================
  // 2. AUTHORIZATION & ACCESS CONTROL
  // ==========================================
  describe('Authorization & Access Control', () => {
    it('should reject unauthenticated requests to GET /api/admin/settings with 403', async () => {
      mockSessionUser.userId = '';
      mockSessionUser.id = '';

      const res = await getSettings();
      expect(res.status).toBe(403);
    });

    it('should reject non-admin (EMPLOYEE) requests to GET /api/admin/settings with 403', async () => {
      mockSessionUser.userId = employeeUser.id;
      mockSessionUser.id = employeeUser.id;
      mockSessionUser.name = employeeUser.name;
      mockSessionUser.email = employeeUser.email;
      mockSessionUser.role = 'EMPLOYEE';

      const res = await getSettings();
      expect(res.status).toBe(403);
    });

    it('should reject non-admin requests to PUT /api/admin/settings with 403', async () => {
      mockSessionUser.userId = employeeUser.id;
      mockSessionUser.id = employeeUser.id;
      mockSessionUser.name = employeeUser.name;
      mockSessionUser.email = employeeUser.email;
      mockSessionUser.role = 'EMPLOYEE';

      const req = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ undo_enabled: false }),
      });

      const res = await putSettings(req);
      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // 3. API GET ENDPOINT
  // ==========================================
  describe('GET /api/admin/settings', () => {
    it('should return scoring settings for authenticated admin', async () => {
      mockSessionUser.userId = adminUser.id;
      mockSessionUser.id = adminUser.id;
      mockSessionUser.name = adminUser.name;
      mockSessionUser.email = adminUser.email;
      mockSessionUser.role = 'ADMIN';

      const res = await getSettings();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.settings).toBeDefined();
      expect(json.settings.id).toBe('default');
      expect(json.settings.section_weights).toBeDefined();
      expect(typeof json.settings.achievement_cap).toBe('number');
      expect(typeof json.settings.failing_threshold).toBe('number');
      expect(typeof json.settings.undo_enabled).toBe('boolean');
      expect(typeof json.settings.employee_edit_window_days).toBe('number');
    });
  });

  // ==========================================
  // 4. API PERSISTENCE & AUDIT LOGGING
  // ==========================================
  describe('PUT / PATCH /api/admin/settings Persistence & Audit Logging', () => {
    it('should reject invalid section_weights (sum != 100) with 400', async () => {
      mockSessionUser.userId = adminUser.id;
      mockSessionUser.id = adminUser.id;
      mockSessionUser.name = adminUser.name;
      mockSessionUser.email = adminUser.email;
      mockSessionUser.role = 'ADMIN';

      const invalidPayload = {
        section_weights: {
          SALES_PROFIT: 20,
          CONTENT: 20,
          NEW_BUYERS_B2B: 20,
          RETENTION: 20,
          INBOX_FOLLOWUP: 10, // Sum = 90
        },
      };

      const req = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(invalidPayload),
      });

      const res = await putSettings(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it('should reject invalid achievement_cap <= 0 with 400', async () => {
      mockSessionUser.userId = adminUser.id;
      mockSessionUser.id = adminUser.id;
      mockSessionUser.name = adminUser.name;
      mockSessionUser.email = adminUser.email;
      mockSessionUser.role = 'ADMIN';

      const req = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ achievement_cap: -1 }),
      });

      const res = await putSettings(req);
      expect(res.status).toBe(400);
    });

    it('should persist valid settings updates in database and record audit log', async () => {
      mockSessionUser.userId = adminUser.id;
      mockSessionUser.id = adminUser.id;
      mockSessionUser.name = adminUser.name;
      mockSessionUser.email = adminUser.email;
      mockSessionUser.role = 'ADMIN';

      const updatePayload = {
        section_weights: {
          SALES_PROFIT: 25,
          CONTENT: 25,
          NEW_BUYERS_B2B: 20,
          RETENTION: 15,
          INBOX_FOLLOWUP: 15,
        },
        achievement_cap: 1.2,
        failing_threshold: 0.75,
        undo_enabled: false,
        employee_edit_window_days: 3,
        weekly_report_day: 'MONDAY',
        weekly_report_time: '10:30',
        language_default: 'en',
        digit_style: 'en',
      };

      const req = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(updatePayload),
      });

      const res = await putSettings(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.settings).toBeDefined();
      expect(json.settings.achievement_cap).toBe(1.2);
      expect(json.settings.failing_threshold).toBe(0.75);
      expect(json.settings.undo_enabled).toBe(false);
      expect(json.settings.employee_edit_window_days).toBe(3);
      expect(json.settings.weekly_report_day).toBe('MONDAY');
      expect(json.settings.weekly_report_time).toBe('10:30');
      expect(json.settings.language_default).toBe('en');
      expect(json.settings.digit_style).toBe('en');

      // Verify direct database persistence
      const dbSettings = await prisma.scoringSettings.findUnique({
        where: { id: 'default' },
      });

      expect(dbSettings).toBeDefined();
      expect(Number(dbSettings?.achievement_cap)).toBe(1.2);
      expect(Number(dbSettings?.failing_threshold)).toBe(0.75);
      expect(dbSettings?.undo_enabled).toBe(false);
      expect(dbSettings?.employee_edit_window_days).toBe(3);
      expect(dbSettings?.weekly_report_day).toBe('MONDAY');
      expect(dbSettings?.weekly_report_time).toBe('10:30');
      expect(dbSettings?.language_default).toBe('en');
      expect(dbSettings?.digit_style).toBe('en');
      expect(dbSettings?.section_weights).toEqual(updatePayload.section_weights);

      // Verify AuditLog creation
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          actor_id: adminUser.id,
          entity: 'ScoringSettings',
          action: AuditAction.UPDATE,
        },
        orderBy: { created_at: 'desc' },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.action).toBe('UPDATE');
      expect(auditLog?.entity).toBe('ScoringSettings');
      expect(auditLog?.entity_id).toBe('default');

      const payload = auditLog?.payload as any;
      expect(payload).toBeDefined();
      expect(payload.old).toBeDefined();
      expect(payload.new).toBeDefined();
      expect(payload.new.achievement_cap).toBe(1.2);
      expect(payload.new.failing_threshold).toBe(0.75);
      expect(payload.new.undo_enabled).toBe(false);
      expect(payload.new.employee_edit_window_days).toBe(3);
    });

    it('should support No Cap (999) achievement cap persistence via PATCH', async () => {
      mockSessionUser.userId = adminUser.id;
      mockSessionUser.id = adminUser.id;
      mockSessionUser.name = adminUser.name;
      mockSessionUser.email = adminUser.email;
      mockSessionUser.role = 'ADMIN';

      const patchPayload = {
        achievement_cap: 999,
      };

      const req = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(patchPayload),
      });

      const res = await patchSettings(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.settings.achievement_cap).toBe(999);

      // Check DB
      const dbSettings = await prisma.scoringSettings.findUnique({
        where: { id: 'default' },
      });
      expect(Number(dbSettings?.achievement_cap)).toBe(999);
    });
  });
});
