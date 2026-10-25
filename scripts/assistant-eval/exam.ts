// Score the assistant on exam.json: independently written admin messages with the expected page.
// Usage: npx tsx scripts/assistant-eval/exam.ts [--file=exam2.json] [--half=tune|test] [--fails]
// expect is a page path, "ANSWER" (explanation only, no page) or "DECLINE" (not about the panel).

import { readFileSync } from 'fs';
import { join } from 'path';
import { classify } from '../../src/lib/agent/navigator';

type Item = { text: string; expect: string; lang: 'en' | 'bn' | 'bl' };
// --file=exam2.json picks another exam set (default exam.json).
const file = process.argv.find((a) => a.startsWith('--file='))?.split('=')[1] ?? 'exam.json';
const all: Item[] = JSON.parse(readFileSync(join(__dirname, file), 'utf8'));
const showFails = process.argv.includes('--fails');
// --half=tune uses even items (for fixing), --half=test uses odd items (never looked at while fixing).
const half = process.argv.find((a) => a.startsWith('--half='))?.split('=')[1];
const items = half ? all.filter((_, i) => (half === 'tune' ? i % 2 === 0 : i % 2 === 1)) : all;

function predict(text: string): string {
  const c = classify(text);
  if (c.kind === 'none') return 'DECLINE';
  if (c.kind === 'capability') return 'ANSWER';
  if (c.kind !== 'topic' || !c.topic) return 'SMALLTALK';
  return c.topic.href ?? 'ANSWER';
}

const byLang: Record<string, { n: number; ok: number }> = {};
const byExpect: Record<string, { n: number; ok: number }> = {};
const fails: string[] = [];
for (const it of items) {
  const got = predict(it.text);
  const ok = got === it.expect;
  for (const [map, key] of [[byLang, it.lang], [byExpect, it.expect]] as const) {
    map[key] ??= { n: 0, ok: 0 };
    map[key].n++;
    if (ok) map[key].ok++;
  }
  if (!ok) fails.push(`[${it.lang}] ${it.text}\n      expected ${it.expect}, got ${got}`);
}

const pct = (a: number, b: number) => ((100 * a) / b).toFixed(1) + '%';
const okAll = items.length - fails.length;
console.log(`Exam: ${okAll}/${items.length} correct (${pct(okAll, items.length)})`);
console.log(Object.entries(byLang).map(([k, v]) => `${k} ${pct(v.ok, v.n)}`).join('   '));
console.log('\nBy expected answer:');
Object.entries(byExpect)
  .sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)
  .forEach(([k, v]) => console.log(`  ${k.padEnd(24)} ${v.ok}/${v.n}`));
if (showFails) console.log('\nMistakes:\n  ' + fails.join('\n  '));
