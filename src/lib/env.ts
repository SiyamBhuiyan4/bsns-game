/**
 * Secrets, resolved once and loudly.
 *
 * These used to fall back to literals that live in the repository, which means a
 * deploy with the variable missing would happily sign tokens anyone could forge.
 * In production a missing or weak secret is now a hard failure; in development a
 * fixed value is fine, and we say so.
 */

const isProd = process.env.NODE_ENV === 'production';

const DEV_JWT_SECRET = 'dev-only-jwt-secret-not-for-production-use-0123456789';
const DEV_CRON_SECRET = 'dev-only-cron-secret';

const MIN_SECRET_LENGTH = 32;

function readSecret(name: string, devFallback: string, minLength = MIN_SECRET_LENGTH): string {
  const value = process.env[name];

  if (!value || value.trim().length === 0) {
    if (isProd) {
      throw new Error(
        `${name} is not set. Set it in the deployment environment; the app refuses to run without it.`
      );
    }
    return devFallback;
  }

  const trimmed = value.trim();
  if (isProd && trimmed.length < minLength) {
    throw new Error(`${name} must be at least ${minLength} characters long.`);
  }
  if (isProd && (trimmed === devFallback || trimmed.startsWith('dev-only-'))) {
    throw new Error(`${name} is still set to a development placeholder.`);
  }
  return trimmed;
}

export function getJwtSecret(): string {
  return readSecret('JWT_SECRET', DEV_JWT_SECRET);
}

export function getCronSecret(): string {
  return readSecret('CRON_SECRET', DEV_CRON_SECRET, 16);
}

/** Encoded once per module that signs or verifies tokens. */
export function getJwtKey(): Uint8Array {
  return new TextEncoder().encode(getJwtSecret());
}
