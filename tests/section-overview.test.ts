import { describe, it, expect } from 'vitest';
import { getAdminDashboardData, SectionOverviewKey } from '../src/lib/dashboard';

describe('Section Overview Analytics & Deep-Dive Data', () => {
  it('should return sectionsOverview with 5 core sections and groupSectionsOverview', async () => {
    const data = await getAdminDashboardData({ period: 'thisMonth' });

    expect(data).toHaveProperty('sectionsOverview');
    expect(data).toHaveProperty('groupSectionsOverview');
    expect(Array.isArray(data.sectionsOverview)).toBe(true);
    expect(Array.isArray(data.groupSectionsOverview)).toBe(true);

    // Verify 5 core sections are present
    const expectedKeys: SectionOverviewKey[] = [
      'POSTS_DONE',
      'ORDERS_CONFIRMED',
      'MESSAGES_REPLIED',
      'LEADS_COLLECTED',
      'SALES_AMOUNT',
    ];

    const presentKeys = data.sectionsOverview.map((s) => s.key);
    for (const key of expectedKeys) {
      expect(presentKeys).toContain(key);
    }

    // Verify structure of each SectionOverviewItem
    for (const sec of data.sectionsOverview) {
      expect(sec).toHaveProperty('key');
      expect(sec).toHaveProperty('labelBn');
      expect(sec).toHaveProperty('labelEn');
      expect(sec).toHaveProperty('unitBn');
      expect(sec).toHaveProperty('unitEn');
      expect(typeof sec.totalAchieved).toBe('number');
      expect(typeof sec.totalTarget).toBe('number');
      expect(typeof sec.activeEmployeesCount).toBe('number');
      expect(Array.isArray(sec.employeeBreakdown)).toBe(true);
      expect(Array.isArray(sec.historyLogs)).toBe(true);

      // Verify employee breakdown format if any
      for (const emp of sec.employeeBreakdown) {
        expect(emp).toHaveProperty('employeeId');
        expect(emp).toHaveProperty('name');
        expect(typeof emp.total).toBe('number');
        expect(typeof emp.target).toBe('number');
        expect(typeof emp.percentage).toBe('number');
      }

      // Verify history logs format if any
      for (const log of sec.historyLogs) {
        expect(log).toHaveProperty('date');
        expect(log).toHaveProperty('employeeId');
        expect(log).toHaveProperty('employeeName');
        expect(typeof log.value).toBe('number');
      }
    }

    // Verify groupSectionsOverview structure
    for (const groupSec of data.groupSectionsOverview) {
      expect(groupSec).toHaveProperty('id');
      expect(groupSec).toHaveProperty('name');
      expect(typeof groupSec.totalLinks).toBe('number');
      expect(typeof groupSec.completedLinksCount).toBe('number');
      expect(Array.isArray(groupSec.completionsHistory)).toBe(true);

      for (const item of groupSec.completionsHistory) {
        expect(item).toHaveProperty('date');
        expect(item).toHaveProperty('employeeName');
        expect(item).toHaveProperty('employeeId');
        expect(item).toHaveProperty('linkUrl');
      }
    }
  });

  it('should support sectionKey filtering in getAdminDashboardData', async () => {
    const data = await getAdminDashboardData({
      period: 'thisMonth',
      sectionKey: 'ORDERS_CONFIRMED',
    });

    expect(data.sectionsOverview.length).toBe(1);
    expect(data.sectionsOverview[0].key).toBe('ORDERS_CONFIRMED');
  });
});
