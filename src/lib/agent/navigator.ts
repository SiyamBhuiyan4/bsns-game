// Offline assistant for the admin panel (no AI service, no API key).
// It reads the admin's message, works out the action (add / edit / delete / view / how / what)
// and the subject, finds the matching topic in knowledge.ts, answers with the steps and opens
// the page. Anything outside the panel is politely declined.

import prisma from '@/lib/prisma';
import { normalizeText } from './router';
import { ACTION_WORDS, FILLER, OFF_TOPIC, PAGES, TOPICS, WEAK, type Action, type Topic } from './knowledge';

export type NavLink = { href: string; labelBn: string; labelEn: string };
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
  if (!phraseHitEarly && topic.requires && !words.some((w) => topic.requires!.some((k) => wordScore(w, k) >= 2))) return 0;
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
  return message
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
const CAPABILITY = ['what can you do', 'who are you', 'তুমি কে', 'কী করতে পারো', 'কি করতে পারো', 'কী কী পারো', 'কি কি পারো'];

const WHO = ['who', 'কে', 'ke', 'kara', 'কারা'];
const CHANGED = ['changed', 'deleted', 'removed', 'edited', 'updated', 'বদলেছে', 'মুছেছে', 'মুছে', 'ডিলিট', 'পরিবর্তন', 'korse', 'korsilo', 'korechhe', 'koreche'];

function isWhoChanged(words: string[]): boolean {
  if (!words.some((w) => WHO.includes(w))) return false;
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

  const ranked = TOPICS.map((t) => ({ t, s: scoreTopic(words, t, actions, lower) }))
    .filter((r) => r.s >= 3)
    .sort((a, b) => b.s - a.s);

  // "Who changed / deleted X?" is always an audit-log question.
  if (isWhoChanged(words)) {
    const audit = TOPICS.find((t) => t.id === 'audit')!;
    return { kind: 'topic', topic: audit, others: ranked.map((r) => r.t).filter((t) => t !== audit), actions, name: '' };
  }
  if (!ranked.length) return { ...base, kind: 'none' };
  // Clearly outside the panel ("weekly football schedule", "dollar rate") unless the match is very strong.
  if (words.some((w) => OFF_TOPIC.has(w)) && ranked[0].s < 10) return { ...base, kind: 'none' };
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
  if (c.kind === 'capability') {
    return {
      reply: say(
        'আমি এই অ্যাডমিন প্যানেলের সহকারী। কোন কাজ কীভাবে করবেন বলে দিই এবং সঠিক পেজ খুলে দিই। যেমন লিখুন: "নতুন কর্মী যোগ করব কীভাবে?", "গ্রুপে লিংক যোগ", "আজকের রিপোর্ট দেখাও"।',
        'I am the assistant for this admin panel. I explain how to do things and open the right page. Try: "how do I add an employee?", "add links to a group", "show today\'s report".'
      ),
      suggestions: PAGES.filter((p) => ['team', 'groups', 'leads', 'manual'].includes(p.id)),
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
        'দুঃখিত, এটা আমি জানি না। আমার জ্ঞান শুধু এই অ্যাডমিন প্যানেল নিয়ে, তাই এর উত্তর দিতে পারছি না। প্যানেলের কোনো কাজ নিয়ে জিজ্ঞেস করুন, যেমন "কর্মী যোগ করব কীভাবে?"',
        "Sorry, I don't know about that. I have limited knowledge (only this admin panel), so I'm not sure how to answer it. Ask me about something in the panel, for example \"how do I add an employee?\""
      ),
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

  // These pages open their add form from ?add=1.
  if (!topic.deep && actions.has('add') && ['add_product', 'add_lead', 'add_campaign'].includes(topic.id)) {
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
