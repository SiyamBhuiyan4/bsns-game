// Offline assistant for the admin panel (no AI service, no API key).
// It reads the admin's message, works out the action (add / edit / delete / view / how / what)
// and the subject, finds the matching topic in knowledge.ts, answers with the steps and opens
// the page. Anything outside the panel is politely declined.

import prisma from '@/lib/prisma';
import { normalizeText } from './router';
import { predict } from './classifier';
import { ACTION_WORDS, FILLER, OFF_TOPIC, PAGES, TOPICS, WEAK, type Action, type Topic } from './knowledge';
import {
  extractDateFromQuery,
  extractMonthFromQuery,
  getDhakaDateString,
  formatTaka,
  formatBstDateTime,
  BN_MONTHS,
  EN_MONTHS,
  toBengaliDigits,
} from '@/lib/date';
import { getDailyReportSummary } from '@/lib/reports';

export type NavLink = { href: string; labelBn: string; labelEn: string; actionQuery?: string };
export type NavResult = { reply: string; link?: NavLink; suggestions?: NavLink[]; navigate?: boolean };

/** Kept for the teach page: every page the assistant can open. */
export const INTENTS = PAGES;

const BANGLA = /[ঀ-৿]/;
const ALL_ACTION_WORDS = Object.values(ACTION_WORDS).flat();
const ACTION_SET = new Set(ALL_ACTION_WORDS);
const ALL_SUBJECT_WORDS = [...new Set(TOPICS.flatMap((t) => t.keywords))];

function tokens(text: string): string[] {
  // \p{M} keeps Bangla vowel signs and virama inside words.
  return normalizeText(text).toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
}

/** Edit distance where a swapped pair of letters counts as one typo (emplyee, reprot, taregt). */
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

const scoreCache = new Map<string, number>();

/** How well one word matches one keyword: 3 exact, 2 typo/inflection, 0 none. */
function wordScore(word: string, key: string): number {
  const cacheKey = word + '\u0000' + key;
  const cached = scoreCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const score = rawWordScore(word, key);
  if (scoreCache.size > 2_000_000) scoreCache.clear();
  scoreCache.set(cacheKey, score);
  return score;
}

/** Fold Bangla letters that people mix up when typing (ি/ী, ু/ূ, ন/ণ, স/শ/ষ, র/ড়/ঢ়, য়/য). */
function foldBangla(w: string): string {
  return w
    .replace(/ী/g, 'ি')
    .replace(/ূ/g, 'ু')
    .replace(/ণ/g, 'ন')
    .replace(/[শষ]/g, 'স')
    .replace(/[ড়ঢ়]/g, 'র')
    .replace(/য়/g, 'য')
    .replace(/ৃ/g, 'র')
    .replace(/[ঁং]/g, '');
}

function rawWordScore(rawWord: string, rawKey: string): number {
  if (rawWord === rawKey) return 3;
  const bangla = BANGLA.test(rawWord);
  const word = bangla ? foldBangla(rawWord) : rawWord;
  const key = bangla ? foldBangla(rawKey) : rawKey;
  if (word === key) return 3;
  // Bangla: one missing or wrong vowel sign / letter in a longer word.
  if (bangla && word.length >= 4 && key.length >= 4 && distance(word, key) <= 1) return 2;
  // Bangla suffixes (কর্মীর, গ্রুপগুলো) and English forms (adding, groups).
  if (key.length >= 3 && word.startsWith(key)) return 2;
  if (word.length >= 4 && key.startsWith(word)) return 2;
  // Typos only on longer words, so short unrelated words (rice/price) do not match.
  if (!bangla && word.length >= 5 && key.length >= 5) {
    const d = distance(word, key);
    // Long distinctive words: one typo is still a confident match; very long words allow two.
    if (d <= 1) return word.length >= 6 && !WEAK.has(key) ? 3 : 2;
    if (d === 2 && word.length >= 8 && key.length >= 8) return 2;
  }
  // 4-letter typos (krmi, liks) only against specific words, never generic ones (rice is not price).
  if (!bangla && word.length === 4 && key.length >= 4 && key.length <= 5 && !WEAK.has(key) && distance(word, key) <= 1) return 2;
  return 0;
}

function detectActions(words: string[]): Set<Action> {
  const found = new Set<Action>();
  for (const [action, list] of Object.entries(ACTION_WORDS) as [Action, string[]][]) {
    if (words.some((w) => list.some((k) => wordScore(w, k) >= 2))) found.add(action);
  }
  return found;
}

function scoreTopic(words: string[], topic: Topic, actions: Set<Action>, lowerMessage: string): number {
  const phraseHitEarly = topic.phrases?.some((p) => lowerMessage.includes(p)) ?? false;
  const has = (list?: string[]) => !list || words.some((w) => list.some((k) => wordScore(w, k) >= 2));
  if (!phraseHitEarly && (!has(topic.requires) || !has(topic.alsoRequires))) return 0;
  let subject = 0;
  let strong = 0;
  let weak = 0;
  for (const w of words) {
    if (FILLER.has(w)) continue;
    let best = 0;
    // An action word ("edit") only counts as a subject on an exact match, never as a typo ("exit").
    const isAction = ACTION_SET.has(w);
    for (const k of topic.keywords) {
      const sc = wordScore(w, k);
      best = Math.max(best, isAction && sc < 3 ? 0 : sc);
    }
    if (best === 0) continue;
    if (WEAK.has(w)) {
      weak++;
      subject += 1;
    } else {
      strong++;
      subject += best;
    }
  }
  const phraseHit = topic.phrases?.some((p) => lowerMessage.includes(p)) ?? false;
  // Must mention the subject: one specific word, at least two generic ones, or a known phrase.
  if (strong === 0 && weak < 2 && !phraseHit) return 0;
  if (phraseHit) subject += 4;
  const actionBonus = topic.actions.some((a) => actions.has(a)) ? 3 : 0;
  return subject + actionBonus;
}

const clean = (raw: string) => raw.replace(/[?!.,।"'“”]/g, '');

/** Words that are not filler, action or subject words: treated as a name ("Rahim", "Dhaka Farmers"). */
function extractName(message: string, topic: Topic): string {
  // Explicit markers win, so names may contain ordinary words ("Mushroom Lovers", "এগ্রো গ্রুপ").
  const parts = message.split(/\s+/).map(clean).filter(Boolean);
  const lowerParts = parts.map((p) => p.toLowerCase());
  const after = lowerParts.findIndex((p) => p === 'called' || p === 'named');
  if (after >= 0 && after < parts.length - 1) {
    const tail = parts.slice(after + 1);
    while (tail.length && FILLER.has(tail[tail.length - 1].toLowerCase())) tail.pop();
    if (tail.length) return tail.join(' ');
  }
  const before = lowerParts.findIndex((p, i) => p === 'নামে' || (p === 'name' && lowerParts[i + 1] === 'e'));
  if (before > 0) {
    const head = parts.slice(0, before);
    while (head.length && (FILLER.has(head[0].toLowerCase()) || ACTION_SET.has(head[0].toLowerCase()))) head.shift();
    if (head.length) return head.join(' ');
  }
  const leftover = message
    .split(/\s+/)
    .map(clean)
    .filter((raw) => {
      const w = normalizeText(raw).toLowerCase();
      if (!w || FILLER.has(w)) return false;
      if (ALL_ACTION_WORDS.some((k) => wordScore(w, k) >= 2)) return false;
      if (topic.keywords.some((k) => wordScore(w, k) >= 2)) return false;
      if (ALL_SUBJECT_WORDS.some((k) => wordScore(w, k) >= 2)) return false;
      return true;
    })
    .join(' ')
    .trim();
  // Without an explicit "called"/"নামে" marker, only a short leftover is treated as a name;
  // longer leftovers are just the rest of the sentence ("ছেলে জয়েন করছে ওর").
  return leftover && leftover.split(' ').length <= 2 ? leftover : '';
}

async function findEntity(kind: 'employee' | 'section', name: string) {
  if (!name) return null;
  const needle = name.toLowerCase();
  if (kind === 'employee') {
    const people = await prisma.user.findMany({ where: { role: 'EMPLOYEE' }, select: { id: true, name: true, email: true } });
    const hit = people.find((p) => p.name.toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle));
    return hit ? { id: hit.id, label: hit.name } : null;
  }
  const sections = await prisma.groupSection.findMany({ select: { id: true, name: true } });
  const hit = sections.find((s) => s.name.toLowerCase().includes(needle));
  return hit ? { id: hit.id, label: hit.name } : null;
}

function formatSteps(lines: string[]): string {
  return lines.length === 1 ? lines[0] : lines.map((l, i) => `${i + 1}. ${l}`).join('\n');
}

const GREETING = ['hi', 'hello', 'hey', 'salam', 'assalamualaikum', 'হ্যালো', 'হাই', 'সালাম', 'আসসালামু'];
const THANKS = ['thanks', 'thank', 'thx', 'ok', 'okay', 'great', 'nice', 'ধন্যবাদ', 'আচ্ছা', 'ওকে'];
const CAPABILITY = ['what can you do', 'who are you', 'assistant help with', 'can this assistant', 'assistant diye ki', 'অ্যাসিস্ট্যান্ট দিয়ে কী', 'এই অ্যাসিস্ট্যান্ট', 'this assistant do', 'ki ki korte paro', 'ki korte paro', 'tumi ke', 'tumi ki paro', 'তুমি কে', 'কী করতে পারো', 'কি করতে পারো', 'কী কী পারো', 'কি কি পারো', 'কীভাবে সাহায্য', 'কিভাবে সাহায্য', 'সাহায্য করতে পার', 'sahajjo korte par'];

const WHO = ['who', 'কে', 'ke', 'kara', 'কারা'];

/** Whole questions about other things that happen to use panel words. */
const OFF_TOPIC_PHRASES = ['make a facebook group', 'create a facebook group', 'facebook group kivabe khul', 'ফেসবুক গ্রুপ কিভাবে খুল', 'ফেসবুক গ্রুপ কীভাবে খুল', 'grow oyster', 'mushroom chash', 'মাশরুম চাষ'];

const UPLOAD_WORDS = ['upload', 'uploads', 'uploaded', 'আপলোড', 'import', 'imported', 'imports', 'ইমপোর্ট', 'csv', 'সিএসভি', 'file', 'files', 'ফাইল'];
/** Signs that the admin is asking about an upload that already happened. */
const PAST_WORDS = ['did', 'was', 'last', 'yesterday', 'kal', 'গতকাল', 'before', 'আগে', 'porjonto', 'পর্যন্ত',
  'hoise', 'হইছে', 'হয়েছে', 'korsilam', 'করছিলাম', 'করেছিলাম', 'disilam', 'দিছিলাম', 'shesh', 'শেষবার', 'শেষ', 'list', 'লিস্ট', 'তালিকা', 'log',
  'history', 'itihas', 'ইতিহাস', 'through', 'thikmoto', 'ঠিকমতো', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'শনিবার', 'রবিবার', 'সোমবার', 'মঙ্গলবারের', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'mongolbar', 'record', 'records', 'রেকর্ড', 'duplicate', 'duplicates', 'ডুপ্লিকেট'];

/** Report period words; with a number-type word they mean "open that report". */
const DAY = ['today', 'todays', 'aj', 'ajke', 'ajker', 'আজ', 'আজকে', 'আজকের', 'daily', 'দৈনিক', 'yesterday', 'গতকাল', 'protidin', 'প্রতিদিন'];
const WEEK = ['week', 'weekly', 'shoptahe', 'soptahe', 'saptahik', 'সপ্তাহে', 'সপ্তাহের', 'সাপ্তাহিক'];
const MONTH = ['month', 'monthly', 'mashe', 'maser', 'masik', 'মাসে', 'মাসের', 'মাসিক', 'মান্থলি'];
const METRIC = ['score', 'স্কোর', 'profit', 'লাভ', 'মুনাফা', 'sales', 'sale', 'bikri', 'বিক্রি', 'post', 'posts', 'posted', 'পোস্ট', 'rank', 'ranking',
  'র‍্যাংকিং', 'summary', 'numbers', 'hishab', 'হিসাব', 'report', 'রিপোর্ট', 'pdf', 'result', 'stats', 'performance', 'happened', 'dise', 'দিছে', 'সংখ্যাগুলো'];
/** If one of these is the subject, the period word is not about a report ("monthly target", "this month's budget"). */
const NOT_REPORT = ['target', 'targets', 'টার্গেট', 'budget', 'বাজেট', 'plan', 'প্ল্যান', 'lead', 'leads', 'লিড', 'upload', 'আপলোড', 'campaign', 'ক্যাম্পেইন',
  'ad', 'অ্যাড', 'task', 'কাজ', 'set', 'সেট', 'copy', 'কপি', 'customer', 'customers', 'buyer', 'buyers', 'client', 'clients', 'ক্রেতা', 'গ্রাহক', 'কাস্টমার', 'lost', 'qualified', 'ordered', 'বাতিল', 'অর্ডার', 'schedule', 'সময়সূচি', 'shortcut', 'শর্টকাট', 'phrase', 'account', 'অ্যাকাউন্ট', 'join', 'joined', 'লগইন', 'login', 'password', 'পাসওয়ার্ড', 'worker', 'কর্মী', 'marketer', 'মার্কেটার', 'bill', 'বিল'];
const GIVE = ['দাও', 'দিন', 'dao', 'deo', 'den'];
const CHANGED = ['changed', 'deleted', 'removed', 'edited', 'updated', 'published', 'messed', 'modify', 'modifying', 'এডিট', 'বদলাইছে', 'সরাই', 'সরিয়েছে', 'গন্ডগোল', 'soraye', 'মুছছে', 'বদলেছে', 'মুছেছে', 'মুছে', 'ডিলিট', 'পরিবর্তন', 'মডিফাই', 'korse', 'korsilo', 'korechhe', 'koreche'];

function isWhoChanged(words: string[]): boolean {
  if (!words.some((w) => WHO.includes(w))) return false;
  if (words.some((w) => ['কাজ', 'kaj', 'work', 'worked'].includes(w))) return false;
  if (words.some((w) => ['গতকাল', 'kal', 'yesterday', 'aj', 'আজ', 'today'].includes(w))) return false;
  if (words.some((w) => ['customer', 'buyer', 'ক্রেতা', 'কাস্টমার', 'order', 'অর্ডার'].includes(w))) return false;
  return words.some((w) => CHANGED.some((k) => wordScore(w, k) >= 2));
}

export type Classification = {
  kind: 'capability' | 'greeting' | 'thanks' | 'topic' | 'none';
  topic?: Topic;
  /** Next-best topics (for suggestion buttons). */
  others: Topic[];
  actions: Set<Action>;
  /** Leftover words treated as a person or section name. */
  name: string;
};

/** Understand a message without touching the database. Used by navigate() and the test harness. */
export function classify(message: string): Classification {
  const lower = normalizeText(message).toLowerCase().trim();
  const words = tokens(message);
  const actions = detectActions(words);
  const base = { others: [] as Topic[], actions, name: '' };

  if (CAPABILITY.some((p) => lower.includes(p))) return { ...base, kind: 'capability' };
  const meaningful = words.filter((w) => !FILLER.has(w));
  if (words.length && words.every((w) => GREETING.includes(w) || FILLER.has(w))) return { ...base, kind: 'greeting' };
  if (meaningful.length && meaningful.every((w) => THANKS.includes(w))) return { ...base, kind: 'thanks' };

  const firstHit = (t: Topic) => {
    const i = words.findIndex((w) => !FILLER.has(w) && !ACTION_SET.has(w) && t.keywords.some((k) => wordScore(w, k) >= 2));
    return i < 0 ? 999 : i;
  };
  // Higher score wins; on a tie, the page whose subject word comes first ("filter leads by marketer").
  const ranked = TOPICS.map((t) => ({ t, s: scoreTopic(words, t, actions, lower), f: firstHit(t) }))
    .filter((r) => r.s >= 3)
    .sort((a, b) => b.s - a.s || a.f - b.f);

  const hasAny = (list: string[]) => words.some((w) => list.some((k) => wordScore(w, k) >= 2));
  const byId = (id: string) => TOPICS.find((t) => t.id === id)!;
  const pick = (id: string) => {
    const t = byId(id);
    return { kind: 'topic' as const, topic: t, others: ranked.map((r) => r.t).filter((x) => x !== t), actions, name: extractName(message, t) };
  };

  if (OFF_TOPIC_PHRASES.some((p) => lower.includes(p))) return { ...base, kind: 'none' };
  if (words.some((w) => OFF_TOPIC.has(w)) && (!ranked.length || ranked[0].s < 10)) return { ...base, kind: 'none' };

  // "What did I upload last week?", "did tuesday's import go through?"  -> upload history
  if (hasAny(UPLOAD_WORDS) && hasAny(PAST_WORDS) && !actions.has('how') && !actions.has('add')) return pick('upload_history');

  // "Sumaiya-কে Dhaka Farmers সেকশন দাও", "jamal ke Agro BD assign koro"  -> assign
  const toPerson = words.some((w) => (w.length > 3 && w.endsWith('কে')) || w === 'ke');
  if (toPerson && (hasAny(GIVE) || hasAny(['assign'])) && !hasAny(['task', 'টাস্ক', 'লিংক', 'link', 'links'])) return pick('assign_section');

  // Period + number-type word ("আজকের স্কোর", "monthly score", "mon to sun summary", "kalker report") -> that report
  const queryDate = extractDateFromQuery(message);
  const queryMonth = extractMonthFromQuery(message);
  const isCustomerWord = hasAny(['customer', 'customers', 'lead', 'leads', 'client', 'clients', 'কাস্টমার', 'ক্রেতা', 'গ্রাহক', 'লিড']);

  if (queryDate && isCustomerWord) {
    return pick(actions.has('add') ? 'add_lead' : 'lead_stage');
  }

  const dated = /\d{1,2}\s*(january|february|march|april|may|june|july|august|september|october|november|december|জানুয়ারি|ফেব্রুয়ারি|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট|সেপ্টেম্বর|অক্টোবর|নভেম্বর|ডিসেম্বর)/.test(lower);
  if ((hasAny(METRIC) || hasAny(['report', 'রিপোর্ট', 'সারসংক্ষেপ', 'summary', 'hishab', 'হিসাব', 'কাজ', 'kaj'])) && !hasAny(NOT_REPORT) && !isWhoChanged(words)) {
    if (queryMonth) return pick('report_monthly');
    if (queryDate || dated || hasAny(DAY)) return pick('report_daily');
    if (hasAny(WEEK) || /mon to sun|শনি থেকে শুক্র|shoni theke/.test(lower)) return pick('report_weekly');
    if (hasAny(MONTH) || /full month|গত মাস|last month/.test(lower)) return pick('report_monthly');
  }

  // "Who changed / deleted X?" is always an audit-log question.
  if (isWhoChanged(words)) {
    const audit = TOPICS.find((t) => t.id === 'audit')!;
    return { kind: 'topic', topic: audit, others: ranked.map((r) => r.t).filter((t) => t !== audit), actions, name: '' };
  }
  // Statistical classifier (trained on labelled admin messages) picks the page; the rules above
  // handle the clear-cut cases and pick the exact task on that page.
  const mode = process.env.AGENT_MODE ?? 'combo';
  if (mode !== 'rules') {
    const [top] = predict(message);
    const minP = Number(process.env.AGENT_MIN_P ?? 0.9);
    if (top && top.p >= minP) {
      if (top.label === 'DECLINE') return { ...base, kind: 'none' };
      // Prevent false classifier override on bulk CSV upload or settings undo
      if (top.label === '/admin/csv/history' && (actions.has('add') || actions.has('how') || hasAny(['undo', 'আনডু']))) {
        // preserve upload_csv / settings_undo
      } else {
        const onPage = (t: Topic) => (top.label === 'ANSWER' ? t.href === null : t.href === top.label);
        const ruled = ranked.find((r) => onPage(r.t));
        if (ruled) return pick(ruled.t.id);
        const fallback =
          TOPICS.find((t) => onPage(t) && t.actions.some((a) => actions.has(a))) ?? TOPICS.find((t) => onPage(t));
        if (fallback) return pick(fallback.id);
      }
    }
  }

  if (!ranked.length) return { ...base, kind: 'none' };
  const topic = ranked[0].t;
  return { kind: 'topic', topic, others: ranked.slice(1).map((r) => r.t), actions, name: extractName(message, topic) };
}

export async function navigate(message: string): Promise<NavResult> {
  const bn = BANGLA.test(message);
  const say = (b: string, e: string) => (bn ? b : e);
  const lower = normalizeText(message).toLowerCase().trim();

  // 1. Phrases the admin has taught come first.
  const taught = await prisma.agentPhrase.findMany({});
  const learned = taught
    .filter((t) => lower === String(t.phrase).toLowerCase() || lower.includes(String(t.phrase).toLowerCase()))
    .sort((a, b) => String(b.phrase).length - String(a.phrase).length)[0];
  if (learned) {
    return {
      reply: say(`"${learned.label}" পেজ খুলছি।`, `Opening "${learned.label}".`),
      link: { href: String(learned.href), labelBn: String(learned.label), labelEn: String(learned.label) },
      navigate: true,
    };
  }

  // 2. Understand the message.
  const c = classify(message);
  const actions = c.actions;

  // 2.05 Ambiguous Generic Report Clarification
  const isGenericReportQuery =
    /(?:^|[^\p{L}\p{N}])(?:report|reports|রিপোর্ট|হিসাব|সারসংক্ষেপ|hishab|hisab|summary)(?:[^\p{L}\p{N}]|$)/iu.test(lower) &&
    !extractDateFromQuery(message) &&
    !extractMonthFromQuery(message) &&
    !/(?:daily|dainik|আজকের|গতকালকের|kal|aj|গতকাল|week|weekly|সাপ্তাহিক|shoptahik|month|monthly|মাসিক|masik|মাসের)/iu.test(lower) &&
    !actions.has('add') &&
    !actions.has('edit');

  if (isGenericReportQuery) {
    return {
      reply: bn
        ? `📊 **আপনি কোন ধরনের রিপোর্ট দেখতে চান?**\n` +
          `অনুগ্রহ করে নিশ্চিত করুন আপনি দৈনিক (Daily), সাপ্তাহিক (Weekly) নাকি মাসিক (Monthly) রিপোর্ট দেখতে চান। নিচের অপশন থেকেও সরাসরি বেছে নিতে পারেন:`
        : `📊 **Which type of report would you like to view?**\n` +
          `Please confirm whether you want the Daily, Weekly, or Monthly report. You can also pick from the options below:`,
      suggestions: [
        { href: '/admin/reports/daily', labelBn: 'দৈনিক রিপোর্ট (Daily Report)', labelEn: 'Daily Report' },
        { href: '/admin/reports/weekly', labelBn: 'সাপ্তাহিক রিপোর্ট (Weekly Report)', labelEn: 'Weekly Report' },
        { href: '/admin/reports/monthly', labelBn: 'মাসিক রিপোর্ট (Monthly Report)', labelEn: 'Monthly Report' },
      ],
      navigate: false,
    };
  }

  // 2.1 Live Website Data Queries (Products, Campaigns, Employees, Sections, Scoring, Customer Rules, Action Plan)
  // Direct Phone Number / Customer Quick Lookup
  const phoneLookupMatch = /(?:\+?880|0)?(1[3-9]\d{8})\b/.exec(lower);
  if (phoneLookupMatch && !actions.has('add') && !actions.has('edit')) {
    const cleanPhone = '0' + phoneLookupMatch[1];
    const lead = await prisma.lead.findFirst({
      where: { phone: { contains: cleanPhone } },
      include: { employee: { select: { name: true } } },
    });
    if (lead) {
      const statusNames: Record<string, string> = {
        NEW: 'নতুন লিড (NEW)',
        CONTACTED: 'যোগাযোগ করা হয়েছে (CONTACTED)',
        INTERESTED: 'আগ্রহী (INTERESTED)',
        ORDERED: 'অর্ডার নিশ্চিত (ORDERED)',
        CANCELLED: 'বাতিল (CANCELLED)',
      };
      const formattedDate = formatBstDateTime(lead.created_at, bn ? 'bn' : 'en');
      return {
        reply: bn
          ? `👤 **কাস্টমার বিবরণ পাওয়া গেছে!**\n` +
            `• 📱 ফোন: **${lead.phone}**\n` +
            `• 👤 নাম: ${lead.name || 'নাম দেওয়া নেই'}\n` +
            `• 📊 স্ট্যাটাস: **${statusNames[lead.status] || lead.status}**\n` +
            `• 👨‍💼 দায়িত্বপ্রাপ্ত কর্মী: **${lead.employee?.name || 'অ্যাসাইন নেই'}**\n` +
            `• ⏰ রেজিস্ট্রেশন: ${formattedDate}\n` +
            (lead.order_value ? `• 💰 অর্ডারের মূল্য: ৳ ${lead.order_value}\n` : '') +
            (lead.notes ? `• 📝 নোট: ${lead.notes}\n` : '') +
            `\nকাস্টমার বিস্তারিত পেজে নিয়ে যাচ্ছি...`
          : `👤 **Customer Found!**\n` +
            `• 📱 Phone: **${lead.phone}**\n` +
            `• 👤 Name: ${lead.name || 'Not provided'}\n` +
            `• 📊 Status: **${lead.status}**\n` +
            `• 👨‍💼 Assigned Employee: **${lead.employee?.name || 'Unassigned'}**\n` +
            `• ⏰ Registered: ${formattedDate}\n` +
            (lead.order_value ? `• 💰 Order Value: ৳ ${lead.order_value}\n` : '') +
            (lead.notes ? `• 📝 Notes: ${lead.notes}\n` : '') +
            `\nOpening customer list...`,
        link: { href: `/admin/leads?q=${encodeURIComponent(cleanPhone)}`, labelBn: 'কাস্টমার প্রোফাইল', labelEn: 'Customer Profile' },
        navigate: true,
      };
    } else {
      return {
        reply: bn
          ? `🔍 **${cleanPhone}** নম্বরে কোনো কাস্টমার বা লিড ডেটাবেসে পাওয়া যায়নি। নতুন কাস্টমার হিসেবে যুক্ত করতে পারেন।`
          : `🔍 No customer found with phone **${cleanPhone}** in our database. You can register them as a new customer.`,
        link: { href: `/admin/leads?add=1&phone=${encodeURIComponent(cleanPhone)}`, labelBn: 'নতুন কাস্টমার যোগ করুন', labelEn: 'Add New Customer' },
        navigate: false,
      };
    }
  }

  // Active / Who Worked Today or Yesterday Inquiry
  const isWhoWorkedInquiry =
    /(?:ke\s*ke\s*kaj|kara\s*kaj|who\s*worked|active\s*employees?|worked\s*today|kaj\s*korse|kaj\s*kore\s*nai|submission\s*list|কে\s*কে\s*কাজ|কারা\s*কাজ)/iu.test(lower) &&
    !actions.has('add') &&
    !actions.has('edit');

  if (isWhoWorkedInquiry) {
    const dateInfo = extractDateFromQuery(message);
    const targetDateStr = dateInfo ? dateInfo.dateStr : getDhakaDateString();
    const dayStartUtc = new Date(`${targetDateStr}T00:00:00+06:00`);
    const dayEndUtc = new Date(`${targetDateStr}T23:59:59.999+06:00`);

    const allEmps = await prisma.user.findMany({
      where: { role: 'EMPLOYEE', is_active: true },
      select: { id: true, name: true },
    });

    const activeCompletions = await prisma.linkCompletion.findMany({
      where: { completed_at: { gte: dayStartUtc, lte: dayEndUtc }, undone_at: null },
      select: { employee_id: true },
    });
    const activeDailyEntries = await prisma.dailyEntry.findMany({
      where: { entry_date: new Date(`${targetDateStr}T00:00:00.000Z`) },
      select: { employee_id: true },
    });

    const activeIds = new Set([
      ...activeCompletions.map((c) => c.employee_id),
      ...activeDailyEntries.map((d) => d.employee_id),
    ]);

    const workedEmps = allEmps.filter((e) => activeIds.has(e.id));
    const notWorkedEmps = allEmps.filter((e) => !activeIds.has(e.id));

    const workedList = workedEmps.map((e) => `• ✅ **${e.name}**`).join('\n') || (bn ? '• কোনো কাজ এখনও জমা পড়েনি' : '• None yet');
    const notWorkedList = notWorkedEmps.map((e) => `• ⏳ **${e.name}**`).join('\n') || (bn ? '• সকলেই সক্রিয়!' : '• Everyone active!');

    const title = dateInfo?.isYesterday ? (bn ? 'গতকালকের' : "Yesterday's") : (bn ? 'আজকের' : "Today's");

    return {
      reply: bn
        ? `📋 **${title} কর্মীদের কাজের স্ট্যাটাস (${targetDateStr})**:\n\n` +
          `🟢 **কাজে সক্রিয় ছিলেন (${workedEmps.length} জন)**:\n${workedList}\n\n` +
          `🔴 **এখনও কোনো রিপোর্ট বা পোস্ট জমা দেননি (${notWorkedEmps.length} জন)**:\n${notWorkedList}\n\n` +
          `বিস্তারিত রিপোর্ট দেখতে দৈনিক রিপোর্ট পেজে নিয়ে যাচ্ছি...`
        : `📋 **${title} Employee Activity Status (${targetDateStr})**:\n\n` +
          `🟢 **Active (${workedEmps.length} employees)**:\n${workedList}\n\n` +
          `🔴 **Pending / No Submissions Yet (${notWorkedEmps.length} employees)**:\n${notWorkedList}\n\n` +
          `Opening daily report page...`,
      link: { href: `/admin/reports/daily?date=${targetDateStr}`, labelBn: 'দৈনিক রিপোর্ট', labelEn: 'Daily Report' },
      navigate: true,
    };
  }

  // Colloquial Business Health / Overall Status Inquiry
  const isBusinessHealthInquiry =
    /(?:ki\s*obostha|business\s*kemon|kemon\s*choltese|kemon\s*gelo|how\s*is\s*business|business\s*overview|system\s*status|ব্যবসার\s*খবর|কী\s*অবস্থা)/iu.test(lower) &&
    !actions.has('add') &&
    !actions.has('edit');

  if (isBusinessHealthInquiry) {
    const todayStr = getDhakaDateString();
    const summary = await getDailyReportSummary(todayStr);
    return {
      reply: bn
        ? `🚀 **আজকের ব্যবসার লাইভ চিত্র (${todayStr})**:\n` +
          `• 💰 মোট বিক্রি: ${formatTaka(summary.total_sales)}\n` +
          `• 📈 মোট লাভ: ${formatTaka(summary.total_profit)}\n` +
          `• 🎯 নতুন গ্রাহক/লিড: ${summary.new_leads} টি\n` +
          `• 📦 নিশ্চিত অর্ডার: ${summary.confirmed_orders} টি\n` +
          `• 📝 সোশ্যাল গ্রুপ পোস্ট: ${summary.total_posts} টি\n` +
          `• 👥 কর্মক্ষেত্রে সক্রিয়: ${summary.active_employees_count} জন কর্মী\n` +
          `• 📊 গড় স্কোর: ${summary.team_avg_score}/১০০\n\n` +
          `ড্যাশবোর্ডে সম্পূর্ণ ওভারভিউ দেখতে ড্যাশবোর্ড পেজে নিয়ে যাচ্ছি...`
        : `🚀 **Today's Live Business Overview (${todayStr})**:\n` +
          `• 💰 Total Sales: ${formatTaka(summary.total_sales, false)}\n` +
          `• 📈 Total Profit: ${formatTaka(summary.total_profit, false)}\n` +
          `• 🎯 New Customer Leads: ${summary.new_leads}\n` +
          `• 📦 Confirmed Orders: ${summary.confirmed_orders}\n` +
          `• 📝 Social Group Posts: ${summary.total_posts}\n` +
          `• 👥 Active Employees: ${summary.active_employees_count}\n` +
          `• 📊 Team Avg Score: ${summary.team_avg_score}/100\n\n` +
          `Opening Admin Dashboard...`,
      link: { href: '/admin/dashboard', labelBn: 'ড্যাশবোর্ড', labelEn: 'Dashboard' },
      navigate: true,
    };
  }

  // Failing / Low Scoring Employees Inquiry
  const isFailingInquiry =
    /(?:fail\s*korse|failing|score\s*kom|kar\s*score\s*kom|below\s*80|improvement\s*lagbe|খারাপ\s*করছে|উন্নতি\s*প্রয়োজন)/iu.test(lower);
  if (isFailingInquiry) {
    const dateInfo = extractDateFromQuery(message);
    const targetDateStr = dateInfo ? dateInfo.dateStr : getDhakaDateString();
    const summary = await getDailyReportSummary(targetDateStr);
    return {
      reply: bn
        ? `⚠️ **কর্মীদের স্কোর বিশ্লেষণ (${targetDateStr})**:\n` +
          `• ❌ লক্ষ্যমাত্রা পূরণে উন্নতি প্রয়োজন: **${summary.failing_count} জন**\n` +
          `• ✅ লক্ষ্যমাত্রা উত্তীর্ণ: **${summary.passing_count} জন**\n` +
          `• 📊 টিম গড় স্কোর: **${summary.team_avg_score}/১০০**\n\n` +
          `ব্যক্তিগত স্কোর ও পারফরম্যান্স মেট্রিক্স দেখতে দৈনিক রিপোর্টে নিয়ে যাচ্ছি...`
        : `⚠️ **Employee Score Analysis (${targetDateStr})**:\n` +
          `• ❌ Needs Improvement (Failing threshold): **${summary.failing_count}**\n` +
          `• ✅ Meeting Target (Passing): **${summary.passing_count}**\n` +
          `• 📊 Team Avg Score: **${summary.team_avg_score}/100**\n\n` +
          `Opening detailed daily report...`,
      link: { href: `/admin/reports/daily?date=${targetDateStr}`, labelBn: 'দৈনিক রিপোর্ট', labelEn: 'Daily Report' },
      navigate: true,
    };
  }

  // Products Inquiry
  const isProductInquiry =
    /(?:product|products|পণ্য|প্রোডাক্ট)/i.test(lower) &&
    /(?:what|list|available|our|have|কী|কি|তালিকা|লিস্ট|গুলো|কত|আছে|সব|আমাদের)/i.test(lower) &&
    !actions.has('add') &&
    !actions.has('edit') &&
    !actions.has('delete');

  if (isProductInquiry) {
    const prods = await prisma.product.findMany({ where: { is_active: true }, orderBy: { name_bn: 'asc' }, take: 15 });
    if (prods.length > 0) {
      const listBn = prods.map((p) => `• 🍄 **${p.name_bn || p.name_en}**: ৳ ${p.selling_price} / ${p.unit}`).join('\n');
      const listEn = prods.map((p) => `• 🍄 **${p.name_en || p.name_bn}**: ৳ ${p.selling_price} / ${p.unit}`).join('\n');
      return {
        reply: bn
          ? `📦 **আমাদের সক্রিয় পণ্যসমূহ (Active Products)**:\n${listBn}\n\nপণ্য তালিকা দেখতে বা নতুন পণ্য যোগ করতে পণ্য পেজে নিয়ে যাচ্ছি...`
          : `📦 **Our Active Products**:\n${listEn}\n\nOpening the products page...`,
        link: { href: '/admin/products', labelBn: 'পণ্য পেজ', labelEn: 'Products Page' },
        navigate: true,
      };
    }
  }

  // Campaigns Inquiry
  const isCampaignInquiry =
    /(?:campaign|campaigns|ক্যাম্পেইন|বিজ্ঞাপন)/i.test(lower) &&
    /(?:what|list|active|running|our|কী|কি|তালিকা|লিস্ট|গুলো|আছে|চলমান|আমাদের)/i.test(lower) &&
    !actions.has('add') &&
    !actions.has('edit');

  if (isCampaignInquiry) {
    return {
      reply: bn
        ? `📦 **পণ্য ও সেলস টার্গেট পেজে নিয়ে যাচ্ছি...**`
        : `📦 **Opening Product Goals & Targets page...**`,
      link: { href: '/admin/products', labelBn: 'পণ্য ও সেলস টার্গেট', labelEn: 'Product Goals' },
      navigate: true,
    };
  }

  // Employees Inquiry
  const isEmployeeInquiry =
    /(?:employee|employees|staff|worker|workers|কর্মী|কর্মচারী|কর্মীরা)/i.test(lower) &&
    /(?:who|list|all|active|our|কারা|তালিকা|লিস্ট|কে কে|সব|আমাদের|কয়জন)/i.test(lower) &&
    !actions.has('add') &&
    !actions.has('edit') &&
    !actions.has('delete');

  if (isEmployeeInquiry) {
    const emps = await prisma.user.findMany({
      where: { role: 'EMPLOYEE', is_active: true },
      include: { assignments_as_employee: { include: { section: true } } },
      take: 15,
    });
    if (emps.length > 0) {
      const listBn = emps
        .map(
          (e) =>
            `• 👤 **${e.name}** (${e.email || e.phone || 'কর্মী'}) - সেকশন: ${
              e.assignments_as_employee.map((a: any) => a.section?.name).join(', ') || 'কোনো সেকশন অ্যাসাইন নেই'
            }`
        )
        .join('\n');
      const listEn = emps
        .map(
          (e) =>
            `• 👤 **${e.name}** (${e.email || e.phone || 'Employee'}) - Sections: ${
              e.assignments_as_employee.map((a: any) => a.section?.name).join(', ') || 'None assigned'
            }`
        )
        .join('\n');
      return {
        reply: bn
          ? `👥 **আমাদের সক্রিয় কর্মীবৃন্দ (${emps.length} জন)**:\n${listBn}\n\nকর্মী ব্যবস্থাপনা পেজে নিয়ে যাচ্ছি...`
          : `👥 **Active Employees (${emps.length})**:\n${listEn}\n\nOpening employees page...`,
        link: { href: '/admin/employees', labelBn: 'কর্মচারী পেজ', labelEn: 'Employees Page' },
        navigate: true,
      };
    }
  }

  // Sections Inquiry
  const isSectionInquiry =
    /(?:section|sections|group|groups|সেকশন|গ্রুপ)/i.test(lower) &&
    /(?:what|list|all|active|our|কী|কি|তালিকা|লিস্ট|কয়টা|সব|আমাদের)/i.test(lower) &&
    !actions.has('add') &&
    !actions.has('edit') &&
    !actions.has('delete');

  if (isSectionInquiry) {
    const secs = await prisma.groupSection.findMany({ include: { _count: { select: { links: true } } }, take: 15 });
    if (secs.length > 0) {
      const listBn = secs.map((s) => `• 📁 **${s.name}** (${s._count.links} টি লিংক)`).join('\n');
      const listEn = secs.map((s) => `• 📁 **${s.name}** (${s._count.links} links)`).join('\n');
      return {
        reply: bn
          ? `📁 **আমাদের গ্রুপ ও সেকশনসমূহ (${secs.length} টি)**:\n${listBn}\n\nগ্রুপ ও লিংক পেজে নিয়ে যাচ্ছি...`
          : `📁 **Our Group Sections (${secs.length})**:\n${listEn}\n\nOpening groups page...`,
        link: { href: '/admin/sections', labelBn: 'গ্রুপ ও লিংক', labelEn: 'Groups & Links' },
        navigate: true,
      };
    }
  }

  // Scoring Explanation Query
  if (
    /(?:how\s+does\s+scoring\s+work|scoring\s+system|score\s+formula|pass\s+mark|স্কোরিং\s+কীভাবে|স্কোর\s+পদ্ধতি|পাস\s+মার্ক|scoring\s+kivabe\s+kaj\s+kore|score\s+kemne\s+hoy|স্কোরিং\s+নিয়ম)/iu.test(
      lower
    )
  ) {
    return {
      reply: bn
        ? `📊 **আমাদের পারফরম্যান্স স্কোরিং সিস্টেম (Scoring System)**:\n` +
          `• 🎯 ৭টি প্রধান মেট্রিক ট্র্যাক করা হয়: পোস্ট সম্পন্ন, বিক্রি (৳), লাভ (৳), নতুন ক্রেতা, B2B অর্ডার, রিটেনশন ও ফলো-আপ।\n` +
          `• 🏆 পাস মার্ক: ৮০% (৮০/১০০)। ৮০ বা তার বেশি পেলে পাস, কম পেলে উন্নতি প্রয়োজন।\n` +
          `• 🛡️ অ্যাচিভমেন্ট ক্যাপ: ডিফল্ট ১০০% (১.০)। টার্গেটের অতিরিক্ত কাজ হলেও সর্বোচ্চ ক্যাপ প্রযোজ্য।\n` +
          `• ⚙️ স্কোরিং সেটিংস ও ওয়েট বদলাতে সেটিংস পেজে যান।`
        : `📊 **Performance Scoring System**:\n` +
          `• 🎯 7 Core Metrics: Posts Done, Sales (৳), Profit (৳), New Clients, B2B Orders, Retention & Follow-ups.\n` +
          `• 🏆 Passing Threshold: 80% (80/100). Scores of 80+ pass; below 80 need improvement.\n` +
          `• 🛡️ Achievement Cap: Default 100% (1.0) to prevent single-metric distortion.\n` +
          `• ⚙️ Manage weights and thresholds in Settings.`,
      link: { href: '/admin/settings', labelBn: 'স্কোরিং সেটিংস', labelEn: 'Scoring Settings' },
      navigate: false,
    };
  }

  // Customer Rules / Duplicate Prevention Query
  if (
    /(?:duplicate\s+customer|phone\s+unique|phone\s+validation|ডুপ্লিকেট\s+কাস্টমার|ফোন\s+নম্বর\s+ইউনিক|duplicate\s+check\s+kivabe|notun\s+customer\s+check|কাস্টমার\s+নিয়ম)/iu.test(
      lower
    )
  ) {
    return {
      reply: bn
        ? `🛡️ **কাস্টমার ব্যবস্থাপনা ও ডুপ্লিকেট রোধের নিয়ম**:\n` +
          `• 📱 মোবাইল নম্বর বাধ্যতামূলকভাবে ইউনিক: একটি মোবাইল নম্বর ডেটাবেসে থাকলে দ্বিতীয়বার ডুপ্লিকেট হিসেবে যোগ করা যাবে না।\n` +
          `• 🔴 রিয়েলটাইম চেক: নম্বর টাইপ করার সাথে সাথে লাল (পুরাতন কাস্টমার - ব্লকড) বা সবুজ (নতুন কাস্টমার - অনুমোদিত) স্ট্যাটাস দেখায়।\n` +
          `• ⏰ বাংলাদেশ সময় (BST UTC+6): প্রতিটি কাস্টমার এন্ট্রিতে স্বয়ংক্রিয়ভাবে সঠিক BST তারিখ ও সময় সংরক্ষিত হয়।\n` +
          `• 🔒 পারমিশন স্কোপিং: সাধারণ কর্মীরা কেবল নিজের কাস্টমার দেখতে পায়; অ্যাডমিন অনুমতি দিলে ("Full Leads Access") তারা সব দেখতে পারে।`
        : `🛡️ **Customer Management & Duplicate Protection Rules**:\n` +
          `• 📱 Strict Unique Phone Numbers: Duplicate phone numbers are strictly prohibited across the entire company database.\n` +
          `• 🔴 Live Validation: Instant visual feedback (Red for existing customer / Green for new approved customer).\n` +
          `• ⏰ Bangladesh Standard Time (BST UTC+6): Automatic timestamps for every customer registration.\n` +
          `• 🔒 Scoped Access: Standard employees only see their own customer leads unless granted full database access by Admin.`,
      link: { href: '/admin/leads', labelBn: 'কাস্টমার ও লিড', labelEn: 'Customers & Leads' },
      navigate: false,
    };
  }

  // Action Plan / 90-Day Plan Query
  if (
    /(?:action\s+plan\s+(?:ki|kivabe|details)|what\s+is\s+action\s+plan|৯০\s+দিনের\s+প্ল্যান\s+কী|marketing\s+action\s+plan|action\s+plan\s+details|প্ল্যানের\s+ধাপ)/iu.test(
      lower
    )
  ) {
    return {
      reply: bn
        ? `📋 **বিস্তারিত মার্কেটিং কর্মপরিকল্পনা (90-Day Action Plan)**:\n` +
          `• 🔹 ফেজ ১: সেটআপ ও প্রাথমিক প্রস্তুতি (১-৩০ দিন) - গ্রুপ ও পেজ অপটিমাইজেশন, পণ্য তালিকা প্রস্তুত।\n` +
          `• 🔹 ফেজ ২: প্রচারণা ও গ্রাহক বৃদ্ধি (৩১-৬০ দিন) - সক্রিয় সোশ্যাল গ্রুপ পোস্টিং, পেইড বিজ্ঞাপন ও বিটুবি রিচআউট।\n` +
          `• 🔹 ফেজ ৩: বিক্রি স্কেলিং ও রিটেনশন (৬১-৯০ দিন) - বাল্ক অর্ডার ক্লোজিং, ডিলারশিপ ও কাস্টমার রিটেনশন।\n` +
          `অ্যাকশন প্ল্যান পেজে প্রতিটি টাস্ক, মাইলস্টোন ও নির্দেশিকা সরাসরি দেখতে বা এডিট করতে পারেন।`
        : `📋 **Marketing Action Plan (90-Day Plan)**:\n` +
          `• 🔹 Phase 1: Setup & Groundwork (Days 1-30) - Asset preparation, product listings, group optimization.\n` +
          `• 🔹 Phase 2: Execution & Outreach (Days 31-60) - Organic group posting, targeted paid campaigns, B2B lead generation.\n` +
          `• 🔹 Phase 3: Scaling & Retention (Days 61-90) - Wholesale closing, dealer distribution, customer repeat retention.\n` +
          `Manage and track all tasks, phases, and guidelines on the Action Plan page.`,
      link: { href: '/admin/plan', labelBn: 'কর্মপরিকল্পনা', labelEn: 'Action Plan' },
      navigate: false,
    };
  }

  if (c.kind === 'capability') {
    return {
      reply: say(
        '🤖 **আমি এই সিস্টেমের রিমোট এআই অ্যাসিস্ট্যান্ট (Website AI Assistant)**!\n' +
          'আমি এই প্ল্যাটফর্মের সকল কাজ স্বয়ংক্রিয়ভাবে করতে ও প্রশ্নের উত্তর দিতে পারি:\n\n' +
          '1. 👤 **কর্মী অ্যাকাউন্ট খোলা**: লিখুন `create an employee acount name: Rafiq pass: 123456`\n' +
          '2. 🔑 **পাসওয়ার্ড রিসেট**: লিখুন `set password of Rafiq to 654321`\n' +
          '3. 📅 **তারিখভিত্তিক রিপোর্ট**: লিখুন `kalker report`, `ajker report`, `25 tarikh er report`\n' +
          '4. 👥 **কাস্টমার ফিল্টারিং**: লিখুন `kalker customer`, `last 7 days leads`\n' +
          '5. 📊 **ওয়েবসাইট ডেটা অনুসন্ধান**: জিজ্ঞেস করুন "আমাদের পণ্য কী কী?", "ক্যাম্পেইন তালিকা", "কর্মীরা কারা", "স্কোরিং কীভাবে কাজ করে"\n' +
          '6. 🚀 **অটো-নেভিগেশন**: ড্যাশবোর্ড, টার্গেট বণ্টন, অ্যাকশন প্ল্যান ইত্যাদি যেকোনো পেজে সরাসরি নিয়ে যাওয়া।',
        '🤖 **I am your Remote AI Assistant for this platform**!\n' +
          'I can execute actions, answer operational questions, and navigate anywhere:\n\n' +
          '1. 👤 **Create Employee Account**: e.g. `create an employee acount name: Rafiq pass: 123456`\n' +
          '2. 🔑 **Reset Passwords**: e.g. `set password of Rafiq to 654321`\n' +
          '3. 📅 **Date-Based Reports**: e.g. `yesterday report`, `today report`, `report of 25th`\n' +
          '4. 👥 **Customer Filtering**: e.g. `yesterday leads`, `last 7 days customers`\n' +
          '5. 📊 **Live Platform Q&A**: Ask "what products do we have?", "active campaigns", "who are our employees", "how does scoring work"\n' +
          '6. 🚀 **Direct Navigation**: Auto-navigate to any page (Dashboard, Targets, Action Plan, etc.).'
      ),
      suggestions: PAGES.filter((p) => ['team', 'groups', 'leads', 'manual', 'products', 'campaigns'].includes(p.id)),
    };
  }
  if (c.kind === 'greeting') {
    return { reply: say('হ্যালো! কী করতে চান লিখুন, আমি দেখিয়ে দেব।', 'Hello! Tell me what you want to do and I will show you how.') };
  }
  if (c.kind === 'thanks') {
    return { reply: say('আপনাকে স্বাগতম! আর কিছু লাগলে লিখুন।', "You're welcome! Ask me anything about the panel.") };
  }

  if (c.kind === 'none' || !c.topic) {
    // Maybe just a person's or section's name ("check Karim").
    const nameWords = message
      .split(/\s+/)
      .map(clean)
      .filter((w) => w && !FILLER.has(w.toLowerCase()) && !ALL_ACTION_WORDS.some((k) => wordScore(w.toLowerCase(), k) >= 2));
    for (const kind of ['employee', 'section'] as const) {
      const found = nameWords.length ? await findEntity(kind, nameWords.join(' ')) : null;
      if (found) {
        const href = kind === 'section' ? `/admin/sections/${found.id}` : `/admin/employees?q=${encodeURIComponent(found.label)}`;
        return {
          reply: say(`"${found.label}" পেয়েছি। পেজ খুলছি।`, `Found "${found.label}". Opening it.`),
          link: { href, labelBn: found.label, labelEn: found.label },
          navigate: true,
        };
      }
    }
    return {
      reply: say(
        '🤖 **আমি শুধুমাত্র এই বিজনেস প্ল্যাটফর্মের এআই সহকারী (Website AI Assistant)**।\n' +
          'আমি সাধারণ কোডিং (C++, Python), আবহাওয়া, রান্না বা বাইরের কোনো সাধারণ বিষয়ের উত্তর দিই না।\n\n' +
          '💡 তবে এই প্ল্যাটফর্মের **পণ্য ও সেলস টার্গেট**, **কর্মী**, **দৈনিক/মাসিক রিপোর্ট**, **টার্গেট**, **গ্রুপ লিংক** বা **কাস্টমার ডেটাবেস** সংক্রান্ত যেকোনো কাজ বা তথ্যের জন্য আমাকে জিজ্ঞেস করতে পারেন!',
        '🤖 **I am the dedicated AI assistant for this business platform**.\n' +
          'I do not answer general non-platform queries like coding (C++, Python), weather, cooking, or sports.\n\n' +
          '💡 However, I can help you with anything regarding our **product sales targets**, **employees**, **daily/monthly reports**, **targets**, **group links**, and **customer database**!'
      ),
      suggestions: PAGES.filter((p) => ['team', 'groups', 'leads', 'manual', 'products'].includes(p.id)),
    };
  }

  const topic = c.topic;
  const alternatives = c.others
    .filter((t) => t.href && t.href !== topic.href)
    .filter((t, i, arr) => arr.findIndex((x) => x.href === t.href) === i)
    .slice(0, 2)
    .map((t) => ({ href: t.href!, labelBn: t.pageBn, labelEn: t.pageEn }));

  const steps = formatSteps(bn ? topic.bn : topic.en);
  const explainOnly = (actions.has('what') || actions.has('how')) && !actions.has('add') && !actions.has('edit') && !actions.has('delete');

  if (!topic.href) return { reply: steps, suggestions: alternatives };

  let link: NavLink = { href: topic.href, labelBn: topic.pageBn, labelEn: topic.pageEn };
  let lead = say(`${topic.pageBn} পেজ খুলছি।`, `Opening ${topic.pageEn}.`);

  // Date-Aware Daily Report Routing & Live Stats
  if (topic.id === 'report_daily') {
    const dateInfo = extractDateFromQuery(message);
    const targetDateStr = dateInfo ? dateInfo.dateStr : getDhakaDateString();
    const summary = await getDailyReportSummary(targetDateStr);

    const dateTitleBn = dateInfo?.isYesterday
      ? `গতকালকের (${targetDateStr})`
      : dateInfo?.isToday
      ? `আজকের (${targetDateStr})`
      : `${targetDateStr} তারিখের`;

    const dateTitleEn = dateInfo?.isYesterday
      ? `Yesterday's (${targetDateStr})`
      : dateInfo?.isToday
      ? `Today's (${targetDateStr})`
      : `Daily (${targetDateStr})`;

    link = {
      href: `/admin/reports/daily?date=${targetDateStr}`,
      labelBn: `${dateTitleBn} রিপোর্ট`,
      labelEn: `${dateTitleEn} Report`,
    };

    const topEmpBn = summary.top_employee ? `• 🏆 সেরা পারফর্মার: ${summary.top_employee.name} (${summary.top_employee.score}/১০০)\n` : '';
    const topEmpEn = summary.top_employee ? `• 🏆 Top Performer: ${summary.top_employee.name} (${summary.top_employee.score}/100)\n` : '';

    lead = bn
      ? `📅 **${dateTitleBn} রিপোর্ট সারসংক্ষেপ**:\n` +
        `• 💰 মোট বিক্রি: ${formatTaka(summary.total_sales)}\n` +
        `• 📈 মোট লাভ: ${formatTaka(summary.total_profit)}\n` +
        `• 🎯 নতুন লিড: ${summary.new_leads} টি\n` +
        `• 📦 নিশ্চিত অর্ডার: ${summary.confirmed_orders} টি\n` +
        `• 📝 গ্রুপ পোস্ট: ${summary.total_posts} টি\n` +
        `• 👥 সক্রিয় কর্মী: ${summary.active_employees_count} জন\n` +
        topEmpBn +
        `• 📊 গড় স্কোর: ${summary.team_avg_score}/১০০ (${summary.passing_count} পাস, ${summary.failing_count} উন্নতি প্রয়োজন)\n\n` +
        `${dateTitleBn} বিস্তারিত রিপোর্ট পেজ খুলছি...`
      : `📅 **${dateTitleEn} Report Summary**:\n` +
        `• 💰 Total Sales: ${formatTaka(summary.total_sales, false)}\n` +
        `• 📈 Total Profit: ${formatTaka(summary.total_profit, false)}\n` +
        `• 🎯 New Leads: ${summary.new_leads}\n` +
        `• 📦 Confirmed Orders: ${summary.confirmed_orders}\n` +
        `• 📝 Group Posts: ${summary.total_posts}\n` +
        `• 👥 Active Employees: ${summary.active_employees_count}\n` +
        topEmpEn +
        `• 📊 Team Avg Score: ${summary.team_avg_score}/100 (${summary.passing_count} passed, ${summary.failing_count} needs improvement)\n\n` +
        `Opening ${dateTitleEn} full report page...`;
  }

  // Month-Aware Monthly Report Routing & Question-Back Clarification
  if (topic.id === 'report_monthly') {
    const monthInfo = extractMonthFromQuery(message);
    if (!monthInfo) {
      const todayStr = getDhakaDateString();
      const [curY, curM] = todayStr.split('-').map(Number);
      const curMonthStr = `${curY}-${String(curM).padStart(2, '0')}`;
      let prevM = curM - 1;
      let prevY = curY;
      if (prevM < 1) {
        prevM = 12;
        prevY -= 1;
      }
      const prevMonthStr = `${prevY}-${String(prevM).padStart(2, '0')}`;
      let twoM = curM - 2;
      let twoY = curY;
      if (twoM < 1) {
        twoM += 12;
        twoY -= 1;
      }
      const twoMonthStr = `${twoY}-${String(twoM).padStart(2, '0')}`;

      return {
        reply: bn
          ? `📅 **আপনি কোন মাস ও কোন বছরের মাসিক রিপোর্ট দেখতে চান?**\n` +
            `যেমন লিখুন: "October 2026", "অক্টোবর ২০২৬" বা "গত মাস"।\n\n` +
            `নিচের অপশনগুলো থেকেও সরাসরি বেছে নিতে পারেন:`
          : `📅 **Which month and year's report would you like to view?**\n` +
            `For example, type: "October 2026", "last month", or "2026-09".\n\n` +
            `You can also pick from the quick options below:`,
        suggestions: [
          {
            href: `/admin/reports/monthly?month=${curMonthStr}`,
            labelBn: `${BN_MONTHS[curM - 1]} ${toBengaliDigits(curY)} (চলতি মাস)`,
            labelEn: `${EN_MONTHS[curM - 1]} ${curY} (Current Month)`,
          },
          {
            href: `/admin/reports/monthly?month=${prevMonthStr}`,
            labelBn: `${BN_MONTHS[prevM - 1]} ${toBengaliDigits(prevY)} (গত মাস)`,
            labelEn: `${EN_MONTHS[prevM - 1]} ${prevY} (Last Month)`,
          },
          {
            href: `/admin/reports/monthly?month=${twoMonthStr}`,
            labelBn: `${BN_MONTHS[twoM - 1]} ${toBengaliDigits(twoY)} (২ মাস আগে)`,
            labelEn: `${EN_MONTHS[twoM - 1]} ${twoY} (2 Months Ago)`,
          },
        ],
        navigate: false,
      };
    }

    link = {
      href: `/admin/reports/monthly?month=${monthInfo.monthStr}`,
      labelBn: `${monthInfo.labelBn} রিপোর্ট`,
      labelEn: `${monthInfo.labelEn} Report`,
    };
    lead = bn
      ? `📅 **${monthInfo.labelBn} মাসিক রিপোর্ট পেজ খুলছি...**`
      : `📅 **Opening ${monthInfo.labelEn} monthly report page...**`;
  }

  // Clarification Question-Back for Employee Creation
  if (topic.id === 'add_employee' || (topic.id === 'team' && actions.has('add'))) {
    const hasNameOrPass = /(?:name|nam|নাম|pass|password|পাসওয়ার্ড|পাসওয়ার্ড)\s*[:=]/i.test(lower);
    if (!hasNameOrPass && !explainOnly) {
      return {
        reply: bn
          ? `👤 **নতুন কর্মী অ্যাকাউন্ট তৈরি করতে কিছু তথ্য প্রয়োজন:**\n` +
            `অনুগ্রহ করে কর্মীর নাম এবং একটি প্রাথমিক পাসওয়ার্ড দিন।\n\n` +
            `💡 যেমন লিখুন: \`create an employee acount name: Hasan pass: 123456\` অথবা \`কর্মী বানাও নাম: রফিক পাস: 123456\`\n\n` +
            `অথবা সরাসরি কর্মী ব্যবস্থাপনা পেজে গিয়ে ফর্ম পূরণ করতে পারেন:`
          : `👤 **To create a new employee account, more details are needed:**\n` +
            `Please provide the employee's name and temporary password.\n\n` +
            `💡 For example, type: \`create an employee acount name: Hasan pass: 123456\`\n\n` +
            `Or you can directly fill out the form on the employee management page:`,
        link: { href: '/admin/employees?add=1', labelBn: 'কর্মী ব্যবস্থাপনা পেজ', labelEn: 'Employee Management Page' },
        navigate: false,
      };
    }
  }

  // Clarification Question-Back for Password Reset
  if (topic.id === 'team_password' || (topic.id === 'team' && /(?:password|pass|পাসওয়ার্ড)/i.test(lower))) {
    const hasDetails = /(?:of|for|to|এর|দাও)\s+[^\s:]+/i.test(lower);
    if (!hasDetails && !explainOnly) {
      return {
        reply: bn
          ? `🔑 **পাসওয়ার্ড পরিবর্তন করতে কর্মীর নাম ও নতুন পাসওয়ার্ড উল্লেখ করুন:**\n\n` +
            `💡 যেমন লিখুন: \`set password of Rafiq to 654321\` অথবা \`রফিকের পাসওয়ার্ড দাও 123456\`\n\n` +
            `অথবা কর্মী পেজে গিয়ে যেকোনো কর্মীর পাশে রিসেট পাসওয়ার্ড চাপুন:`
          : `🔑 **To reset an employee's password, please specify the details:**\n\n` +
            `💡 For example, type: \`set password of Rafiq to 654321\`\n\n` +
            `Or navigate to the employees page and click reset password next to their name:`,
        link: { href: '/admin/employees', labelBn: 'কর্মী তালিকা', labelEn: 'Employee List' },
        navigate: false,
      };
    }
  }

  // Date-Aware Customer / Leads Routing
  if (topic.id === 'lead_stage' || topic.id === 'add_lead' || topic.href === '/admin/leads') {
    const dateInfo = extractDateFromQuery(message);
    if (dateInfo) {
      if (dateInfo.isToday) {
        link = {
          href: '/admin/leads?period=1d',
          labelBn: 'আজকের কাস্টমার তালিকা',
          labelEn: "Today's Customer List",
        };
        lead = say('আজকের কাস্টমার তালিকা খুলছি।', "Opening today's customer list.");
      } else {
        link = {
          href: `/admin/leads?period=custom&startDate=${dateInfo.dateStr}&endDate=${dateInfo.dateStr}`,
          labelBn: `${dateInfo.labelBn} কাস্টমার তালিকা`,
          labelEn: `${dateInfo.labelEn} Customer List`,
        };
        lead = say(`${dateInfo.labelBn} কাস্টমার তালিকা খুলছি।`, `Opening ${dateInfo.labelEn} customer list.`);
      }
    } else if (/(?:7\s*(?:din|দিন|days?)|week|shoptaho|সপ্তাহ)/i.test(lower)) {
      link = {
        href: '/admin/leads?period=7d',
        labelBn: 'গত ৭ দিনের কাস্টমার তালিকা',
        labelEn: 'Last 7 Days Customers',
      };
      lead = say('গত ৭ দিনের কাস্টমার তালিকা খুলছি।', 'Opening last 7 days customer list.');
    } else if (/(?:3\s*(?:din|দিন|days?))/i.test(lower)) {
      link = {
        href: '/admin/leads?period=3d',
        labelBn: 'গত ৩ দিনের কাস্টমার তালিকা',
        labelEn: 'Last 3 Days Customers',
      };
      lead = say('গত ৩ দিনের কাস্টমার তালিকা খুলছি।', 'Opening last 3 days customer list.');
    } else if (/(?:30\s*(?:din|দিন|days?)|month|mas|মাস)/i.test(lower)) {
      link = {
        href: '/admin/leads?period=30d',
        labelBn: 'গত ৩০ দিনের কাস্টমার তালিকা',
        labelEn: 'Last 30 Days Customers',
      };
      lead = say('গত ৩০ দিনের কাস্টমার তালিকা খুলছি।', 'Opening last 30 days customer list.');
    }
  }

  // These pages open their add form from ?add=1.
  if (!topic.deep && actions.has('add') && ['add_product', 'add_lead', 'add_campaign', 'plan_task'].includes(topic.id)) {
    link = { href: `${topic.href}?add=1`, labelBn: `${topic.pageBn}: নতুন`, labelEn: `${topic.pageEn}: Add` };
    lead = say('যোগ করার ফর্ম খুলছি।', 'Opening the add form.');
  }

  if (topic.deep) {
    const name = c.name;
    const found = await findEntity(topic.deep, name);
    if (found && !actions.has('add')) {
      const href = topic.deep === 'section' ? `/admin/sections/${found.id}` : `${topic.href}?q=${encodeURIComponent(found.label)}`;
      link = { href, labelBn: found.label, labelEn: found.label };
      lead = say(`"${found.label}" পেয়েছি, খুলছি।`, `Found "${found.label}", opening it.`);
    } else if (actions.has('add') && (topic.id === 'add_employee' || topic.id === 'add_section')) {
      link = { href: `${topic.href}?add=1${name ? `&name=${encodeURIComponent(name)}` : ''}`, labelBn: `${topic.pageBn}: নতুন`, labelEn: `${topic.pageEn}: Add` };
      lead = name
        ? say(`যোগ করার ফর্ম খুলছি, "${name}" লেখা থাকবে।`, `Opening the add form with "${name}" filled in.`)
        : say('যোগ করার ফর্ম খুলছি।', 'Opening the add form.');
    } else if (name && !explainOnly) {
      link = { href: `${topic.href}?q=${encodeURIComponent(name)}`, labelBn: topic.pageBn, labelEn: topic.pageEn };
      lead = say(`"${name}" নামে কিছু পাইনি; ${topic.pageBn} পেজে খুঁজে দেখুন।`, `No match for "${name}"; opening ${topic.pageEn} so you can search.`);
    }
  }

  return {
    reply: explainOnly ? `${steps}\n\n${say('নিচের বাটনে চাপলে পেজটি খুলবে।', 'Tap the button below to open the page.')}` : `${lead}\n${steps}`,
    link,
    suggestions: alternatives,
    navigate: !explainOnly,
  };
}
