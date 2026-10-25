'use client';

import { useCallback, useEffect, useState } from 'react';
import { GraduationCap, Trash2, Loader2, Plus } from 'lucide-react';

type Phrase = { id: string; phrase: string; href: string; label: string };
type Page = { id: string; href: string; labelBn: string; labelEn: string };

export default function TeachAssistantPage() {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [phrase, setPhrase] = useState('');
  const [intentId, setIntentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/agent/phrases');
      const data = await res.json();
      setPhrases(data.phrases ?? []);
      setPages(data.pages ?? []);
      setIntentId((current) => current || data.pages?.[0]?.id || '');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/admin/agent/phrases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phrase, intentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not save');
        return;
      }
      setPhrase('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await fetch(`/api/admin/agent/phrases?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await load();
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-slate-900">
          <GraduationCap className="h-6 w-6 text-emerald-600" />
          সহকারীকে শেখান
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Teach the assistant: when you type this phrase, it opens this page.
        </p>
      </div>

      <form onSubmit={add} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">যখন আমি লিখব / When I type</span>
            <input
              required
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="যেমন: গ্রুপের হিসাব"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">এই পেজ খুলবে / Open this page</span>
            <select
              value={intentId}
              onChange={(e) => setIntentId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
            >
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.labelBn} / {p.labelEn}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="text-sm text-rose-700">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          শেখান / Teach
        </button>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">
          শেখানো বাক্য / Taught phrases ({phrases.length})
        </div>
        {loading ? (
          <div className="p-4 text-sm text-slate-500">লোড হচ্ছে… / Loading…</div>
        ) : phrases.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">এখনো কিছু শেখানো হয়নি। / Nothing taught yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {phrases.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 break-words">“{p.phrase}”</p>
                  <p className="text-xs text-slate-500">→ {p.label} ({p.href})</p>
                </div>
                <button
                  onClick={() => remove(p.id)}
                  className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Delete phrase"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
