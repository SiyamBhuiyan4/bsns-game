import type { QueryClient } from '@tanstack/react-query';

/**
 * Client-side cache for the app's own `/api` reads, backed by TanStack Query.
 *
 * Pages fetch their data with plain `fetch` on mount. This provider puts a thin
 * layer under `fetch` so that:
 *
 * - coming back to a section within a minute shows its last data instantly
 *   instead of waiting on the server again;
 * - identical requests in flight at the same time share one network call;
 * - a second read on the same visit (a refresh button, a re-fetch after a filter)
 *   always goes to the network, so nothing on screen is older than you expect;
 * - any write (POST, PUT, PATCH, DELETE) clears the whole cache, so you never see
 *   data from before your own change.
 *
 * Only successful JSON responses are cached; everything else passes through.
 */

const FRESH_MS = 60_000;

type Cached = { body: string; contentType: string; visit: number };

class Passthrough {
  constructor(readonly res: Response) {}
}

let visit = 0;
let lastPath = '';
/** Changes every time the URL path changes, i.e. once per page visit. */
function currentVisit(): number {
  if (window.location.pathname !== lastPath) {
    lastPath = window.location.pathname;
    visit++;
  }
  return visit;
}

function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  return (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
}

function urlOf(input: RequestInfo | URL): URL {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return new URL(raw, window.location.href);
}

let installed = false;

export function installFetchCache(client: QueryClient): void {
  if (installed) return;
  installed = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = urlOf(input);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
      return nativeFetch(input, init);
    }
    if (methodOf(input, init) !== 'GET') {
      const res = await nativeFetch(input, init);
      client.removeQueries({ queryKey: ['api'] });
      return res;
    }
    if (input instanceof Request || init?.cache === 'no-store') return nativeFetch(input, init);

    const key = ['api', url.pathname + url.search];
    const thisVisit = currentVisit();
    const cached = client.getQueryData<Cached>(key);
    // Re-use only data loaded on an earlier visit; a repeat read on this visit is a refresh.
    const reuse = cached !== undefined && cached.visit !== thisVisit;

    try {
      const data = await client.fetchQuery<Cached>({
        queryKey: key,
        staleTime: reuse ? FRESH_MS : 0,
        queryFn: async () => {
          const res = await nativeFetch(input, init);
          const contentType = res.headers.get('content-type') ?? '';
          if (res.status !== 200 || !contentType.includes('application/json')) throw new Passthrough(res);
          return { body: await res.text(), contentType, visit: thisVisit };
        },
      });
      return new Response(data.body, { status: 200, headers: { 'content-type': data.contentType } });
    } catch (err) {
      if (err instanceof Passthrough) {
        client.removeQueries({ queryKey: key, exact: true });
        return err.res.clone();
      }
      throw err;
    }
  };
}
