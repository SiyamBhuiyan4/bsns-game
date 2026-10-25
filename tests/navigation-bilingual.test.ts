import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { POST as logoutPost } from '../src/app/api/auth/logout/route';
import { COOKIE_NAME } from '../src/lib/session';
import { formatCurrency, formatNumber } from '../src/lib/formatter';

// Mock next/headers
const mockDeleteCookie = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: mockDeleteCookie,
  })),
}));

describe('Subagent 28: Navigation, Headers & Bilingual Framework Verifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Root Layout & LanguageProvider Tree Wrapping', () => {
    it('should verify that src/app/layout.tsx imports and wraps children in LanguageProvider', () => {
      const layoutPath = path.resolve(process.cwd(), 'src/app/layout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf8');

      // Verify LanguageProvider import
      expect(layoutContent).toMatch(/import\s*\{\s*LanguageProvider\s*\}\s*from\s*['"]@\/components\/LanguageContext['"]/);

      // Verify LanguageProvider wraps children
      expect(layoutContent).toMatch(/<LanguageProvider>[\s\S]*\{children\}[\s\S]*<\/LanguageProvider>/);

      // Verify html tag default lang is "bn"
      expect(layoutContent).toMatch(/<html\s+lang=["']bn["']/);
    });
  });

  describe('2. Logout Button & Session Invalidation', () => {
    it('should call removeSessionCookie which invalidates the auth_token cookie on POST /api/auth/logout', async () => {
      const response = await logoutPost();
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toContain('লগআউট');
      expect(mockDeleteCookie).toHaveBeenCalledWith(COOKIE_NAME);
      expect(COOKIE_NAME).toBe('auth_token');
    });

    it('should verify LogoutButton component uses LanguageContext for dynamic translation', () => {
      const logoutBtnPath = path.resolve(process.cwd(), 'src/components/LogoutButton.tsx');
      const logoutBtnContent = fs.readFileSync(logoutBtnPath, 'utf8');

      // Uses useLanguage hook
      expect(logoutBtnContent).toContain('useLanguage');
      expect(logoutBtnContent).toContain('common.logout');
      // Calls /api/auth/logout with POST
      expect(logoutBtnContent).toMatch(/fetch\(['"]\/api\/auth\/logout['"],\s*\{\s*method:\s*['"]POST['"]\s*\}\)/);
      // Redirects to /login
      expect(logoutBtnContent).toContain('/login');
    });
  });

  describe('3. Bilingual Framework & Translation Dictionary Coverage', () => {
    it('should verify LanguageContext contains complete translations for all admin and employee navigation keys', () => {
      const contextPath = path.resolve(process.cwd(), 'src/components/LanguageContext.tsx');
      const contextContent = fs.readFileSync(contextPath, 'utf8');

      const expectedKeys = [
        'nav.dashboard',
        'nav.sections',
        'nav.upload_history',
        'nav.team',
        'nav.products',
        'nav.campaigns',
        'nav.leads',
        'nav.targets',
        'nav.daily_reports',
        'nav.weekly_reports',
        'nav.monthly_reports',
        'nav.plan_90',
        'nav.audit',
        'nav.settings',
        'nav.my_work',
        'nav.my_leads',
        'nav.daily_entry',
        'nav.performance',
        'nav.leaderboard',
        'common.logout',
        'common.admin_title',
        'common.admin_subtitle',
        'common.employee_title',
        'common.employee_subtitle',
      ];

      for (const key of expectedKeys) {
        expect(contextContent).toContain(`'${key}'`);
      }
    });

    it('should verify formatNumber and formatCurrency dynamically format Bengali (০-৯) vs English (0-9) digits', () => {
      const testVal = 125000.5;

      // English digits
      const enFormattedNum = formatNumber(testVal, { digitStyle: 'en', decimals: 2 });
      expect(enFormattedNum).toBe('1,25,000.50');

      // Bengali digits
      const bnFormattedNum = formatNumber(testVal, { digitStyle: 'bn', decimals: 2 });
      expect(bnFormattedNum).toBe('১,২৫,০০০.৫০');

      // Currency
      const enFormattedMoney = formatCurrency(testVal, { digitStyle: 'en', decimals: 2 });
      expect(enFormattedMoney).toBe('৳ 1,25,000.50');

      const bnFormattedMoney = formatCurrency(testVal, { digitStyle: 'bn', decimals: 2 });
      expect(bnFormattedMoney).toBe('৳ ১,২৫,০০০.৫০');
    });
  });

  describe('4. Navigation & Header Verification', () => {
    it('should verify AdminHeader links cover all 14 core administration modules', () => {
      const headerPath = path.resolve(process.cwd(), 'src/components/AdminHeader.tsx');
      const headerContent = fs.readFileSync(headerPath, 'utf8');

      const adminRoutes = [
        '/admin/dashboard',
        '/admin/sections',
        '/admin/csv/history',
        '/admin/employees',
        '/admin/products',
        '/admin/campaigns',
        '/admin/leads',
        '/admin/targets',
        '/admin/reports/daily',
        '/admin/reports/weekly',
        '/admin/reports/monthly',
        '/admin/plan',
        '/admin/audit',
        '/admin/settings',
      ];

      for (const route of adminRoutes) {
        expect(headerContent).toContain(`'${route}'`);
      }

      // Check LanguageToggle and LogoutButton inclusion
      expect(headerContent).toContain('<LanguageToggle />');
      expect(headerContent).toContain('<LogoutButton />');
      expect(headerContent).toContain('useLanguage');
    });

    it('should verify EmployeeHeader links cover all 6 digital marketer workflows', () => {
      const headerPath = path.resolve(process.cwd(), 'src/components/EmployeeHeader.tsx');
      const headerContent = fs.readFileSync(headerPath, 'utf8');

      const employeeRoutes = [
        '/employee/my-work',
        '/employee/leads',
        '/employee/daily-entry',
        '/employee/performance',
        '/employee/plan',
        '/employee/leaderboard',
      ];

      for (const route of employeeRoutes) {
        expect(headerContent).toContain(`'${route}'`);
      }

      // Check LanguageToggle and LogoutButton inclusion
      expect(headerContent).toContain('<LanguageToggle />');
      expect(headerContent).toContain('<LogoutButton />');
      expect(headerContent).toContain('useLanguage');
    });

    it('should verify LanguageToggle provides options for bn/en and digits bn/en', () => {
      const togglePath = path.resolve(process.cwd(), 'src/components/LanguageToggle.tsx');
      const toggleContent = fs.readFileSync(togglePath, 'utf8');

      expect(toggleContent).toContain("setLang('bn')");
      expect(toggleContent).toContain("setLang('en')");
      expect(toggleContent).toContain("setDigitStyle('bn')");
      expect(toggleContent).toContain("setDigitStyle('en')");
    });
  });
});
