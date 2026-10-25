// Generate a large set of admin requests and measure how often the assistant understands them.
// Usage: npx tsx scripts/assistant-eval/run.ts [count=1000000] [seed=42]
// Prints page accuracy, topic accuracy, off-topic decline rate, held-out accuracy, and the top mistakes.

import { classify } from '../../src/lib/agent/navigator';
import { INTENTS, NAMES, OFF_TOPIC, WRAPPERS, type IntentSpec, type Lang } from './spec';

const COUNT = Number(process.argv[2] ?? 1_000_000);
let seed = Number(process.argv[3] ?? 42);
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)];

function typo(sentence: string): string {
  const words = sentence.split(' ');
  const i = Math.floor(rand() * words.length);
  const w = words[i];
  if (w.length < 5 || /[ঀ-৿]/.test(w)) return sentence;
  const j = 1 + Math.floor(rand() * (w.length - 2));
  words[i] = rand() < 0.5 ? w.slice(0, j) + w.slice(j + 1) : w.slice(0, j) + w[j + 1] + w[j] + w.slice(j + 2);
  return words.join(' ');
}

function withName(lang: Lang, core: string, intent: IntentSpec): { text: string; name: string | null } {
  if (!intent.name || rand() < 0.5) return { text: core, name: null };
  const name = pick(NAMES[intent.name]);
  if (lang === 'en') return { text: pick([`${core} ${name}`, `${core} called ${name}`, `${core} named ${name}`, `${core} for ${name}`]), name };
  if (lang === 'bn') return { text: pick([`${name} নামে ${core}`, `${core} ${name}`, `${name} এর জন্য ${core}`]), name };
  return { text: pick([`${name} name e ${core}`, `${core} ${name}`]), name };
}

function makeSentence(intent: IntentSpec, heldOut: boolean) {
  const lang = pick<Lang>(['en', 'en', 'bn', 'bn', 'bl']);
  const verb = pick(intent.verbs[lang]);
  const obj = pick(intent.objects[lang]);
  const core = lang === 'en' ? `${verb} ${obj}` : `${obj} ${verb}`;
  const named = withName(lang, core.trim(), intent);
  const wrapper = pick(heldOut ? WRAPPERS[lang].heldOut : WRAPPERS[lang].tune);
  let text = wrapper.replace('{S}', named.text);
  if (lang !== 'bn' && rand() < 0.12) text = typo(text);
  if (rand() < 0.15) text = text.charAt(0).toUpperCase() + text.slice(1);
  return { text, lang, name: named.name };
}

type Bucket = { n: number; page: number; topic: number };
const bucket = (): Bucket => ({ n: 0, page: 0, topic: 0 });
const byLang: Record<string, Bucket> = { en: bucket(), bn: bucket(), bl: bucket() };
const bySplit: Record<string, Bucket> = { tune: bucket(), heldOut: bucket() };
const byIntent: Record<string, Bucket> = {};
const confusions = new Map<string, { count: number; examples: string[] }>();
let offN = 0, offOk = 0, nameN = 0, nameOk = 0;
const offMistakes = new Map<string, number>();

const started = Date.now();
for (let i = 0; i < COUNT; i++) {
  if (rand() < 0.06) {
    // Off-topic: must be declined.
    const q = pick(OFF_TOPIC);
    const text = pick(['{q}', 'hey {q}', '{q}?', 'please {q}', 'can you {q}']).replace('{q}', q);
    const c = classify(text);
    offN++;
    if (c.kind === 'none') offOk++;
    else offMistakes.set(text, (offMistakes.get(text) ?? 0) + 1);
    continue;
  }
  const intent = pick(INTENTS);
  const heldOut = rand() < 0.25;
  const s = makeSentence(intent, heldOut);
  const c = classify(s.text);
  const topicOk = c.kind === 'topic' && c.topic?.id === intent.expect;
  const pageOk = c.kind === 'topic' && (c.topic?.href ?? null) === intent.page;

  for (const b of [byLang[s.lang], bySplit[heldOut ? 'heldOut' : 'tune'], (byIntent[intent.expect] ??= bucket())]) {
    b.n++;
    if (pageOk) b.page++;
    if (topicOk) b.topic++;
  }
  if (s.name && pageOk) {
    nameN++;
    if (c.name.toLowerCase().includes(s.name.toLowerCase())) nameOk++;
  }
  if (!pageOk) {
    const key = `${intent.expect} -> ${c.kind === 'topic' ? c.topic!.id : c.kind}`;
    const entry = confusions.get(key) ?? { count: 0, examples: [] };
    entry.count++;
    if (entry.examples.length < 4 && !entry.examples.includes(s.text)) entry.examples.push(s.text);
    confusions.set(key, entry);
  }
}

const pct = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(2) + '%' : 'n/a');
const total = Object.values(byLang).reduce((acc, b) => ({ n: acc.n + b.n, page: acc.page + b.page, topic: acc.topic + b.topic }), bucket());

console.log(`Sentences: ${COUNT.toLocaleString()}  (${((Date.now() - started) / 1000).toFixed(1)}s)`);
console.log(`Right page:        ${pct(total.page, total.n)}`);
console.log(`Exact topic:       ${pct(total.topic, total.n)}`);
console.log(`Off-topic declined: ${pct(offOk, offN)}`);
console.log(`Name picked up:    ${pct(nameOk, nameN)}`);
console.log(`Tuning patterns:   ${pct(bySplit.tune.page, bySplit.tune.n)}   Held-out patterns: ${pct(bySplit.heldOut.page, bySplit.heldOut.n)}`);
console.log(`English ${pct(byLang.en.page, byLang.en.n)}   Bangla ${pct(byLang.bn.page, byLang.bn.n)}   Banglish ${pct(byLang.bl.page, byLang.bl.n)}`);
console.log('\nWeakest intents (right page):');
Object.entries(byIntent)
  .sort((a, b) => a[1].page / a[1].n - b[1].page / b[1].n)
  .slice(0, 10)
  .forEach(([k, b]) => console.log(`  ${k.padEnd(18)} ${pct(b.page, b.n)}`));
console.log('\nTop mistakes:');
[...confusions.entries()]
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, Number(process.env.TOP ?? 25))
  .forEach(([k, v]) => console.log(`  ${String(v.count).padStart(7)}  ${k}\n           e.g. ${v.examples.join(' | ')}`));
if (offMistakes.size) {
  console.log('\nOff-topic not declined:');
  [...offMistakes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([t, n]) => console.log(`  ${String(n).padStart(6)}  ${t}`));
}
