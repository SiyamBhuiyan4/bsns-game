import type { NextRequest } from 'next/server';
import { COOKIE_LANG_KEY } from './cookies';
import type { Lang } from './translate';

/**
 * The language this request should be answered in.
 *
 * Reads the request's own cookies rather than next/headers, so route handlers
 * that are called directly (tests, cron) still work instead of throwing.
 */
export function readLangFromRequest(req: NextRequest): Lang {
  try {
    return req.cookies.get(COOKIE_LANG_KEY)?.value === 'en' ? 'en' : 'bn';
  } catch {
    return 'bn';
  }
}
