'use client';

import { useCallback, useEffect, useState } from 'react';
import { GraduationCap, Trash2, Loader2, Plus, ArrowRight, MessageSquareText } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { useLanguage } from '@/components/LanguageContext';
import { SkeletonTable } from '@/components/ui/Skeleton';

type Phrase = { id: string; phrase: string; href: string; label: string };
type Page = { id: string; href: string; labelBn: string; labelEn: string };

export default function TeachAssistantPage() {
  const { t } = useLanguage();
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
    <div className="space-y-6">
      <PageHeader
        icon={<GraduationCap className="h-5 w-5" />}
        title={t('assistant.title', 'সহকারীকে শেখান', 'Teach assistant')}
        subtitle={t('assistant.subtitle', 'কোন বাক্য লিখলে কোন পেজ খুলবে, তা ঠিক করুন।', 'Choose which page opens when you type a phrase.')}
      />

      <form onSubmit={add} className="card">
        <div className="card-body space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="teach-phrase" className="label">
                {t('assistant.phrase', 'যখন আমি লিখব', 'When I type')}
              </label>
              <input
                id="teach-phrase"
                required
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder={t('assistant.phrasePh', 'যেমন: গ্রুপের হিসাব', 'e.g. group report')}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="teach-page" className="label">
                {t('assistant.page', 'এই পেজ খুলবে', 'Open this page')}
              </label>
              <select
                id="teach-page"
                value={intentId}
                onChange={(e) => setIntentId(e.target.value)}
                className="input"
              >
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.labelBn} / {p.labelEn}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t('assistant.teach', 'শেখান', 'Teach')}
            </button>
          </div>
        </div>
      </form>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">{t('assistant.list', 'শেখানো বাক্য', 'Taught phrases')}</h2>
          </div>
          <span className="badge badge-gray">{phrases.length}</span>
        </div>
        {loading ? (
          <SkeletonTable rows={4} cols={3} label={t('common.loading', 'লোড হচ্ছে…', 'Loading…')} />
        ) : phrases.length === 0 ? (
          <EmptyState
            icon={<MessageSquareText className="h-5 w-5" />}
            title={t('assistant.empty', 'এখনো কিছু শেখানো হয়নি', 'Nothing taught yet')}
            description={t('assistant.emptyDesc', 'উপরের ফর্মে একটি বাক্য ও পেজ যোগ করুন।', 'Add a phrase and a page using the form above.')}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {phrases.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-slate-900">“{p.phrase}”</p>
                  <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-slate-500">
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {p.label} <span className="font-mono text-slate-400">{p.href}</span>
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => remove(p.id)}
                  className="btn-icon shrink-0 hover:bg-rose-50 hover:text-rose-600"
                  aria-label={t('assistant.delete', 'বাক্য মুছুন', 'Delete phrase')}
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
