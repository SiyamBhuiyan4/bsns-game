// Small statistical classifier (multinomial naive Bayes) that maps an admin message to a page,
// "ANSWER" (explanation only) or "DECLINE" (not about the panel). It runs locally, no AI service.
// Features are whole words plus 3-4 letter pieces of each word, so typos and Bangla word endings
// still share most features with the training examples. Trained by scripts/assistant-eval/train.ts.

import model from './model.json';

type Model = {
  classes: string[];
  /** Log prior per class. */
  prior: number[];
  /** Total feature count per class. */
  totals: number[];
  vocabSize: number;
  /** feature -> sparse counts [classIndex, count, classIndex, count, ...] */
  counts: Record<string, number[]>;
};

const M = model as Model;

const TYPO_MAP: Record<string, string> = {
  acount: 'account',
  accout: 'account',
  acnt: 'account',
  employe: 'employee',
  emloyee: 'employee',
  emplyee: 'employee',
  emploee: 'employee',
  emploe: 'employee',
  empl: 'employee',
  pasword: 'password',
  passwrd: 'password',
  paswrd: 'password',
  passwod: 'password',
  passwd: 'password',
  pswd: 'password',
  custmr: 'customer',
  custmer: 'customer',
  coustomer: 'customer',
  costomer: 'customer',
  cumtomer: 'customer',
  dshboard: 'dashboard',
  dashbord: 'dashboard',
  dashbaord: 'dashboard',
  dashborad: 'dashboard',
  sectin: 'section',
  sektion: 'section',
  sction: 'section',
  secton: 'section',
  campegn: 'campaign',
  campain: 'campaign',
  campan: 'campaign',
  campagin: 'campaign',
  prodct: 'product',
  produt: 'product',
  pruduct: 'product',
  reprt: 'report',
  reprot: 'report',
  repor: 'report',
  crteate: 'create',
  creat: 'create',
  crate: 'create',
  chck: 'check',
  chek: 'check',
  updat: 'update',
  udpate: 'update',
  ragister: 'register',
  regester: 'register',
  registar: 'register',
  seting: 'settings',
  setings: 'settings',
  settngs: 'settings',
  setting: 'settings',
  leed: 'leads',
  leds: 'leads',
  leeds: 'leads',
  kormy: 'kormi',
  kormee: 'kormi',
  kormira: 'kormi',
  kormider: 'kormi',
  notn: 'notun',
  notoon: 'notun',
  nutun: 'notun',
  dehkhao: 'dekhao',
  dekao: 'dekhao',
  dekho: 'dekhao',
  dekaho: 'dekhao',
  khol: 'kholo',
  kolbo: 'kholo',
  kulo: 'kholo',
  bano: 'banao',
  banaw: 'banao',
  banau: 'banao',
  bosao: 'bosao',
  boshaw: 'bosao',
  bosa: 'bosao',
  jog: 'jog',
  jug: 'jog',
  jok: 'jog',
};

function fold(w: string): string {
  const norm = TYPO_MAP[w] || w;
  return norm
    .replace(/ী/g, 'ি')
    .replace(/ূ/g, 'ু')
    .replace(/ণ/g, 'ন')
    .replace(/[শষ]/g, 'স')
    .replace(/[ড়ঢ়]/g, 'র')
    .replace(/য়/g, 'য')
    .replace(/[ঁং‌‍]/g, '');
}

export function features(text: string): string[] {
  const words = text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean)
    .map(fold);
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    out.push('w:' + w);
    if (i > 0) out.push('b:' + words[i - 1] + '_' + w);
    const padded = `^${w}$`;
    for (const n of [3, 4]) {
      for (let j = 0; j + n <= padded.length; j++) out.push('c:' + padded.slice(j, j + n));
    }
  }
  return out;
}

/** Probability of each class for a message, highest first. */
export function predict(text: string): { label: string; p: number }[] {
  const feats = features(text);
  const logp = M.prior.slice();
  const k = M.classes.length;
  for (const f of feats) {
    const sparse = M.counts[f];
    if (!sparse) continue; // unseen feature: no evidence either way
    const row = new Array<number>(k).fill(0);
    for (let i = 0; i < sparse.length; i += 2) row[sparse[i]] = sparse[i + 1];
    for (let c = 0; c < k; c++) logp[c] += Math.log((row[c] + 0.1) / (M.totals[c] + 0.1 * M.vocabSize));
  }
  const max = Math.max(...logp);
  const exp = logp.map((v) => Math.exp(v - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  return M.classes.map((label, c) => ({ label, p: exp[c] / sum })).sort((a, b) => b.p - a.p);
}
