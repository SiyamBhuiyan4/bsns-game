import { describe, it, expect, beforeEach } from 'vitest';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../src/lib/auth';
import { checkRateLimit, resetRateLimit } from '../src/lib/rate-limit';

describe('Authentication & Security Unit Tests (Step 1)', () => {
  describe('Password Hashing & Verification (Bcrypt Cost 12)', () => {
    it('should hash password and verify valid password', async () => {
      const rawPassword = 'SecretPassword123!';
      const hash = await hashPassword(rawPassword);

      expect(hash).toBeDefined();
      expect(hash).not.toEqual(rawPassword);
      // Bcrypt hash starts with $2a$ or $2b$ and cost 12
      expect(hash).toMatch(/^\$2[ab]\$12\$/);

      const isValid = await verifyPassword(rawPassword, hash);
      expect(isValid).toBe(true);
    }, 30000);

    it('should reject incorrect password', async () => {
      const rawPassword = 'CorrectPassword123!';
      const wrongPassword = 'WrongPassword456!';
      const hash = await hashPassword(rawPassword);

      const isValid = await verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    }, 60000);
  });

  describe('JWT Session Tokens (Jose HS256)', () => {
    it('should sign and verify valid session payload', async () => {
      const userPayload = {
        userId: 'user-uuid-1234',
        name: 'হেড অব মার্কেটিং',
        email: 'admin@example.com',
        role: 'ADMIN' as const,
        phone: '01700000000',
      };

      const token = await signToken(userPayload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const verified = await verifyToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.userId).toEqual(userPayload.userId);
      expect(verified?.email).toEqual(userPayload.email);
      expect(verified?.role).toEqual('ADMIN');
    });

    it('should return null for tampered token', async () => {
      const userPayload = {
        userId: 'user-uuid-9999',
        name: 'মার্কেটার',
        email: 'employee@example.com',
        role: 'EMPLOYEE' as const,
      };

      const token = await signToken(userPayload);
      const tamperedToken = token.slice(0, -6) + 'abcdef';

      const verified = await verifyToken(tamperedToken);
      expect(verified).toBeNull();
    });
  });

  describe('Login Rate Limiter (5 attempts per minute per IP)', () => {
    const testIp = '192.168.1.100';

    beforeEach(() => {
      resetRateLimit(testIp);
    });

    it('should allow up to 5 attempts within 1 minute window', () => {
      for (let i = 1; i <= 5; i++) {
        const res = checkRateLimit(testIp, 5, 60000);
        expect(res.allowed).toBe(true);
        expect(res.remaining).toBe(5 - i);
      }
    });

    it('should block the 6th attempt with remaining = 0 and allowed = false', () => {
      for (let i = 1; i <= 5; i++) {
        checkRateLimit(testIp, 5, 60000);
      }

      const blockedRes = checkRateLimit(testIp, 5, 60000);
      expect(blockedRes.allowed).toBe(false);
      expect(blockedRes.remaining).toBe(0);
      expect(blockedRes.resetSeconds).toBeGreaterThan(0);
    });

    it('should reset rate limit after resetRateLimit is called', () => {
      for (let i = 1; i <= 5; i++) {
        checkRateLimit(testIp, 5, 60000);
      }
      expect(checkRateLimit(testIp, 5, 60000).allowed).toBe(false);

      resetRateLimit(testIp);

      const freshRes = checkRateLimit(testIp, 5, 60000);
      expect(freshRes.allowed).toBe(true);
      expect(freshRes.remaining).toBe(4);
    });
  });
});
