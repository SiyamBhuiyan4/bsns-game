// scripts/assistant-eval/train-v2.ts
// Permutation training runner (v2) incorporating massive synthetic permutations,
// plain multiline credentials, Banglish/Bangla variations, and ground-truth exams.
//
// Usage:
//   npx tsx scripts/assistant-eval/train-v2.ts [--count=1000000] [--holdout=exam4.json] [--out=src/lib/agent/model.json]

import { join } from 'path';
import { trainMega } from './train-mega';

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const count = Number(arg('count') ?? 1_000_000);
const holdout = arg('holdout') ?? 'exam4.json';
const out = arg('out') ?? join(__dirname, '../../src/lib/agent/model.json');
const examWeight = Number(arg('exam-weight') ?? 12);
const minFreq = Number(arg('min-freq') ?? 2);
const dryRun = process.argv.includes('--dry-run');

console.log(`Starting train-v2 with count=${count}, holdout=${holdout}...`);

trainMega({
  totalCount: count,
  holdout,
  outputPath: out,
  examWeight,
  minFreq,
  dryRun,
}).catch((err) => {
  console.error('Training failed:', err);
  process.exit(1);
});
