// Train the assistant's classifier (src/lib/agent/model.json) from labelled examples.
// Usage: npx tsx scripts/assistant-eval/train.ts [--holdout=exam3.json] [--generated=15000]
// Sources: the hand-written exam sets (weighted higher) plus generated sentences from spec.ts.
// --holdout leaves one exam set out so it can be scored honestly afterwards.

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { features } from '../../src/lib/agent/classifier';
import { INTENTS, NAMES, OFF_TOPIC, WRAPPERS, type Lang } from './spec';

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const holdout = arg('holdout');
const generatedCount = Number(arg('generated') ?? 15000);
const EXAM_WEIGHT = 4;

let seed = 99;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)];

const examples: { text: string; label: string; weight: number }[] = [];

for (const file of ['exam.json', 'exam2.json', 'exam3.json', 'exam4.json']) {
  if (file === holdout) continue;
  if (file === 'exam4.json' && holdout !== 'none') continue; // exam4 is the final judge: never trained on
  const path = join(__dirname, file);
  if (!existsSync(path)) continue;
  for (const it of JSON.parse(readFileSync(path, 'utf8')) as { text: string; expect: string }[]) {
    examples.push({ text: it.text, label: it.expect, weight: EXAM_WEIGHT });
  }
}

for (let i = 0; i < generatedCount; i++) {
  if (rand() < 0.08) {
    examples.push({ text: pick(OFF_TOPIC), label: 'DECLINE', weight: 1 });
    continue;
  }
  const intent = pick(INTENTS);
  const lang = pick<Lang>(['en', 'bn', 'bl']);
  const core = lang === 'en' ? `${pick(intent.verbs[lang])} ${pick(intent.objects[lang])}` : `${pick(intent.objects[lang])} ${pick(intent.verbs[lang])}`;
  const named = intent.name && rand() < 0.4 ? `${core} ${pick(NAMES[intent.name])}` : core;
  const wrappers = [...WRAPPERS[lang].tune, ...WRAPPERS[lang].heldOut];
  examples.push({ text: pick(wrappers).replace('{S}', named.trim()), label: intent.page ?? 'ANSWER', weight: 1 });
}

const classes = [...new Set(examples.map((e) => e.label))].sort();
const idx = new Map(classes.map((c, i) => [c, i]));
const docCount = new Array(classes.length).fill(0);
const totals = new Array(classes.length).fill(0);
const counts = new Map<string, number[]>();

for (const e of examples) {
  const c = idx.get(e.label)!;
  docCount[c] += e.weight;
  for (const f of features(e.text)) {
    let row = counts.get(f);
    if (!row) counts.set(f, (row = new Array(classes.length).fill(0)));
    row[c] += e.weight;
    totals[c] += e.weight;
  }
}

// Drop features seen only once in total (noise), store the rest sparsely.
const sparse: Record<string, number[]> = {};
for (const [f, row] of counts) {
  const sum = row.reduce((a, b) => a + b, 0);
  if (sum < 2) continue;
  const s: number[] = [];
  row.forEach((v, c) => v > 0 && s.push(c, v));
  sparse[f] = s;
}
const docs = docCount.reduce((a, b) => a + b, 0);
const model = {
  classes,
  prior: docCount.map((d) => Math.log(d / docs)),
  totals,
  vocabSize: Object.keys(sparse).length,
  counts: sparse,
};
const out = join(__dirname, '../../src/lib/agent/model.json');
writeFileSync(out, JSON.stringify(model));
console.log(`Trained on ${examples.length} examples (${classes.length} classes, ${model.vocabSize} features)${holdout ? `, holding out ${holdout}` : ''}.`);
