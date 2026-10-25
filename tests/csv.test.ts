import { describe, it, expect } from 'vitest';
import {
  normalizeUrl,
  isValidHttpUrl,
  sanitizeCsvCell,
  parseAndValidateCsv,
} from '../src/lib/csv';

describe('CSV Parser & Validator Unit Tests (Deliverable 5)', () => {
  describe('URL Normalization & Validation', () => {
    it('should strip trailing slash and tracking query params', () => {
      const input = 'https://www.facebook.com/groups/agrobd/?utm_source=fb&utm_medium=cpc&fbclid=12345';
      const normalized = normalizeUrl(input);
      expect(normalized).toBe('https://www.facebook.com/groups/agrobd');
    });

    it('should normalize mobile Facebook URLs to standard www.facebook.com', () => {
      const input = 'https://m.facebook.com/groups/restaurantdhaka/';
      const normalized = normalizeUrl(input);
      expect(normalized).toBe('https://www.facebook.com/groups/restaurantdhaka');
    });

    it('should validate valid HTTP/HTTPS URLs', () => {
      expect(isValidHttpUrl('https://facebook.com/groups/test')).toBe(true);
      expect(isValidHttpUrl('http://myagrigroup.com')).toBe(true);
      expect(isValidHttpUrl('ftp://facebook.com')).toBe(false);
      expect(isValidHttpUrl('not-a-url')).toBe(false);
      expect(isValidHttpUrl('javascript:alert(1)')).toBe(false);
    });
  });

  describe('CSV Formula Injection Prevention', () => {
    it('should escape cells starting with =, +, -, @ with a single quote', () => {
      expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(sanitizeCsvCell('+12345678')).toBe("'+12345678");
      expect(sanitizeCsvCell('-5000')).toBe("'-5000");
      expect(sanitizeCsvCell('@cmd|/c calc')).toBe("'@cmd|/c calc");
    });

    it('should not alter normal text', () => {
      expect(sanitizeCsvCell('Agro Farmers Bangladesh')).toBe('Agro Farmers Bangladesh');
      expect(sanitizeCsvCell('মাশরুম চাষি')).toBe('মাশরুম চাষি');
    });
  });

  describe('CSV Parsing & Duplicate Handling', () => {
    it('should parse valid CSV rows accurately', () => {
      const csv = `url,title
https://www.facebook.com/groups/agro1,Agro Farmers BD
https://www.facebook.com/groups/agro2,Organic Mushroom
https://www.facebook.com/groups/agro3,Ganoderma BD`;

      const result = parseAndValidateCsv(csv);
      expect(result.totalRows).toBe(3);
      expect(result.validCount).toBe(3);
      expect(result.duplicateCount).toBe(0);
      expect(result.invalidCount).toBe(0);
      expect(result.validRowsToInsert.length).toBe(3);
    });

    it('should detect duplicate inside the same CSV file', () => {
      const csv = `url,title
https://www.facebook.com/groups/dup1,Group One
https://www.facebook.com/groups/dup1,Duplicate Group One
https://www.facebook.com/groups/valid2,Valid Group`;

      const result = parseAndValidateCsv(csv);
      expect(result.totalRows).toBe(3);
      expect(result.validCount).toBe(2);
      expect(result.duplicateCount).toBe(1);
      expect(result.rows[1].status).toBe('DUPLICATE_IN_FILE');
    });

    it('should detect duplicate already existing in the same section', () => {
      const csv = `url,title
https://www.facebook.com/groups/existing1,Existing Group
https://www.facebook.com/groups/new2,Brand New Group`;

      const existingSectionUrls = new Set(['https://www.facebook.com/groups/existing1']);
      const result = parseAndValidateCsv(csv, existingSectionUrls);

      expect(result.totalRows).toBe(2);
      expect(result.validCount).toBe(1);
      expect(result.duplicateCount).toBe(1);
      expect(result.rows[0].status).toBe('DUPLICATE_IN_SECTION');
    });

    it('should allow URL existing in another section but flag a warning', () => {
      const csv = `url,title
https://www.facebook.com/groups/shared1,Shared Group`;

      const existingOtherSectionUrls = new Set(['https://www.facebook.com/groups/shared1']);
      const result = parseAndValidateCsv(csv, new Set(), existingOtherSectionUrls);

      expect(result.totalRows).toBe(1);
      expect(result.validCount).toBe(1);
      expect(result.warningCount).toBe(1);
      expect(result.rows[0].status).toBe('EXISTS_IN_OTHER_SECTION');
      expect(result.rows[0].warning).toBeDefined();
    });

    it('should reject invalid URLs and capture reason', () => {
      const csv = `url,title
not-a-valid-link,Bad Link
https://valid.com/group,Good Link
ftp://invalid-protocol.com,Bad Protocol`;

      const result = parseAndValidateCsv(csv);
      expect(result.totalRows).toBe(3);
      expect(result.validCount).toBe(1);
      expect(result.invalidCount).toBe(2);
      expect(result.invalidRowsForDownload.length).toBe(2);
    });

    it('should ignore empty rows and trim spaces', () => {
      const csv = `url,title
   
https://www.facebook.com/groups/space-test   ,   Spaced Title   
   ,   
`;

      const result = parseAndValidateCsv(csv);
      expect(result.totalRows).toBe(1);
      expect(result.validCount).toBe(1);
      expect(result.validRowsToInsert[0].url).toBe('https://www.facebook.com/groups/space-test');
      expect(result.validRowsToInsert[0].title).toBe('Spaced Title');
    });

    it('should process a 1,000 row batch efficiently', () => {
      const rows = ['url,title'];
      for (let i = 1; i <= 1000; i++) {
        rows.push(`https://www.facebook.com/groups/group-${i},Batch Group ${i}`);
      }
      const csvContent = rows.join('\n');

      const start = Date.now();
      const result = parseAndValidateCsv(csvContent);
      const duration = Date.now() - start;

      expect(result.totalRows).toBe(1000);
      expect(result.validCount).toBe(1000);
      expect(duration).toBeLessThan(1000); // must process within 1 second
    });
  });
});
