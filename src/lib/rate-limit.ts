interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

/**
 * IP rate limiter: 5 attempts per minute window.
 */
export function checkRateLimit(ip: string, limit = 5, windowMs = 60 * 1000): {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
} {
  const now = Date.now();
  const record = memoryStore.get(ip);

  // Periodic cleanup
  if (memoryStore.size > 10000) {
    for (const [key, val] of memoryStore.entries()) {
      if (val.resetAt < now) {
        memoryStore.delete(key);
      }
    }
  }

  if (!record || record.resetAt < now) {
    memoryStore.set(ip, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: limit - 1,
      resetSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (record.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetSeconds: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: limit - record.count,
    resetSeconds: Math.ceil((record.resetAt - now) / 1000),
  };
}

export function resetRateLimit(ip: string): void {
  memoryStore.delete(ip);
}
