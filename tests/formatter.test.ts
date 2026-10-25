import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  formatCurrency,
  formatNumber,
  toBengaliDigits,
  toEnglishDigits,
} from '@/lib/formatter';

describe('Number and Currency Formatter (Section 1, 8.10, 10)', () => {
  describe('toBengaliDigits', () => {
    it('converts English digits to Bengali digits', () => {
      expect(toBengaliDigits('0123456789')).toBe('০১২৩৪৫৬৭৮৯');
      expect(toBengaliDigits(12345)).toBe('১২৩৪৫');
      expect(toBengaliDigits(0)).toBe('০');
    });

    it('preserves non-digit characters', () => {
      expect(toBengaliDigits('৳ 1,00,000')).toBe('৳ ১,০০,০০০');
      expect(toBengaliDigits('Target: 50% on 2026-10-25')).toBe('Target: ৫০% on ২০২৬-১০-২৫');
      expect(toBengaliDigits('+8801712345678')).toBe('+৮৮০১৭১২৩৪৫৬৭৮');
    });

    it('handles null and undefined gracefully', () => {
      expect(toBengaliDigits(null)).toBe('');
      expect(toBengaliDigits(undefined)).toBe('');
      expect(toBengaliDigits('')).toBe('');
    });
  });

  describe('toEnglishDigits', () => {
    it('converts Bengali digits to English digits', () => {
      expect(toEnglishDigits('০১২৩৪৫৬৭৮৯')).toBe('0123456789');
      expect(toEnglishDigits('১২৩৪৫')).toBe('12345');
      expect(toEnglishDigits('০')).toBe('0');
    });

    it('preserves non-digit characters', () => {
      expect(toEnglishDigits('৳ ১,০০,০০০')).toBe('৳ 1,00,000');
      expect(toEnglishDigits('+৮৮০১৭১২৩৪৫৬৭৮')).toBe('+8801712345678');
    });

    it('handles null and undefined gracefully', () => {
      expect(toEnglishDigits(null)).toBe('');
      expect(toEnglishDigits(undefined)).toBe('');
      expect(toEnglishDigits('')).toBe('');
    });
  });

  describe('Digit Roundtrips', () => {
    it('roundtrips English -> Bengali -> English', () => {
      const enSample = '0123456789';
      expect(toEnglishDigits(toBengaliDigits(enSample))).toBe(enSample);

      const complex = '৳ 1,00,000 (Date: 2026-10-25)';
      expect(toEnglishDigits(toBengaliDigits(complex))).toBe(complex);
    });

    it('roundtrips Bengali -> English -> Bengali', () => {
      const bnSample = '০১২৩৪৫৬৭৮৯';
      expect(toBengaliDigits(toEnglishDigits(bnSample))).toBe(bnSample);

      const complexBn = '৳ ১,০০,০০০ (তারিখ: ২০২৬-১০-২৫)';
      expect(toBengaliDigits(toEnglishDigits(complexBn))).toBe(complexBn);
    });
  });

  describe('formatNumber - Indian/Bangladeshi Grouping', () => {
    it('formats numbers less than 1,000 without commas', () => {
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(5)).toBe('5');
      expect(formatNumber(99)).toBe('99');
      expect(formatNumber(999)).toBe('999');
    });

    it('formats thousands, lakhs, and crores correctly in English digits', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(10000)).toBe('10,000');
      expect(formatNumber(100000)).toBe('1,00,000'); // 1 Lakh
      expect(formatNumber(1000000)).toBe('10,00,000'); // 10 Lakh
      expect(formatNumber(10000000)).toBe('1,00,00,000'); // 1 Crore
      expect(formatNumber(100000000)).toBe('10,00,00,000'); // 10 Crore
      expect(formatNumber(123456789)).toBe('12,34,56,789');
    });

    it('formats Indian/Bangladeshi grouping with Bengali digits when digitStyle is bn', () => {
      expect(formatNumber(1000, { digitStyle: 'bn' })).toBe('১,০০০');
      expect(formatNumber(10000, { digitStyle: 'bn' })).toBe('১০,০০০');
      expect(formatNumber(100000, { digitStyle: 'bn' })).toBe('১,০০,০০০'); // ১ লাখ
      expect(formatNumber(1000000, { digitStyle: 'bn' })).toBe('১০,০০,০০০'); // ১০ লাখ
      expect(formatNumber(10000000, { digitStyle: 'bn' })).toBe('১,০০,০০,০০০'); // ১ কোটি
      expect(formatNumber(123456789, { digitStyle: 'bn' })).toBe('১২,৩৪,৫৬,৭৮৯');
    });

    it('handles negative numbers correctly', () => {
      expect(formatNumber(-100000)).toBe('-1,00,000');
      expect(formatNumber(-100000, { digitStyle: 'bn' })).toBe('-১,০০,০০০');
    });

    it('handles decimal values and explicit decimal places', () => {
      expect(formatNumber(12345.67)).toBe('12,345.67');
      expect(formatNumber(12345.67, { digitStyle: 'bn' })).toBe('১২,৩৪৫.৬৭');
      expect(formatNumber(100000, { decimals: 2 })).toBe('1,00,000.00');
      expect(formatNumber(100000, { digitStyle: 'bn', decimals: 2 })).toBe('১,০০,০০০.০০');
    });

    it('accepts Prisma.Decimal instances', () => {
      const dec = new Prisma.Decimal('100000.50');
      expect(formatNumber(dec)).toBe('1,00,000.5');
      expect(formatNumber(dec, { decimals: 2 })).toBe('1,00,000.50');
      expect(formatNumber(dec, { digitStyle: 'bn' })).toBe('১,০০,০০০.৫');
      expect(formatNumber(dec, { digitStyle: 'bn', decimals: 2 })).toBe('১,০০,০০০.৫০');
    });

    it('accepts string numbers and Bengali digit strings', () => {
      expect(formatNumber('100000')).toBe('1,00,000');
      expect(formatNumber('১০০০০০')).toBe('1,00,000');
      expect(formatNumber('১০০০০০', { digitStyle: 'bn' })).toBe('১,০০,০০০');
    });
  });

  describe('formatCurrency', () => {
    it('formats with ৳ symbol and Bangladeshi grouping', () => {
      expect(formatCurrency(100000)).toBe('৳ 1,00,000');
      expect(formatCurrency(10000000)).toBe('৳ 1,00,00,000');
      expect(formatCurrency(0)).toBe('৳ 0');
    });

    it('formats with ৳ symbol and Bengali digits when digitStyle is bn', () => {
      expect(formatCurrency(100000, { digitStyle: 'bn' })).toBe('৳ ১,০০,০০০');
      expect(formatCurrency(10000000, { digitStyle: 'bn' })).toBe('৳ ১,০০,০০,০০০');
      expect(formatCurrency(0, { digitStyle: 'bn' })).toBe('৳ ০');
    });

    it('formats negative currency with minus prefix', () => {
      expect(formatCurrency(-100000)).toBe('-৳ 1,00,000');
      expect(formatCurrency(-100000, { digitStyle: 'bn' })).toBe('-৳ ১,০০,০০০');
    });

    it('formats Prisma.Decimal currency values', () => {
      const dec = new Prisma.Decimal('250000');
      expect(formatCurrency(dec)).toBe('৳ 2,50,000');
      expect(formatCurrency(dec, { digitStyle: 'bn' })).toBe('৳ ২,৫০,০০০');
    });
  });
});
