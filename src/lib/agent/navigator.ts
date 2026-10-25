// Offline assistant: understands plain Bangla/English requests by matching them against a
// built-in map of the admin panel, then sends the admin to the right page (no AI service needed).
// Admins can teach new phrases from /admin/assistant; those are checked first.

import prisma from '@/lib/prisma';
import { normalizeText } from './router';

export type NavLink = { href: string; labelBn: string; labelEn: string };
export type NavResult = { reply: string; link?: NavLink; suggestions?: NavLink[] };

type Intent = {
  id: string;
  href: string;
  labelBn: string;
  labelEn: string;
  /** Words that point to this page. */
  topic: string[];
  /** Extra hint shown with the link. */
  hintBn: string;
  hintEn: string;
  /** Page supports ?add=1 / ?q= / ?name= (see employees and sections pages). */
  deepLinks?: boolean;
  entity?: 'employee' | 'section';
};

const ADD_WORDS = ['add', 'new', 'create', 'make', 'যোগ', 'যুক্ত', 'নতুন', 'তৈরি', 'বানাও', 'খোলো', 'অ্যাড', 'এড'];
const FIND_WORDS = ['check', 'show', 'see', 'find', 'search', 'status', 'state', 'performance', 'view', 'দেখাও', 'দেখ', 'খুঁজ', 'অবস্থা', 'পারফরম্যান্স', 'চেক'];
const EDIT_WORDS = ['edit', 'change', 'update', 'modify', 'rename', 'reset', 'এডিট', 'পরিবর্তন', 'বদল', 'আপডেট', 'ঠিক'];

export const INTENTS: Intent[] = [
  { id: 'dashboard', href: '/admin/dashboard', labelBn: 'ড্যাশবোর্ড', labelEn: 'Dashboard',
    topic: ['dashboard', 'home', 'overview', 'summary', 'ড্যাশবোর্ড', 'হোম', 'সারাংশ', 'মূল'],
    hintBn: 'সব সংখ্যা এক জায়গায়।', hintEn: 'All key numbers in one place.' },
  { id: 'team', href: '/admin/employees', labelBn: 'টিম', labelEn: 'Team', deepLinks: true, entity: 'employee',
    topic: ['employee', 'employees', 'staff', 'team', 'member', 'worker', 'user', 'marketer', 'password', 'performance', 'পারফরম্যান্স', 'কর্মী', 'টিম', 'স্টাফ', 'সদস্য', 'মার্কেটার', 'ইউজার', 'পাসওয়ার্ড'],
    hintBn: 'কর্মী যোগ, এডিট, পাসওয়ার্ড রিসেট ও সেকশন বরাদ্দ এখানে।', hintEn: 'Add, edit, reset passwords and assign sections here.' },
  { id: 'groups', href: '/admin/sections', labelBn: 'গ্রুপ / সেকশন', labelEn: 'Groups', deepLinks: true, entity: 'section',
    topic: ['group', 'groups', 'section', 'sections', 'link', 'links', 'facebook', 'csv', 'upload', 'গ্রুপ', 'সেকশন', 'লিংক', 'ফেসবুক', 'আপলোড'],
    hintBn: 'সেকশন তৈরি, লিংক যোগ ও CSV আপলোড এখানে।', hintEn: 'Create sections, add links and upload CSV here.' },
  { id: 'uploads', href: '/admin/csv/history', labelBn: 'আপলোড ইতিহাস', labelEn: 'Upload History',
    topic: ['uploads', 'import', 'imported', 'ইতিহাস', 'হিস্ট্রি'],
    hintBn: 'আগের CSV আপলোডের ফলাফল।', hintEn: 'Results of past CSV uploads.' },
  { id: 'products', href: '/admin/products', labelBn: 'পণ্য', labelEn: 'Products',
    topic: ['product', 'products', 'item', 'price', 'mushroom', 'পণ্য', 'প্রোডাক্ট', 'দাম', 'মাশরুম'],
    hintBn: 'পণ্য যোগ ও দাম পরিবর্তন এখানে।', hintEn: 'Add products and change prices here.' },
  { id: 'campaigns', href: '/admin/campaigns', labelBn: 'ক্যাম্পেইন', labelEn: 'Campaigns',
    topic: ['campaign', 'campaigns', 'ad', 'ads', 'boost', 'roas', 'ক্যাম্পেইন', 'বিজ্ঞাপন', 'অ্যাড', 'বুস্ট'],
    hintBn: 'ক্যাম্পেইন ও খরচের হিসাব।', hintEn: 'Campaigns and their spend.' },
  { id: 'leads', href: '/admin/leads', labelBn: 'লিড', labelEn: 'Leads',
    topic: ['lead', 'leads', 'customer', 'buyer', 'client', 'followup', 'follow', 'pipeline', 'লিড', 'কাস্টমার', 'ক্রেতা', 'ক্লায়েন্ট', 'ফলোআপ', 'ফলো'],
    hintBn: 'লিডের অবস্থা ও ফলো-আপ।', hintEn: 'Lead status and follow-ups.' },
  { id: 'targets', href: '/admin/targets', labelBn: 'টার্গেট ও বাজেট', labelEn: 'Targets & Budget',
    topic: ['target', 'targets', 'goal', 'budget', 'limit', 'টার্গেট', 'লক্ষ্য', 'বাজেট', 'সীমা'],
    hintBn: 'মাসিক টার্গেট ও বাজেট সেট করুন।', hintEn: 'Set monthly targets and budgets.' },
  { id: 'report_daily', href: '/admin/reports/daily', labelBn: 'দৈনিক রিপোর্ট', labelEn: 'Daily Report',
    topic: ['daily', 'today', 'report', 'sales', 'দৈনিক', 'আজ', 'আজকের', 'রিপোর্ট', 'বিক্রি', 'সেল'],
    hintBn: 'আজকের কাজ ও বিক্রি।', hintEn: "Today's work and sales." },
  { id: 'report_weekly', href: '/admin/reports/weekly', labelBn: 'সাপ্তাহিক রিপোর্ট', labelEn: 'Weekly Report',
    topic: ['weekly', 'week', 'সাপ্তাহিক', 'সপ্তাহ'],
    hintBn: 'সপ্তাহের রিপোর্ট ও প্রশ্নোত্তর।', hintEn: 'The weekly report and review answers.' },
  { id: 'report_monthly', href: '/admin/reports/monthly', labelBn: 'মাসিক রিপোর্ট', labelEn: 'Monthly Report',
    topic: ['monthly', 'month', 'মাসিক', 'মাস'],
    hintBn: 'মাসের সারাংশ ও পরের মাসের লক্ষ্য।', hintEn: 'Month summary and next month goals.' },
  { id: 'plan', href: '/admin/plan', labelBn: '৯০ দিনের প্ল্যান', labelEn: '90-Day Plan',
    topic: ['plan', 'planning', 'task', 'tasks', 'milestone', '90', 'প্ল্যান', 'পরিকল্পনা', 'কাজ', 'টাস্ক', '৯০'],
    hintBn: 'ধাপ, কাজ ও মাইলস্টোন।', hintEn: 'Phases, tasks and milestones.' },
  { id: 'settings', href: '/admin/settings', labelBn: 'সেটিংস', labelEn: 'Settings',
    topic: ['setting', 'settings', 'score', 'scoring', 'weight', 'undo', 'সেটিংস', 'স্কোর', 'ওজন'],
    hintBn: 'স্কোরিং ও সিস্টেম সেটিংস।', hintEn: 'Scoring and system settings.' },
  { id: 'audit', href: '/admin/audit', labelBn: 'অডিট লগ', labelEn: 'Audit Log',
    topic: ['audit', 'log', 'logs', 'activity', 'who', 'deleted', 'removed', 'history', 'অডিট', 'লগ', 'কে', 'মুছেছে', 'ডিলিট'],
    hintBn: 'কে কখন কী করেছে।', hintEn: 'Who did what, and when.' },
  { id: 'manual', href: '/admin/manual', labelBn: 'নির্দেশিকা', labelEn: 'Manual',
    topic: ['manual', 'help', 'guide', 'how', 'tutorial', 'নির্দেশিকা', 'সাহায্য', 'গাইড', 'কিভাবে', 'কীভাবে'],
    hintBn: 'কীভাবে সব কাজ করবেন।', hintEn: 'How everything works.' },
  { id: 'assistant', href: '/admin/assistant', labelBn: 'সহকারী শেখান', labelEn: 'Teach Assistant',
    topic: ['teach', 'train', 'assistant', 'শেখাও', 'শেখান', 'ট্রেনিং', 'সহকারী'],
    hintBn: 'নতুন বাক্য শেখান।', hintEn: 'Teach new phrases.' },
];

function tokens(text: string): string[] {
  return normalizeText(text).toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
}

function hasAny(words: string[], list: string[]): boolean {
  return words.some((w) => list.some((k) => w === k || (k.length >= 3 && w.startsWith(k))));
}

function scoreIntent(words: string[], intent: Intent): number {
  let score = 0;
  for (const w of words) {
    for (const k of intent.topic) {
      if (w === k) score += 3;
      else if (k.length >= 3 && (w.startsWith(k) || k.startsWith(w)) && w.length >= 3) score += 1;
    }
  }
  return score;
}

const toLink = (i: Intent): NavLink => ({ href: i.href, labelBn: i.labelBn, labelEn: i.labelEn });

/** Words left after removing action/topic words: used as the employee or section name. */
function leftoverName(message: string, intent: Intent): string {
  const skip = new Set([...ADD_WORDS, ...FIND_WORDS, ...EDIT_WORDS, ...intent.topic,
    'a', 'an', 'the', 'of', 'for', 'to', 'please', 'can', 'you', 'i', 'want', 'called', 'named', 'name', 'me', 'my',
    'how', 'do', 'does', 'what', 'where', 'is', 'are', 'in', 'on', 'with', 'and', 'kivabe', 'কীভাবে', 'কিভাবে', 'কোথায়', 'কি', 'কী', 'চাই', 'করতে', 'আমি',
    'এর', 'একটা', 'একটি', 'নামে', 'নাম', 'করো', 'করুন', 'কর', 'দাও', 'দিন', 'আমাকে', 'প্লিজ', 'টা', 'টি']);
  return message.split(/\s+/).filter((w) => w && !skip.has(normalizeText(w).toLowerCase())).join(' ').trim();
}

async function matchEntity(intent: Intent, name: string): Promise<{ id: string; label: string } | null> {
  if (!name) return null;
  const needle = name.toLowerCase();
  if (intent.entity === 'employee') {
    const people = await prisma.user.findMany({ where: { role: 'EMPLOYEE' }, select: { id: true, name: true, email: true } });
    const hit = people.find((p) => p.name.toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle));
    return hit ? { id: hit.id, label: hit.name } : null;
  }
  if (intent.entity === 'section') {
    const sections = await prisma.groupSection.findMany({ select: { id: true, name: true } });
    const hit = sections.find((s) => s.name.toLowerCase().includes(needle));
    return hit ? { id: hit.id, label: hit.name } : null;
  }
  return null;
}

export async function navigate(message: string): Promise<NavResult> {
  const words = tokens(message);
  const lower = normalizeText(message).toLowerCase().trim();

  // 1. Phrases the admin has taught (exact or contained match wins).
  const taught = await prisma.agentPhrase.findMany({});
  const learned = taught
    .filter((t) => lower === String(t.phrase).toLowerCase() || lower.includes(String(t.phrase).toLowerCase()))
    .sort((a, b) => String(b.phrase).length - String(a.phrase).length)[0];
  if (learned) {
    return {
      reply: `"${learned.phrase}" — শেখানো বাক্য অনুযায়ী খুলছি।\nOpening the page you taught for this phrase.`,
      link: { href: String(learned.href), labelBn: String(learned.label), labelEn: String(learned.label) },
    };
  }

  // 2. Built-in map.
  const ranked = INTENTS.map((i) => ({ i, s: scoreIntent(words, i) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s);

  if (!ranked.length) {
    // No page word: maybe the admin named a person or a section ("check Karim").
    for (const id of ['team', 'groups'] as const) {
      const intent = INTENTS.find((i) => i.id === id)!;
      const name = leftoverName(message, intent);
      const found = name ? await matchEntity(intent, name) : null;
      if (found) {
        const href = id === 'groups' ? `/admin/sections/${found.id}` : `${intent.href}?q=${encodeURIComponent(found.label)}`;
        return {
          reply: `"${found.label}" খুঁজে পেয়েছি। পেজ খুলছি।\nFound "${found.label}". Opening its page.`,
          link: { href, labelBn: found.label, labelEn: found.label },
        };
      }
    }
    return {
      reply:
        'বুঝতে পারিনি। নিচের কোনো পেজ খুলবেন? অথবা "সহকারী শেখান" পেজে এই বাক্যটি শিখিয়ে দিন।\n' +
        "I didn't understand. Pick a page below, or teach me this phrase on the Teach Assistant page.",
      suggestions: INTENTS.filter((i) => ['team', 'groups', 'leads', 'report_daily', 'manual', 'assistant'].includes(i.id)).map(toLink),
    };
  }

  const intent = ranked[0].i;
  const wantsAdd = hasAny(words, ADD_WORDS);
  const wantsEdit = hasAny(words, EDIT_WORDS);
  const name = leftoverName(message, intent);
  const others = ranked.slice(1, 3).map((r) => toLink(r.i));

  if (intent.deepLinks && intent.entity) {
    const found = await matchEntity(intent, name);
    if (wantsAdd && !found) {
      const href = `${intent.href}?add=1${name ? `&name=${encodeURIComponent(name)}` : ''}`;
      return {
        reply: `${intent.labelBn} পেজে যোগ করার ফর্ম খুলছি${name ? ` ("${name}" লেখা থাকবে)` : ''}। ফর্ম পূরণ করে সেভ করুন।\n` +
          `Opening the add form on ${intent.labelEn}${name ? ` with "${name}" filled in` : ''}. Fill it in and save.`,
        link: { href, labelBn: `${intent.labelBn}: নতুন`, labelEn: `${intent.labelEn}: Add new` },
        suggestions: others,
      };
    }
    if (found) {
      const href = intent.entity === 'section' ? `/admin/sections/${found.id}` : `${intent.href}?q=${encodeURIComponent(found.label)}`;
      const action = wantsEdit ? 'এডিট বাটনে চাপ দিন / click Edit' : 'বিস্তারিত দেখুন / see the details';
      return {
        reply: `"${found.label}" খুঁজে পেয়েছি। পেজ খুলছি, ${action}.\nFound "${found.label}". Opening its page.`,
        link: { href, labelBn: found.label, labelEn: found.label },
        suggestions: others,
      };
    }
    if (name && !wantsAdd) {
      return {
        reply: `"${name}" নামে কিছু পাইনি। ${intent.labelBn} পেজে খুঁজে দেখুন।\nNo match for "${name}". Opening ${intent.labelEn} so you can search.`,
        link: { href: `${intent.href}?q=${encodeURIComponent(name)}`, labelBn: intent.labelBn, labelEn: intent.labelEn },
        suggestions: others,
      };
    }
  }

  return {
    reply: `${intent.labelBn} খুলছি। ${intent.hintBn}\nOpening ${intent.labelEn}. ${intent.hintEn}`,
    link: toLink(intent),
    suggestions: others,
  };
}
