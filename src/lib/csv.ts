import Papa from 'papaparse';

export interface CsvRowParsed {
  rowNumber: number;
  url: string;
  title?: string;
  status: 'VALID' | 'DUPLICATE_IN_FILE' | 'DUPLICATE_IN_SECTION' | 'EXISTS_IN_OTHER_SECTION' | 'INVALID';
  reason?: string;
  warning?: string;
  isSanitized?: boolean;
}

export interface CsvValidationResult {
  totalRows: number;
  validCount: number;
  duplicateCount: number;
  invalidCount: number;
  warningCount: number;
  rows: CsvRowParsed[];
  validRowsToInsert: Array<{ url: string; title?: string }>;
  invalidRowsForDownload: Array<{ rowNumber: number; url: string; title?: string; reason: string }>;
}

/**
 * Escapes characters that can lead to CSV formula injection.
 * If a cell starts with =, +, -, @, prefix it with a single quote '.
 */
export function sanitizeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.length === 0) return '';

  if (['=', '+', '-', '@', '\t', '\r'].includes(str[0])) {
    return `'${str}`;
  }

  const trimmed = str.trim();
  if (trimmed.length > 0 && ['=', '+', '-', '@'].includes(trimmed[0])) {
    return `'${trimmed}`;
  }
  return trimmed;
}

/**
 * Normalizes URL:
 * - Trims whitespace
 * - Standardizes protocol (http/https)
 * - Converts mobile Facebook URLs (m.facebook.com) to www.facebook.com
 * - Removes tracking parameters (utm_*, fbclid, ref, etc.)
 * - Strips trailing slashes
 */
export function normalizeUrl(inputUrl: string): string {
  if (!inputUrl) return '';
  const urlStr = inputUrl.trim();

  // If no protocol, don't assume, let URL parser validate
  try {
    const parsed = new URL(urlStr);
    
    // Normalize mobile facebook to standard facebook
    if (parsed.hostname === 'm.facebook.com' || parsed.hostname === 'mobile.facebook.com') {
      parsed.hostname = 'www.facebook.com';
    }

    // Remove tracking parameters
    const paramsToDelete: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      const lower = key.toLowerCase();
      if (
        lower.startsWith('utm_') ||
        lower === 'fbclid' ||
        lower === 'ref' ||
        lower === 'ref_src' ||
        lower === 'ref_url' ||
        lower === 'source'
      ) {
        paramsToDelete.push(key);
      }
    });

    paramsToDelete.forEach((key) => parsed.searchParams.delete(key));

    // Remove empty search query
    let result = parsed.toString();
    if (result.endsWith('?')) {
      result = result.slice(0, -1);
    }

    // Remove trailing slash if path is not just "/"
    if (parsed.pathname.length > 1 && result.endsWith('/')) {
      result = result.slice(0, -1);
    }

    return result;
  } catch {
    // If invalid URL, return trimmed string for the validator to reject
    return urlStr.replace(/\/+$/, '');
  }
}

/**
 * Validates if the string is a valid HTTP/HTTPS URL.
 */
export function isValidHttpUrl(stringUrl: string): boolean {
  try {
    const parsed = new URL(stringUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Parses and validates CSV content for Group Links import.
 */
export function parseAndValidateCsv(
  csvContent: string,
  existingSectionUrls: Set<string> = new Set(),
  existingOtherSectionUrls: Set<string> = new Set()
): CsvValidationResult {
  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const rows: CsvRowParsed[] = [];
  const validRowsToInsert: Array<{ url: string; title?: string }> = [];
  const invalidRowsForDownload: Array<{ rowNumber: number; url: string; title?: string; reason: string }> = [];

  const seenInFile = new Set<string>();

  let validCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;
  let warningCount = 0;

  parsed.data.forEach((row, index) => {
    const rowNumber = index + 2; // header is row 1
    const rawUrl = (row['url'] || row['link'] || '').trim();
    const rawTitle = (row['title'] || row['name'] || '').trim();

    // Check if empty row
    if (!rawUrl && !rawTitle) {
      return;
    }

    // Formula injection sanitization
    const sanitizedTitle = sanitizeCsvCell(rawTitle);
    const normalized = normalizeUrl(rawUrl);

    // 1. URL validity check
    if (!normalized || !isValidHttpUrl(normalized)) {
      invalidCount++;
      const reason = !normalized ? 'URL অনুপস্থিত (Missing URL)' : 'অবৈধ URL ফর্ম্যাট (Invalid HTTP/HTTPS URL)';
      rows.push({
        rowNumber,
        url: rawUrl,
        title: sanitizedTitle,
        status: 'INVALID',
        reason,
      });
      invalidRowsForDownload.push({
        rowNumber,
        url: rawUrl,
        title: sanitizedTitle,
        reason,
      });
      return;
    }

    const normalizedLower = normalized.toLowerCase();

    // 2. Duplicate inside the same file
    if (seenInFile.has(normalizedLower)) {
      duplicateCount++;
      rows.push({
        rowNumber,
        url: normalized,
        title: sanitizedTitle,
        status: 'DUPLICATE_IN_FILE',
        reason: 'ফাইলে একাধিকবার বিদ্যমান (Duplicate in CSV file)',
      });
      return;
    }
    seenInFile.add(normalizedLower);

    // 3. Duplicate inside the same section
    if (existingSectionUrls.has(normalizedLower)) {
      duplicateCount++;
      rows.push({
        rowNumber,
        url: normalized,
        title: sanitizedTitle,
        status: 'DUPLICATE_IN_SECTION',
        reason: 'এই সেকশনে ইতিমধ্যে যুক্ত আছে (Already exists in this section)',
      });
      return;
    }

    // 4. Duplicate in another section (Allowed, but warn)
    let warning: string | undefined = undefined;
    if (existingOtherSectionUrls.has(normalizedLower)) {
      warningCount++;
      warning = 'অন্য সেকশনে বিদ্যমান (Also exists in another section)';
    }

    // Valid row to insert
    validCount++;
    rows.push({
      rowNumber,
      url: normalized,
      title: sanitizedTitle,
      status: warning ? 'EXISTS_IN_OTHER_SECTION' : 'VALID',
      warning,
    });

    validRowsToInsert.push({
      url: normalized,
      title: sanitizedTitle || undefined,
    });
  });

  return {
    totalRows: rows.length,
    validCount,
    duplicateCount,
    invalidCount,
    warningCount,
    rows,
    validRowsToInsert,
    invalidRowsForDownload,
  };
}

/**
 * Generates CSV content from invalid rows for user download.
 */
export function exportInvalidRowsToCsv(
  invalidRows: Array<{ rowNumber: number; url: string; title?: string; reason: string }>
): string {
  return Papa.unparse(
    invalidRows.map((r) => ({
      'Row Number': r.rowNumber,
      'URL': sanitizeCsvCell(r.url),
      'Title': sanitizeCsvCell(r.title || ''),
      'Error Reason': sanitizeCsvCell(r.reason),
    }))
  );
}
