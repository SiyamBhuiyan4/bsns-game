'use client';

import { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLanguage } from '@/components/LanguageContext';
import { installFetchCache } from '@/lib/fetch-cache';

/** Caches the app's `/api` reads in the browser; see `@/lib/fetch-cache`. */
export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const { lang } = useLanguage();
  const [client] = useState(() => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 5 * 60_000 } } });
    // Installed during the first render, before any page's effects run their fetches.
    if (typeof window !== 'undefined') installFetchCache(qc);
    return qc;
  });

  // Server messages follow the chosen language, so a switch starts from a clean cache.
  const firstLang = useRef(lang);
  useEffect(() => {
    if (lang === firstLang.current) return;
    firstLang.current = lang;
    client.removeQueries({ queryKey: ['api'] });
  }, [client, lang]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
