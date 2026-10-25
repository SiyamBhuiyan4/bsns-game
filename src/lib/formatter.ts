import { Prisma } from '@prisma/client';

export type DecimalLike = number | Prisma.Decimal | string | { toString(): string };

export interface FormatterOptions {
  digitStyle?: 'bn' | 'en';
  decimals?: number;
}

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

const EN_DIGIT_MAP: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

/**
 * Converts English digits (0-9) to Bengali digits (০-৯).
 */
export function toBengaliDigits(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  return String(val).replace(/[0-9]/g, (d) => BN_DIGITS[parseInt(d, 10)]);
}

/**
 * Converts Bengali digits (০-৯) to English digits (0-9).
 */
export function toEnglishDigits(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  return String(val).replace(/[০-৯]/g, (d) => EN_DIGIT_MAP[d] ?? d);
}

/**
 * Formats a number with Indian/Bangladeshi grouping (e.g. 1,00,000 or ১,০০,০০০)
 * and optional Bengali digit conversion.
 */
export function formatNumber(
  num: DecimalLike | null | undefined,
  options?: FormatterOptions
): string {
  if (num === null || num === undefined || num === '') {
    const zero =
      options?.decimals !== undefined && options.decimals > 0
        ? `0.${'0'.repeat(options.decimals)}`
        : '0';
    return options?.digitStyle === 'bn' ? toBengaliDigits(zero) : zero;
  }

  let str: string;
  if (typeof num === 'number') {
    if (isNaN(num)) return options?.digitStyle === 'bn' ? '০' : '0';
    str = typeof options?.decimals === 'number' ? num.toFixed(options.decimals) : num.toString();
  } else if (typeof num === 'string') {
    const normalized = toEnglishDigits(num.replace(/,/g, '').trim());
    const parsed = Number(normalized);
    if (isNaN(parsed)) return options?.digitStyle === 'bn' ? '০' : '0';
    str = typeof options?.decimals === 'number' ? parsed.toFixed(options.decimals) : normalized;
  } else if (typeof num === 'object' && num !== null && 'toString' in num) {
    const withFixed = num as { toFixed?: (decimals: number) => string };
    if (typeof withFixed.toFixed === 'function' && typeof options?.decimals === 'number') {
      str = withFixed.toFixed(options.decimals);
    } else {
      const normalized = toEnglishDigits(num.toString().replace(/,/g, '').trim());
      const parsed = Number(normalized);
      if (isNaN(parsed)) return options?.digitStyle === 'bn' ? '০' : '0';
      str = typeof options?.decimals === 'number' ? parsed.toFixed(options.decimals) : normalized;
    }
  } else {
    str = '0';
  }

  const isNeg = str.startsWith('-');
  if (isNeg) {
    str = str.slice(1);
  }

  const parts = str.split('.');
  let intPart = parts[0];
  const decPart = parts.length > 1 ? `.${parts[1]}` : '';

  if (intPart.length > 3) {
    const lastThree = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    intPart = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  }

  let result = (isNeg ? '-' : '') + intPart + decPart;
  if (options?.digitStyle === 'bn') {
    result = toBengaliDigits(result);
  }

  return result;
}

/**
 * Formats currency with ৳ symbol and Indian/Bangladeshi grouping (e.g. ৳ 1,00,000 or ৳ ১,০০,০০০).
 */
export function formatCurrency(
  amount: DecimalLike | null | undefined,
  options?: FormatterOptions
): string {
  const formatted = formatNumber(amount, options);
  if (formatted.startsWith('-')) {
    return `-৳ ${formatted.slice(1)}`;
  }
  return `৳ ${formatted}`;
}
