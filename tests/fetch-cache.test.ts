import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

describe('client fetch cache', () => {
  it('re-uses data on a later visit, refetches on the same visit, and clears on writes', async () => {
    const location = { href: 'https://app.test/admin/leads', origin: 'https://app.test', pathname: '/admin/leads' };
    let n = 0;
    const network = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      if (String(_input).includes('missing')) return new Response('{"error":"x"}', { status: 404, headers: { 'content-type': 'application/json' } });
      n++;
      return new Response(JSON.stringify({ n }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    (globalThis as any).window = { fetch: network, location };

    const { installFetchCache } = await import('@/lib/fetch-cache');
    installFetchCache(new QueryClient({ defaultOptions: { queries: { retry: false } } }));
    const get = async (url: string) => (await (window as any).fetch(url)).json();
    const go = (path: string) => {
      location.pathname = path;
      location.href = 'https://app.test' + path;
    };

    expect(await get('/api/leads')).toEqual({ n: 1 });
    // Same visit: a refresh goes to the network.
    expect(await get('/api/leads')).toEqual({ n: 2 });

    go('/admin/targets');
    await get('/api/targets');
    go('/admin/leads');
    // Back on leads: served from cache, no network call.
    const calls = network.mock.calls.length;
    expect(await get('/api/leads')).toEqual({ n: 2 });
    expect(network.mock.calls.length).toBe(calls);

    // A write clears the cache.
    await (window as any).fetch('/api/leads', { method: 'POST', body: '{}' });
    go('/admin/targets');
    go('/admin/leads');
    expect((await get('/api/leads')).n).toBeGreaterThan(2);

    // Errors pass through untouched.
    const res = await (window as any).fetch('/api/missing');
    expect(res.status).toBe(404);

    // Other origins are never touched.
    await (window as any).fetch('https://other.test/api/x');
    expect(network).toHaveBeenLastCalledWith('https://other.test/api/x', undefined);
  });
});
