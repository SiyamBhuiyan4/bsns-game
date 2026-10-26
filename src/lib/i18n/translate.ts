import { EN } from './en';

export type Lang = 'bn' | 'en';

/** Unicode-normalised + whitespace-collapsed form, so lookups survive copy/paste variants. */
function norm(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}

const exact = new Map<string, string>();
/** Entries with {0}/{1} placeholders, compiled so a finished string still matches. */
const patterns: { re: RegExp; en: string; slots: number }[] = [];

for (const [bn, en] of Object.entries(EN)) {
  const key = norm(bn);
  exact.set(key, en);
  if (key.includes('{0}')) {
    const parts = key.split(/\{(\d+)\}/);
    let source = '';
    let slots = 0;
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) source += parts[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      else {
        source += '([\\s\\S]*?)';
        slots++;
      }
    }
    patterns.push({ re: new RegExp('^' + source + '$'), en, slots });
  }
}
// Longer templates first: the most specific pattern should win.
patterns.sort((a, b) => b.re.source.length - a.re.source.length);

const trailing = /[\s:·•]+$/;

/**
 * Bangla text -> the current language.
 *
 * Returns `text` unchanged for Bangla, and for English falls back to the Bangla
 * when nothing is known for it, so a missing entry degrades instead of blanking.
 */
export function translate(text: string | null | undefined, lang: Lang): string {
  if (!text) return text ?? '';
  if (lang !== 'en') return text;

  const key = norm(text);
  const hit = exact.get(key);
  if (hit !== undefined) return hit;

  // "Bangla (English)" / "Bangla / English" written inline in the source.
  const paren = key.match(/^(.*?[ঀ-৿].*?)\s*\(([^()]*[A-Za-z][^()]*)\)$/);
  if (paren && !/[ঀ-৿]/.test(paren[2])) return paren[2].trim();
  const slash = key.match(/^(.+?)\s*\/\s*([^/]*[A-Za-z][^/]*)$/);
  if (slash && !/[ঀ-৿]/.test(slash[2])) return slash[2].trim();

  // A message the server built by filling values into a Bangla template.
  for (const p of patterns) {
    const m = key.match(p.re);
    if (!m) continue;
    let out = p.en;
    for (let i = 0; i < p.slots; i++) out = out.split('{' + i + '}').join(m[i + 1] ?? '');
    return out;
  }

  // Punctuation-only difference from a known key (e.g. a trailing colon).
  const bare = key.replace(trailing, '');
  if (bare !== key) {
    const stripped = exact.get(bare);
    if (stripped !== undefined) return stripped + key.slice(bare.length);
  }

  return text;
}

/** `translate` bound to one language — what pages use as `L(bn)` / `L(bn, en)`. */
export function makeTranslator(lang: Lang) {
  return (bn: string, en?: string): string => {
    if (lang === 'en' && en !== undefined) return en;
    return translate(bn, lang);
  };
}

/** True when the dictionary (or an inline pattern) can render `text` in English. */
export function hasTranslation(text: string): boolean {
  return translate(text, 'en') !== text;
}
