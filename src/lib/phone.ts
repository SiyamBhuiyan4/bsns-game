export function normalizePhone(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s-]/g, '');
  if (cleaned.startsWith('+8801')) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith('8801')) {
    cleaned = cleaned.slice(2);
  }
  return cleaned;
}

/**
 * Validates Bangladeshi mobile numbers.
 * Valid formats: 013XXXXXXXX, 014XXXXXXXX, 015XXXXXXXX, 016XXXXXXXX, 017XXXXXXXX, 018XXXXXXXX, 019XXXXXXXX
 * Exactly 11 digits, starts with 01[3-9].
 */
export function isValidBdPhone(phone: string): boolean {
  if (!phone) return false;
  const normalized = normalizePhone(phone);
  return /^01[3-9]\d{8}$/.test(normalized);
}

/**
 * Masks phone number for privacy in lists:
 * e.g., "01712345678" -> "017XX-XX5678"
 * Specification: "Phone numbers masked in lists (for example 017XX-XX1234). Full number on the lead detail page only"
 */
export function maskPhone(phone: string): string {
  if (!phone) return '';
  const cleaned = normalizePhone(phone);
  if (cleaned.length !== 11) return phone;
  // Format: 017XX-XX5678
  const prefix = cleaned.slice(0, 3);
  const suffix = cleaned.slice(7);
  return `${prefix}XX-XX${suffix}`;
}
