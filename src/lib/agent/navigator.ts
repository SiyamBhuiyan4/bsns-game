// Offline assistant for the admin panel (no AI service, no API key).
// It reads the admin's message, works out the action (add / edit / delete / view / how / what)
// and the subject, finds the matching topic in knowledge.ts, answers with the steps and opens
// the page. Anything outside the panel is politely declined.

import prisma from '@/lib/prisma';
import { normalizeText } from './router';
import { ACTION_WORDS, FILLER, PAGES, TOPICS, WEAK, type Action, type Topic } from './knowledge';

export type NavLink = { href: string; labelBn: string; labelEn: string };
export type NavResult = { reply: string; link?: NavLink; suggestions?: NavLink[]; navigate?: boolean };

/** Kept for the teach page: every page the assistant can open. */
export const INTENTS = PAGES;

const BANGLA = /[ঀ-৿]/;
const ALL_ACTION_WORDS = Object.values(ACTION_WORDS).flat();
const ALL_SUBJECT_WORDS = [...new Set(TOPICS.flatMap((t) => t.keywords))];

function tokens(text: string): string[] {
  // \p{M} keeps Bangla vowel signs and virama inside words.
  return normalizeText(text).toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
}

/** Edit distance, used to forgive small English typos (emplyee, grup, reprot). */
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** How well one word matches one keyword: 3 exact, 2 typo/inflection, 0 none. */
function wordScore(word: string, key: string): number {
  if (word === key) return 3;
  // Bangla suffixes (কর্মীর, গ্রুপগুলো) and English forms (adding, groups).
  if (key.length >= 3 && word.startsWith(key)) return 2;
  if (word.length >= 4 && key.startsWith(word)) return 2;
  if (!BANGLA.test(word) && word.length >= 4 && key.length >= 4 && distance(word, key) <= 1) return 2;
  return 0;
}

function detectActions(words: string[]): Set<Action> {
  const found = new Set<Action>();
  for (const [action, list] of Object.entries(ACTION_WORDS) as [Action, string[]][]) {
    if (words.some((w) => list.some((k) => wordScore(w, k) >= 2))) found.add(action);
  }
  return found;
}

function scoreTopic(words: string[], topic: Topic, actions: Set<Action>): number {
  if (topic.requires && !words.some((w) => topic.requires!.some((k) => wordScore(w, k) >= 2))) return 0;
  let subject = 0;
  for (const w of words) {
    if (FILLER.has(w)) continue;
    let best = 0;
    for (const k of topic.keywords) best = Math.max(best, wordScore(w, k));
    subject += best > 0 && WEAK.has(w) ? 1 : best;
  }
  if (subject === 0) return 0; // must mention the subject
  const actionBonus = topic.actions.some((a) => actions.has(a)) ? 3 : 0;
  return subject + actionBonus;
}

const clean = (raw: string) => raw.replace(/[?!.,।"'“”]/g, '');

/** Words that are not filler, action or subject words: treated as a name ("Rahim", "Dhaka Farmers"). */
function extractName(message: string, topic: Topic): string {
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

export async function navigate(message: string): Promise<NavResult> {
  const bn = BANGLA.test(message);
  const say = (b: string, e: string) => (bn ? b : e);
  const lower = normalizeText(message).toLowerCase().trim();
  const words = tokens(message);

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

  // 2. Small talk.
  if (CAPABILITY.some((p) => lower.includes(p))) {
    return {
      reply: say(
        'আমি এই অ্যাডমিন প্যানেলের সহকারী। কোন কাজ কীভাবে করবেন বলে দিই এবং সঠিক পেজ খুলে দিই। যেমন লিখুন: "নতুন কর্মী যোগ করব কীভাবে?", "গ্রুপে লিংক যোগ", "আজকের রিপোর্ট দেখাও"।',
        'I am the assistant for this admin panel. I explain how to do things and open the right page. Try: "how do I add an employee?", "add links to a group", "show today\'s report".'
      ),
      suggestions: PAGES.filter((p) => ['team', 'groups', 'leads', 'manual'].includes(p.id)),
    };
  }
  const meaningful = words.filter((w) => !FILLER.has(w));
  if (words.length && words.every((w) => GREETING.includes(w) || FILLER.has(w))) {
    return { reply: say('হ্যালো! কী করতে চান লিখুন, আমি দেখিয়ে দেব।', 'Hello! Tell me what you want to do and I will show you how.') };
  }
  if (meaningful.length && meaningful.every((w) => THANKS.includes(w))) {
    return { reply: say('আপনাকে স্বাগতম! আর কিছু লাগলে লিখুন।', "You're welcome! Ask me anything about the panel.") };
  }

  // 3. Match a topic.
  const actions = detectActions(words);
  const ranked = TOPICS.map((t) => ({ t, s: scoreTopic(words, t, actions) }))
    .filter((r) => r.s >= 3)
    .sort((a, b) => b.s - a.s);

  if (!ranked.length) {
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

  const topic = ranked[0].t;
  const alternatives = ranked
    .slice(1)
    .filter((r) => r.t.href && r.t.href !== topic.href)
    .filter((r, i, arr) => arr.findIndex((x) => x.t.href === r.t.href) === i)
    .slice(0, 2)
    .map((r) => ({ href: r.t.href!, labelBn: r.t.pageBn, labelEn: r.t.pageEn }));

  const steps = formatSteps(bn ? topic.bn : topic.en);
  const explainOnly = (actions.has('what') || actions.has('how')) && !actions.has('add') && !actions.has('edit') && !actions.has('delete');

  if (!topic.href) return { reply: steps, suggestions: alternatives };

  let link: NavLink = { href: topic.href, labelBn: topic.pageBn, labelEn: topic.pageEn };
  let lead = say(`${topic.pageBn} পেজ খুলছি।`, `Opening ${topic.pageEn}.`);

  if (topic.deep) {
    const name = extractName(message, topic);
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
