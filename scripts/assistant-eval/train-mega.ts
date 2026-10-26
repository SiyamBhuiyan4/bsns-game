// scripts/assistant-eval/train-mega.ts
// Massive permutation training script for the admin & employee assistant.
// Generates ~1,000,000 synthetic combinations of natural queries across all system pages,
// streaming examples directly into Naive Bayes n-gram feature counts to avoid V8 memory limits.
//
// Usage:
//   npx tsx scripts/assistant-eval/train-mega.ts [--count=1000000] [--holdout=exam4.json] [--out=src/lib/agent/model.json]
//   npx tsx scripts/assistant-eval/train-mega.ts --count=100000 --dry-run

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { features } from '../../src/lib/agent/classifier';

export type Lang = 'en' | 'bn' | 'bl';

interface MegaIntent {
  label: string; // The target page path or 'ANSWER' / 'DECLINE'
  nameType?: 'employee' | 'section';
  verbs: Record<Lang, string[]>;
  objects: Record<Lang, string[]>;
  directPhrases: Record<Lang, string[]>;
}

// ---------------------------------------------------------------------------
// 1. Comprehensive Intent Definitions Covering All Web System Pages
// ---------------------------------------------------------------------------

export const MEGA_INTENTS: MegaIntent[] = [
  // ------------------------- ADMIN PAGES -------------------------
  // 1. Dashboard
  {
    label: '/admin/dashboard',
    verbs: {
      en: ['open', 'show', 'view', 'go to', 'take me to', 'see', 'check', 'visit', 'display', 'load'],
      bn: ['খোলো', 'দেখাও', 'দেখতে চাই', 'নিয়ে যাও', 'যাব', 'বের করো', 'প্রদর্শন করো'],
      bl: ['kholo', 'dekhao', 'dekhte chai', 'niye jao', 'jao', 'open koro', 'visit koro'],
    },
    objects: {
      en: ['dashboard', 'admin dashboard', 'the overview', 'home page', 'main summary', 'business snapshot', 'overall stats', 'main screen', 'control panel home'],
      bn: ['ড্যাশবোর্ড', 'অ্যাডমিন ড্যাশবোর্ড', 'মূল পাতা', 'হোম পেজ', 'সার্বিক চিত্র', 'ওভারভিউ', 'ব্যবসার সারাংশ', 'প্রধান স্ক্রিন'],
      bl: ['dashboard', 'admin dashboard', 'overview', 'home page', 'main page', 'summary screen', 'snapshot', 'business stats', 'front page'],
    },
    directPhrases: {
      en: ['open dashboard', 'show me the home overview', 'admin dashboard page', 'take me to main dashboard', 'business summary at a glance', 'how is business doing', 'business health overview', 'system status today'],
      bn: ['ড্যাশবোর্ড পেজ খোলো', 'এক নজরে ব্যবসার চিত্র দেখাও', 'হোম পেজে নিয়ে যাও', 'অ্যাডমিন ওভারভিউ দেখতে চাই', 'মূল পাতা ওপেন করো', 'আজকের ব্যবসার কী অবস্থা', 'ব্যবসার সার্বিক খবর'],
      bl: ['dashboard kholo', 'overview dekhte chai', 'admin home page e niye jao', 'main summary dekhao', 'dashboard e jabo', 'ki obostha', 'business kemon choltese', 'ajker business kemon'],
    },
  },

  // 2. Employees (Team) - Add, Edit, View, Password, Section assignment
  {
    label: '/admin/employees',
    nameType: 'employee',
    verbs: {
      en: ['add', 'create', 'register', 'onboard', 'edit', 'change', 'update', 'modify', 'reset password of', 'assign section to', 'show', 'view', 'list', 'check'],
      bn: ['যোগ করো', 'তৈরি করো', 'যুক্ত করো', 'নতুন বানাও', 'এডিট করো', 'পরিবর্তন করো', 'আপডেট করো', 'পাসওয়ার্ড রিসেট করো', 'সেকশন বরাদ্দ দাও', 'দেখাও', 'তালিকা দাও'],
      bl: ['add koro', 'create koro', 'jog koro', 'notun banao', 'edit koro', 'change koro', 'update koro', 'password reset koro', 'section assign koro', 'dekhao', 'list dekhte chai'],
    },
    objects: {
      en: ['an employee', 'new staff member', 'marketer', 'team member', 'worker', 'employee profile', 'staff details', 'employee list', 'all employees', 'team roster', 'worker password', 'grant customer access', 'can view all customers permission', 'full customer database view toggle'],
      bn: ['কর্মী', 'নতুন কর্মী', 'স্টাফ', 'টিম মেম্বার', 'মার্কেটার', 'কর্মচারী', 'কর্মী প্রোফাইল', 'কর্মীর ফোন নম্বর', 'কর্মীর ইমেইল', 'কর্মীর পাসওয়ার্ড', 'কর্মীদের তালিকা', 'সব কর্মী', 'সম্পূর্ণ কাস্টমার ডেটাবেস দেখার অনুমতি', 'কাস্টমার ডেটা দেখার পারমিশন'],
      bl: ['kormi', 'notun kormi', 'staff', 'team member', 'marketer', 'employee', 'employee profile', 'kormi profile', 'nam er employee profile', 'namer employee', 'kormir phone number', 'kormir info', 'kormir password', 'kormider list', 'sob employee', 'customer database access', 'sob customer dekhar permission'],
    },
    directPhrases: {
      en: ['open employee page', 'manage staff members', 'team management', 'add new staff', 'employee roster list', 'reset staff password', 'grant full customer database access', 'set employee password to', 'create employee profile', 'make employee profile'],
      bn: ['টিম পেজ খোলো', 'কর্মী ব্যবস্থাপনা পেজ', 'নতুন কর্মী যোগ করার ফর্ম', 'টিম মেম্বারদের তালিকা দেখাও', 'কর্মীর পাসওয়ার্ড বদলাও', 'কর্মীকে সম্পূর্ণ কাস্টমার দেখার অনুমতি দাও', 'কর্মীর পাসওয়ার্ড রিসেট করো', 'কর্মী প্রোফাইল বানাও', 'নতুন কর্মীর প্রোফাইল তৈরি করো'],
      bl: ['employee page e jao', 'team page kholo', 'notun kormi add korte chai', 'staff list dekhao', 'kormi manage korbo', 'employee password reset koro', 'kormike sob customer dekhar access dao', 'employee profile banao', 'nam er employee profile banao', 'kormi profile banao'],
    },
  },

  // 3. Sections (Groups) - Add section, Links, CSV Upload, Deactivate links
  {
    label: '/admin/sections',
    nameType: 'section',
    verbs: {
      en: ['create', 'add', 'make', 'set up', 'open', 'show', 'list', 'edit', 'insert link to', 'deactivate links in', 'upload', 'import', 'bulk upload', 'load'],
      bn: ['তৈরি করো', 'যোগ করো', 'বানাও', 'খোলো', 'দেখাও', 'এডিট করো', 'লিংক যোগ করো', 'লিংক বন্ধ করো', 'গ্রুপ নিষ্ক্রিয় করো', 'আপলোড করো', 'ইমপোর্ট করো', 'একসাথে যোগ করো'],
      bl: ['create koro', 'add koro', 'banao', 'kholo', 'dekhao', 'edit koro', 'link add koro', 'link bondho koro', 'upload koro', 'import koro', 'section list'],
    },
    objects: {
      en: ['a new section', 'facebook group section', 'group category', 'facebook link', 'group links', 'wrong link in section', 'dead links', 'all sections', 'group list', 'a csv file', 'csv file of links', 'an excel sheet of links', 'bulk links', 'file with links'],
      bn: ['নতুন সেকশন', 'গ্রুপ সেকশন', 'ফেসবুক গ্রুপ', 'গ্রুপের লিংক', 'সেকশনে লিংক', 'ভুল লিংক', 'সব সেকশন', 'গ্রুপ তালিকা', 'সিএসভি ফাইল', 'CSV ফাইল', 'অনেক লিংক', 'লিংকের ফাইল'],
      bl: ['notun section', 'group section', 'facebook group', 'group er link', 'section e link', 'dead link', 'sob section', 'group list', 'csv file', 'onek link', 'link er file'],
    },
    directPhrases: {
      en: ['go to sections page', 'manage facebook groups', 'group section list', 'add links to group', 'deactivate dead links', 'bulk upload csv', 'upload csv file of links', 'import csv links to section'],
      bn: ['গ্রুপ সেকশন পেজে যাও', 'সেকশন তালিকা খোলো', 'ফেসবুক লিংক ম্যানেজ করো', 'গ্রুপের লিংক বন্ধ করার পেজ', 'সিএসভি ফাইল আপলোড করব', 'গ্রুপে অনেক লিংক একসাথে আপলোড করো'],
      bl: ['sections page kholo', 'group list dekhao', 'fb group link add koro', 'section manage korbo', 'csv uplod korbo', 'bulk upload csv', 'links er file import koro'],
    },
  },

  // 4. CSV Upload History
  {
    label: '/admin/csv/history',
    verbs: {
      en: ['show', 'view', 'check', 'open', 'inspect', 'see', 'display'],
      bn: ['দেখাও', 'খোলো', 'দেখতে চাই', 'চেক করো', 'বের করো'],
      bl: ['dekhao', 'kholo', 'dekhte chai', 'check koro', 'open koro'],
    },
    objects: {
      en: ['upload history', 'past csv uploads', 'previous import logs', 'duplicate upload history', 'past link imports', 'csv history table'],
      bn: ['আপলোড ইতিহাস', 'আগের সিএসভি আপলোড', 'পুরনো আপলোড রেকর্ড', 'ইমপোর্ট হিস্ট্রি', 'সিএসভি হিস্টোরি', 'ডুপ্লিকেট আপলোড লগ'],
      bl: ['upload history', 'past csv upload', 'ager upload record', 'import history', 'csv history', 'previous imports'],
    },
    directPhrases: {
      en: ['open upload history', 'where can i see past csv uploads', 'csv upload log table', 'check previous imports'],
      bn: ['আপলোড ইতিহাস পেজ খোলো', 'আগে কী কী সিএসভি আপলোড করেছি দেখাও', 'সিএসভি হিস্টোরি কোথায়'],
      bl: ['upload history page e jao', 'ager csv upload list dekhao', 'csv history dekhte chai'],
    },
  },

  // 5. Products (Mushrooms, catalog items, pricing)
  {
    label: '/admin/products',
    verbs: {
      en: ['add', 'create', 'register', 'list', 'edit', 'update price of', 'change price of', 'show', 'view', 'deactivate', 'delete'],
      bn: ['যোগ করো', 'তৈরি করো', 'লিস্ট করো', 'এডিট করো', 'দাম পরিবর্তন করো', 'দাম বাড়াও', 'দাম কমাও', 'দেখাও', 'মুছে ফেলো', 'বাদ দাও'],
      bl: ['add koro', 'create koro', 'edit koro', 'dam change koro', 'dam baraw', 'dam komao', 'dekhao', 'price update koro', 'delete koro', 'delete korte chai'],
    },
    objects: {
      en: ['a new product', 'mushroom product', 'oyster mushroom', 'milky mushroom', 'dried mushroom', 'mushroom spawn', 'spawn', 'product price', 'selling price', 'product catalog', 'item list'],
      bn: ['নতুন পণ্য', 'মাশরুম পণ্য', 'ঝিনুক মাশরুম', 'শুকনো মাশরুম', 'মাশরুম স্পন', 'স্পন', 'পণ্যের দাম', 'প্রোডাক্ট তালিকা', 'বিক্রয়মূল্য', 'মাশরুমের দাম'],
      bl: ['notun product', 'mushroom ponno', 'product er dam', 'ponner dam', 'product list', 'selling price', 'mushroom price', 'mushroom spawn', 'spawn er price', 'prodct'],
    },
    directPhrases: {
      en: ['open products page', 'product catalog', 'add new mushroom product', 'change product selling price', 'mushroom items list', 'price of mushroom spawn'],
      bn: ['পণ্য পেজ খোলো', 'নতুন মাশরুম যোগ করার পেজ', 'পণ্যের দাম বদলাও', 'প্রোডাক্ট ক্যাটালগ দেখতে চাই', 'স্পনের দাম কত'],
      bl: ['product page e jao', 'mushroom product list dekhao', 'product er dam bodlate chai', 'products kholo', 'spawn er price koto', 'prodct delete korte chai'],
    },
  },

  // 6. Campaigns (Facebook Ads, Boost, Budget)
  {
    label: '/admin/campaigns',
    verbs: {
      en: ['create', 'add', 'launch', 'run', 'start', 'edit', 'pause', 'stop', 'adjust', 'show', 'view', 'check'],
      bn: ['তৈরি করো', 'চালু করো', 'শুরু করো', 'এডিট করো', 'থামাও', 'বন্ধ করো', 'বাজেট বদলাও', 'দেখাও'],
      bl: ['create koro', 'chalu koro', 'shuru koro', 'edit koro', 'pause koro', 'stop koro', 'budget bodlao', 'dekhao'],
    },
    objects: {
      en: ['a new campaign', 'facebook ad campaign', 'ad boost', 'campaign budget', 'campaign ad spend', 'roas', 'active campaigns', 'ad promotion'],
      bn: ['নতুন ক্যাম্পেইন', 'ফেসবুক বিজ্ঞাপন', 'বিজ্ঞাপন বুস্ট', 'ক্যাম্পেইনের বাজেট', 'অ্যাড খরচ', 'চলমান ক্যাম্পেইন', 'আরওএএস'],
      bl: ['notun campaign', 'facebook ad', 'boost campaign', 'campaign budget', 'ad spend', 'running ads', 'campaign list'],
    },
    directPhrases: {
      en: ['open campaigns page', 'facebook ad campaigns', 'manage marketing ads', 'pause ad campaign', 'check campaign ad spend'],
      bn: ['ক্যাম্পেইন পেজ খোলো', 'বিজ্ঞাপন ব্যবস্থাপনা', 'ফেসবুক অ্যাড ক্যাম্পেইন লিস্ট', 'ক্যাম্পেইনের খরচ দেখাও'],
      bl: ['campaign page e jao', 'facebook ad campaign kholo', 'campaign spend check koro', 'ad manage korbo'],
    },
  },

  // 7. Leads (CRM, Pipeline, Customers, Follow-ups)
  {
    label: '/admin/leads',
    verbs: {
      en: ['add', 'create', 'enter', 'record', 'save', 'change stage of', 'update status of', 'add followup to', 'show', 'view', 'filter'],
      bn: ['যোগ করো', 'এন্ট্রি দাও', 'সেভ করো', 'স্টেজ বদলাও', 'অর্ডার মার্ক করো', 'বাতিল করো', 'ফলোআপ লেখো', 'দেখাও'],
      bl: ['add koro', 'entry dao', 'save koro', 'stage change koro', 'ordered mark koro', 'lost koro', 'followup likho', 'dekhao'],
    },
    objects: {
      en: ['a new lead', 'potential customer', 'buyer', 'client', 'lead stage', 'followup note', 'customer pipeline', 'all leads', 'buyer list', 'customer phone check', 'unique mobile numbers', 'new or old customer check', 'BST customer timestamps', 'last 1 3 7 30 days customer list', 'which employee added which customer'],
      bn: ['নতুন লিড', 'কাস্টমার', 'ক্রেতা', 'গ্রাহক', 'লিডের স্টেজ', 'ফলোআপ নোট', 'লিড পাইপলাইন', 'সব লিড', 'ক্রেতাদের তালিকা', 'কাস্টমার ফোন নম্বর চেক', 'পুরাতন নতুন কাস্টমার চেক', 'বিএসটি সময় ও তারিখ', 'গত ১ ৩ ৭ ৩০ দিনের কাস্টমার', 'কোন কর্মী কোন কাস্টমার যোগ করেছে'],
      bl: ['notun lead', 'customer', 'kreta', 'grahok', 'lead stage', 'followup note', 'lead list', 'buyer list', 'customer phone check', 'puran customer check', 'notun customer check', 'bst time customer', 'last 1 3 7 30 din er customer', 'kon kormi add korse customer'],
    },
    directPhrases: {
      en: ['open leads page', 'crm customer leads', 'lead pipeline stage', 'add new customer lead', 'customer followup notes', 'check unique customer phone numbers', 'which employee added customer', 'customer filter last 7 days', 'customer filter last 30 days'],
      bn: ['লিড পেজ খোলো', 'কাস্টমার লিড তালিকা', 'ক্রেতার স্টেজ পরিবর্তন করো', 'নতুন লিড এন্ট্রি পেজ', 'কোন কর্মী কখন কাস্টমার যুক্ত করেছে', 'গত ১ ৩ ৭ ৩০ দিনের কাস্টমার ফিল্টার', 'পুরাতন কাস্টমার ডুপ্লিকেট ফোন নম্বর চেক'],
      bl: ['leads page e jao', 'customer lead list kholo', 'lead pipeline dekhao', 'buyer manage korbo', 'kon kormi kon customer kokhon add korse', 'puran customer duplicate phone check', 'last 7 din er customer dekhao', 'last 30 days customer list'],
    },
  },

  // 8. Targets & Quotas
  {
    label: '/admin/targets',
    verbs: {
      en: ['set', 'create', 'define', 'copy', 'duplicate', 'reuse', 'show', 'view', 'track', 'update'],
      bn: ['সেট করো', 'ঠিক করো', 'নির্ধারণ করো', 'কপি করো', 'আবার ব্যবহার করো', 'দেখাও', 'ট্র্যাক করো'],
      bl: ['set koro', 'thik koro', 'copy koro', 'reuse koro', 'dekhao', 'track koro', 'update koro'],
    },
    objects: {
      en: ['monthly sales target', 'section target', 'sales quota', 'targets to next month', 'target progress', 'goal tracking', 'target quota'],
      bn: ['মাসিক টার্গেট', 'বিক্রির লক্ষ্যমাত্রা', 'সেকশন টার্গেট', 'পরের মাসের টার্গেট', 'টার্গেট কপি', 'টার্গেট অগ্রগতি'],
      bl: ['monthly target', 'sales target', 'section target', 'porer masher target', 'target copy', 'target progress'],
    },
    directPhrases: {
      en: ['open targets page', 'set monthly targets', 'copy targets to next month', 'sales goals and quota', 'target management'],
      bn: ['টার্গেট পেজ খোলো', 'মাসিক বিক্রির লক্ষ্যমাত্রা সেট করো', 'টার্গেট কপি করার অপশন', 'টার্গেট ও লক্ষ্য পেজে যাও'],
      bl: ['targets page e jao', 'monthly target set korbo', 'sales quota page kholo', 'target tracking dekhao'],
    },
  },

  // 9. Budgets
  {
    label: '/admin/targets',
    verbs: {
      en: ['set', 'open', 'show', 'view', 'allocate', 'check', 'manage', 'update'],
      bn: ['সেট করো', 'খোলো', 'দেখাও', 'বরাদ্দ দাও', 'চেক করো', 'ম্যানেজ করো'],
      bl: ['set koro', 'kholo', 'dekhao', 'check koro', 'manage koro', 'open koro'],
    },
    objects: {
      en: ['marketing budget', 'ad budget allocation', 'monthly marketing budget', 'budget tracking', 'spending ceiling', 'budget limits'],
      bn: ['মার্কেটিং বাজেট', 'অ্যাড বাজেট', 'মাসিক বাজেট বরাদ্দ', 'বাজেট ট্র্যাকিং', 'বাজেট সীমা'],
      bl: ['marketing budget', 'ad budget', 'monthly budget', 'budget tracking', 'budget limit'],
    },
    directPhrases: {
      en: ['open budgets page', 'marketing budget allocation', 'track ad spend budgets', 'monthly budget settings'],
      bn: ['বাজেট পেজ খোলো', 'মার্কেটিং বাজেট পেজে নিয়ে যাও', 'অ্যাড বাজেট বরাদ্দ তালিকা'],
      bl: ['budgets page e jao', 'ad budget allocation kholo', 'budget manage korbo'],
    },
  },

  // 10. Reports Main / Overview
  {
    label: '/admin/reports/daily',
    verbs: {
      en: ['open', 'show', 'view', 'go to', 'explore', 'see', 'browse'],
      bn: ['খোলো', 'দেখাও', 'দেখতে চাই', 'যাও', 'নিয়ে যাও'],
      bl: ['kholo', 'dekhao', 'dekhte chai', 'jao', 'niye jao', 'open koro'],
    },
    objects: {
      en: ['all reports', 'reports hub', 'reporting overview', 'business reports dashboard', 'analytics reports'],
      bn: ['সব রিপোর্ট', 'রিপোর্ট হাব', 'রিপোর্টিং ড্যাশবোর্ড', 'সব রিপোর্টের তালিকা'],
      bl: ['sob report', 'reports hub', 'reporting overview', 'all reports list'],
    },
    directPhrases: {
      en: ['open reports page', 'show all reports', 'reporting center', 'navigate to reports'],
      bn: ['রিপোর্ট পেজে যাও', 'সব রিপোর্ট দেখাও', 'রিপোর্টিং সেন্টার খোলো'],
      bl: ['reports page e jao', 'sob report dekhte chai', 'reports hub kholo'],
    },
  },

  // 11. Daily Report
  {
    label: '/admin/reports/daily',
    verbs: {
      en: ['show', 'open', 'view', 'see', 'check', 'inspect', 'print', 'give me', 'fetch', 'tell me', 'calculate'],
      bn: ['দেখাও', 'খোলো', 'দেখতে চাই', 'চেক করো', 'বের করো', 'দাও', 'বলো', 'জানাও', 'হিসাব দাও'],
      bl: ['dekhao', 'kholo', 'dekhte chai', 'check koro', 'open koro', 'dao', 'bolo', 'jante chai', 'ber koro', 'hisab dao'],
    },
    objects: {
      en: [
        "today's report", 'the daily report', "today's sales", 'daily posts', 'daily performance score',
        "yesterday's sales numbers", 'daily summary', "yesterday's report", "yesterday summary",
        'yesterday report', 'yesterday sales', 'yesterdays numbers', 'day before yesterday report',
        '2 days ago report', 'yesterday performance', 'report for date', 'sales figure of yesterday',
        'daily activity calculation', 'previous day statistics', 'yesterday leads and orders',
        'report of 25th', 'report of 24th', 'report of 26th',
        'who worked today', 'who worked yesterday', 'active employee submission list', 'failing employees list',
        'who needs performance improvement', 'top performer yesterday'
      ],
      bn: [
        'আজকের রিপোর্ট', 'দৈনিক রিপোর্ট', 'আজকের বিক্রি', 'আজকের পোস্ট সংখ্যা', 'দৈনিক পারফরম্যান্স',
        'গতকালের রিপোর্ট', 'কালকের রিপোর্ট', 'গতকালকের রিপোর্ট', 'কালকের বিক্রি', 'গতকালের হিসাব',
        'কালকের হিসাব', 'পরশুর রিপোর্ট', 'আগের দিনের রিপোর্ট', 'নির্দিষ্ট তারিখের রিপোর্ট',
        'গতকালকের কাজের বিবরণ', 'কালকে কত বিক্রি হইছে', 'কালকের লিড ও অর্ডার', '২৫ তারিখের রিপোর্ট',
        '২৪ তারিখের রিপোর্ট', '২৬ তারিখের রিপোর্ট', 'আজকে কে কে কাজ করেছে', 'কারা কাজ করে নাই',
        'কারা ফেইল করেছে', 'কার স্কোর কম'
      ],
      bl: [
        'ajker report', 'daily report', 'ajker sale', 'daily post count', 'ajker score',
        'gotokaler report', 'kalker report', 'kalker sale', 'kalke ki hoise', 'kalker summary',
        'kalker hishab', 'kalker hisab', 'poroshur report', 'ager diner report', 'gotokaler hisab',
        'yesterday report', 'kalke koyta order aslo', 'kalke koto bikri hoise', 'kalker kajer hisab',
        'date onushare report', 'kalker number gula', 'kalke ke ke post korse', '25 tarikh er report',
        '24 tarikh er report', '26 tarikh er report', 'tarikh hishebe report',
        'ajke ke ke kaj korse', 'kalke ke ke kaj korse', 'kara fail korse', 'kar score kom',
        'kalke kar score shobcheye beshi chilo', 'submission list'
      ],
    },
    directPhrases: {
      en: [
        'open daily report', "show today's sales report", 'daily activity summary', 'how much did we sell today',
        'give me yesterday report', "show me yesterday's numbers", 'what happened yesterday',
        'can you give yesterday summary', 'open yesterday report', 'show report of 25th',
        'how many orders came in yesterday', 'tell me yesterday sales figures', 'open report for yesterday',
        'show me what the employees did yesterday', 'yesterday daily sales'
      ],
      bn: [
        'দৈনিক রিপোর্ট পেজ খোলো', 'আজকের বিক্রির রিপোর্ট দেখাও', 'আজ কে কত কাজ করেছে', 'দৈনিক সামারি দেখতে চাই',
        'কালকের রিপোর্ট দাও', 'গতকালকের রিপোর্ট দেখাও', 'কালকে কত বিক্রি হইছে', 'কালকের হিসাব দাও',
        'গতকাল কি কি কাজ হয়েছে', 'পরশুর রিপোর্ট দেখতে চাই', 'আগের দিনের রিপোর্ট খোলো', 'তারিখ হিসেবে রিপোর্ট দেখাও',
        'গতকালকের সম্পূর্ণ রিপোর্ট দেখতে চাই', 'কালকে কয়টা লিড আসছে', 'কালকের সেলস রিপোর্ট ওপেন করো'
      ],
      bl: [
        'daily report page e jao', 'ajker report kholo', 'ajker sale koto hoise', 'daily report dekhao',
        'kalker report dao', 'kalker report dekhao', 'kalke koto bikri hoise', 'kalker hisab dao',
        'gotokaler summary dekhao', 'boloto kalke ki hoisilo', 'ami kalker report dekhte chai',
        'kalke ke ke kaj korse', 'ager diner report koi', 'poroshur report open koro',
        'kalke koyta lead aslo', 'yesterday sales koto chilo', 'kalker full report e niye jao'
      ],
    },
  },

  // 12. Weekly Report
  {
    label: '/admin/reports/weekly',
    verbs: {
      en: ['show', 'open', 'publish', 'draft', 'evaluate', 'download pdf of', 'export'],
      bn: ['দেখাও', 'খোলো', 'প্রকাশ করো', 'ড্রাফট করো', 'মূল্যায়ন করো', 'পিডিএফ ডাউনলোড করো'],
      bl: ['dekhao', 'kholo', 'publish koro', 'draft koro', 'pdf download koro', 'review koro'],
    },
    objects: {
      en: ['the weekly report', "this week's review", 'weekly evaluation', 'weekly report draft', 'pdf export of weekly report'],
      bn: ['সাপ্তাহিক রিপোর্ট', 'এই সপ্তাহের রিপোর্ট', 'সাপ্তাহিক মূল্যায়ন', 'সাপ্তাহিক রিপোর্ট ড্রাফট', 'রিপোর্টের পিডিএফ'],
      bl: ['weekly report', 'ei shoptahik report', 'weekly review', 'weekly evaluation', 'report er pdf'],
    },
    directPhrases: {
      en: ['open weekly report', 'publish this weeks report', 'download weekly report pdf', 'weekly performance review'],
      bn: ['সাপ্তাহিক রিপোর্ট পেজ খোলো', 'সাপ্তাহিক রিপোর্ট প্রকাশ করো', 'সাপ্তাহিক রিপোর্টের পিডিএফ ডাউনলোড'],
      bl: ['weekly report kholo', 'shoptahik report publish koro', 'weekly report pdf dao'],
    },
  },

  // 13. Monthly Report
  {
    label: '/admin/reports/monthly',
    verbs: {
      en: ['show', 'open', 'view', 'check', 'see', 'calculate'],
      bn: ['দেখাও', 'খোলো', 'দেখতে চাই', 'চেক করো', 'হিসাব করো'],
      bl: ['dekhao', 'kholo', 'dekhte chai', 'check koro', 'open koro'],
    },
    objects: {
      en: [
        'the monthly report',
        "this month's report",
        'monthly ranking',
        'month-end sales and profit',
        'monthly leaderboard review',
        'january report',
        'february report',
        'october 2026 report',
        'september 2026 report',
        'last month report',
        'previous month report',
        '2026-10 report',
        '2026-09 report',
        'monthly summary',
      ],
      bn: [
        'মাসিক রিপোর্ট',
        'এই মাসের রিপোর্ট',
        'মাসিক র‍্যাংকিং',
        'মাসের মোট বিক্রি ও লাভ',
        'মাসিক সারাংশ',
        'অক্টোবর ২০২৬ রিপোর্ট',
        'সেপ্টেম্বর ২০২৬ রিপোর্ট',
        'গত মাসের রিপোর্ট',
      ],
      bl: [
        'monthly report',
        'ei masher report',
        'masik ranking',
        'month end profit',
        'monthly summary',
        'october report',
        'september er report',
        'goto masher report',
        'last month monthly report',
      ],
    },
    directPhrases: {
      en: [
        'open monthly report',
        'monthly sales and ranking report',
        'month-end performance summary',
        'how much profit this month',
        'october 2026 report',
        'september 2026 report',
        'show last month report',
      ],
      bn: [
        'মাসিক রিপোর্ট পেজ খোলো',
        'মাসের বিক্রির র‍্যাংকিং দেখাও',
        'এই মাসের মোট লাভ কত',
        'মাসিক সারাংশ দেখতে চাই',
        'অক্টোবর ২০২৬ রিপোর্ট',
        'গত মাসের রিপোর্ট দেখাও',
      ],
      bl: [
        'monthly report page e jao',
        'masik report kholo',
        'ei masher ranking dekhao',
        'month end profit koto',
        'october 2026 er report',
        'goto masher hisab',
      ],
    },
  },

  // 14. 90-Day Plan & Roadmap
  {
    label: '/admin/plan',
    verbs: {
      en: ['add task to', 'update milestone of', 'show', 'open', 'view', 'check roadmap of', 'manage'],
      bn: ['টাস্ক যোগ করো', 'মাইলস্টোন আপডেট করো', 'দেখাও', 'খোলো', 'রোডম্যাপ দেখো', 'ম্যানেজ করো'],
      bl: ['task add koro', 'milestone update koro', 'dekhao', 'kholo', 'roadmap dekho', 'manage koro'],
    },
    objects: {
      en: ['the 90-day plan', 'quarterly roadmap', 'plan milestone', 'phase 1 task', 'phase 2 milestone', 'blocked plan tasks', 'quarterly targets'],
      bn: ['৯০ দিনের প্ল্যান', 'কোয়ার্টারলি রোডম্যাপ', 'প্ল্যানের মাইলস্টোন', 'ফেজের কাজ', 'আটকে থাকা টাস্ক', 'পরিকল্পনা'],
      bl: ['90 diner plan', 'quarterly roadmap', 'plan milestone', 'phase task', 'blocked task', '90 days plan'],
    },
    directPhrases: {
      en: ['open 90-day plan', 'quarterly business roadmap', 'add milestone to 90 day plan', 'check blocked quarterly tasks'],
      bn: ['৯০ দিনের প্ল্যান পেজে যাও', 'রোডম্যাপ মাইলস্টোন খোলো', 'প্ল্যানে নতুন টাস্ক যোগ করো'],
      bl: ['90 diner plan page kholo', 'quarterly roadmap e jao', 'plan e task add korbo'],
    },
  },

  // 15. Audit Log (History of changes, deletions)
  {
    label: '/admin/audit',
    verbs: {
      en: ['show', 'view', 'check', 'open', 'inspect', 'see who deleted', 'see who changed', 'track'],
      bn: ['দেখাও', 'খোলো', 'চেক করো', 'কে মুছেছে দেখো', 'কে বদলেছে দেখো', 'অ্যাক্টিভিটি ট্র্যাক করো'],
      bl: ['dekhao', 'kholo', 'check koro', 'ke delete korse', 'ke change korse', 'activity track koro'],
    },
    objects: {
      en: ['the audit log', 'activity history log', 'change record', 'deletion audit', 'system change history', 'json audit trail'],
      bn: ['অডিট লগ', 'অ্যাক্টিভিটি লগ', 'পরিবর্তনের ইতিহাস', 'মুছে ফেলার রেকর্ড', 'সিস্টেম লগ'],
      bl: ['audit log', 'activity log', 'change history', 'deletion record', 'system log'],
    },
    directPhrases: {
      en: ['open audit log', 'who modified this product', 'who deleted that lead', 'system activity change log', 'audit trail'],
      bn: ['অডিট লগ পেজ খোলো', 'কে এই পণ্য মুছেছে', 'কে এই লিড পরিবর্তন করেছে', 'অ্যাক্টিভিটি হিস্ট্রি দেখতে চাই'],
      bl: ['audit log page e jao', 'ke delete korse dekhao', 'ke change korse check koro', 'audit log kholo'],
    },
  },

  // 16. Settings
  {
    label: '/admin/settings',
    verbs: {
      en: ['open', 'change', 'adjust', 'set', 'configure', 'update', 'toggle'],
      bn: ['খোলো', 'পরিবর্তন করো', 'সেট করো', 'কনফিগার করো', 'আপডেট করো', 'চালু বা বন্ধ করো'],
      bl: ['kholo', 'change koro', 'set koro', 'configure koro', 'update koro', 'on off koro'],
    },
    objects: {
      en: ['settings', 'scoring weights', 'failing threshold', 'achievement cap', 'edit window days', 'default language', 'undo option'],
      bn: ['সেটিংস', 'স্কোরিং ওয়েট', 'স্কোরের ওজন', 'ব্যর্থতা থ্রেশহোল্ড', 'এডিট উইন্ডো', 'ডিফল্ট ভাষা', 'আনডু অপশন'],
      bl: ['settings', 'scoring weight', 'score er weight', 'failing threshold', 'edit window', 'default language', 'undo option'],
    },
    directPhrases: {
      en: ['open settings page', 'change scoring weight configuration', 'set failing threshold percentage', 'adjust edit window days'],
      bn: ['সেটিংস পেজ খোলো', 'স্কোরিং সেটিংস পরিবর্তন করো', 'পাসিং থ্রেশহোল্ড ঠিক করো', 'এডিট উইন্ডো বদলাও'],
      bl: ['settings page e jao', 'scoring weight change korbo', 'threshold set koro', 'settings kholo'],
    },
  },

  // 17. Manual / User Guide
  {
    label: '/admin/manual',
    verbs: {
      en: ['open', 'show', 'read', 'view', 'check', 'browse', 'learn from'],
      bn: ['খোলো', 'দেখাও', 'পড়ো', 'দেখতে চাই', 'শিখতে চাই'],
      bl: ['kholo', 'dekhao', 'porte chai', 'dekhte chai', 'learn korbo', 'open koro'],
    },
    objects: {
      en: ['the manual', 'the user guide', 'system handbook', 'documentation', 'step-by-step instructions', 'admin tutorial'],
      bn: ['নির্দেশিকা', 'ইউজার গাইড', 'ম্যানুয়াল', 'ব্যবহার বিধি', 'সহায়িকা বই', 'টিউটোরিয়াল'],
      bl: ['manual', 'user guide', 'documentation', 'nirdeshika', 'handbook', 'instructions'],
    },
    directPhrases: {
      en: ['open user manual', 'how to use this admin panel', 'admin documentation and guide', 'step by step manual'],
      bn: ['নির্দেশিকা পেজ খোলো', 'প্যানেল ব্যবহার বিধি দেখতে চাই', 'ইউজার গাইড কোথায় পাব', 'ম্যানুয়াল পেজে যাও'],
      bl: ['manual page kholo', 'user guide dekhao', 'panel kivabe chalabo nirdeshika', 'manual e niye jao'],
    },
  },

  // 18. Assistant Training / Teach Bot
  {
    label: '/admin/assistant',
    verbs: {
      en: ['open', 'teach', 'train', 'map', 'configure', 'add phrase to'],
      bn: ['খোলো', 'শেখাও', 'ট্রেন করো', 'ম্যাপ করো', 'নতুন বাক্য যুক্ত করো'],
      bl: ['kholo', 'shekhao', 'train koro', 'map koro', 'notun phrase dao'],
    },
    objects: {
      en: ['the assistant', 'chatbot training page', 'new phrase shortcuts', 'bot teaching', 'custom mapping to page'],
      bn: ['সহকারী শেখান পেজ', 'চ্যাটবট ট্রেইনিং', 'নতুন শব্দ বা বাক্য', 'বট প্রশিক্ষণ', 'শর্টকাট ম্যাপিং'],
      bl: ['assistant teach page', 'chatbot training', 'notun phrase shortcut', 'bot training', 'teach assistant'],
    },
    directPhrases: {
      en: ['open teach assistant page', 'train the chatbot with new phrase', 'map custom keyword to page', 'assistant configuration'],
      bn: ['সহকারী শেখান পেজে যাও', 'বটকে নতুন শব্দ শেখাতে চাই', 'চ্যাটবট ট্রেনিং পেজ খোলো'],
      bl: ['teach assistant page e jao', 'bot ke train korbo', 'notun phrase map koro', 'assistant training'],
    },
  },

  // 19. Admin Login Page
  {
    label: 'ANSWER',
    verbs: {
      en: ['open', 'go to', 'visit', 'navigate to', 'take me to'],
      bn: ['খোলো', 'যাও', 'নিয়ে যাও', 'প্রবেশ করো'],
      bl: ['kholo', 'jao', 'niye jao', 'open koro'],
    },
    objects: {
      en: ['admin login page', 'passcode login screen', 'admin sign in', 'passcode entry screen'],
      bn: ['অ্যাডমিন লগইন পেজ', 'পাসকোড পেজ', 'অ্যাডমিন সাইন ইন স্ক্রিন'],
      bl: ['admin login page', 'passcode dewar page', 'admin sign in screen'],
    },
    directPhrases: {
      en: ['open admin login page', 'where do i enter admin passcode', 'admin sign-in screen', 'go to admin login'],
      bn: ['অ্যাডমিন লগইন পেজে যাও', 'পাসকোড দেওয়ার পেজ খোলো', 'অ্যাডমিন সাইন ইন পেজ'],
      bl: ['admin login page kholo', 'passcode screen e jao', 'admin sign in kothay'],
    },
  },

  // ------------------------- EMPLOYEE PAGES -------------------------
  // 20. Employee Daily Entry
  {
    label: '/employee/daily-entry',
    verbs: {
      en: ['open', 'submit', 'enter', 'log', 'fill out', 'go to', 'record'],
      bn: ['খোলো', 'জমা দাও', 'এন্ট্রি করো', 'পূরণ করো', 'যাও', 'রেকর্ড করো'],
      bl: ['kholo', 'submit koro', 'entry dao', 'fill up koro', 'jao', 'open koro'],
    },
    objects: {
      en: ['daily entry form', "today's work submission", 'post links form', 'daily report submission', 'employee entry page', 'sales count entry'],
      bn: ['দৈনিক এন্ট্রি ফর্ম', 'আজকের কাজ জমা দেওয়া', 'পোস্ট লিংক এন্ট্রি', 'দৈনিক কাজের রিপোর্ট', 'কর্মীর এন্ট্রি পেজ'],
      bl: ['daily entry form', 'ajker kaj submit', 'post link entry', 'daily report submit', 'employee entry page'],
    },
    directPhrases: {
      en: ['open employee daily entry', 'submit my daily posts and sales', 'daily work entry form for staff', 'where do employees submit work'],
      bn: ['দৈনিক এন্ট্রি পেজ খোলো', 'আজকের কাজের পোস্ট লিংক জমা দেব কীভাবে', 'কর্মীর ডেইলি এন্ট্রি ফর্ম'],
      bl: ['daily entry page e jao', 'ajker kaj submit korbo kothay', 'post link entry form kholo'],
    },
  },

  // 21. Employee My Work
  {
    label: '/employee/my-work',
    verbs: {
      en: ['open', 'view', 'show', 'check', 'see', 'go to', 'find'],
      bn: ['খোলো', 'দেখাও', 'দেখতে চাই', 'চেক করো', 'যাও', 'খুঁজে দাও'],
      bl: ['kholo', 'dekhao', 'dekhte chai', 'check koro', 'jao', 'open koro'],
    },
    objects: {
      en: ['my work', 'assigned sections', 'my assigned links', 'pending tasks to work on', 'employee task queue', 'my assigned group list'],
      bn: ['আমার কাজ', 'আমার সেকশন', 'আমার জন্য নির্ধারিত লিংক', 'পেন্ডিং কাজের তালিকা', 'আমাকে দেওয়া গ্রুপের লিংক'],
      bl: ['amar kaj', 'amar section', 'assigned link', 'pending kajer list', 'amake deya group link', 'my work page'],
    },
    directPhrases: {
      en: ['open my work page', 'what are my assigned links today', 'check employee assigned sections', 'my daily task list'],
      bn: ['আমার কাজ পেজ খোলো', 'আমাকে কোন কোন লিংক দেওয়া হয়েছে', 'আমার নির্ধারিত সেকশন কোথায়'],
      bl: ['my work page kholo', 'amar assigned link gula dekhao', 'amake kon section diso'],
    },
  },

  // 22. Employee Performance
  {
    label: '/employee/performance',
    verbs: {
      en: ['open', 'view', 'check', 'show', 'track', 'see my'],
      bn: ['খোলো', 'দেখাও', 'চেক করো', 'দেখতে চাই', 'হিসাব দেখো'],
      bl: ['kholo', 'dekhao', 'check koro', 'dekhte chai', 'track koro'],
    },
    objects: {
      en: ['my performance', 'my personal score', 'my monthly sales progress', 'employee stats', 'my points and rating'],
      bn: ['আমার পারফরম্যান্স', 'আমার ব্যক্তিগত স্কোর', 'আমার বিক্রির অগ্রগতি', 'আমার কাজের পরিসংখ্যান', 'আমার পয়েন্ট'],
      bl: ['amar performance', 'amar nijer score', 'amar sales progress', 'amar points', 'personal stats'],
    },
    directPhrases: {
      en: ['open employee performance', 'how is my individual score', 'check my personal performance rating', 'my monthly sales stats'],
      bn: ['আমার পারফরম্যান্স পেজে নিয়ে যাও', 'আমার কাজের স্কোর কত হয়েছে', 'নিজের অগ্রগতি দেখতে চাই'],
      bl: ['amar performance page kholo', 'amar score koto hoise', 'my performance stats dekhao'],
    },
  },

  // 23. Employee Leaderboard
  {
    label: '/employee/leaderboard',
    verbs: {
      en: ['open', 'show', 'view', 'check', 'see who is top on', 'display'],
      bn: ['খোলো', 'দেখাও', 'চেক করো', 'দেখতে চাই', 'কে শীর্ষে আছে দেখো'],
      bl: ['kholo', 'dekhao', 'check koro', 'dekhte chai', 'ke top e ache'],
    },
    objects: {
      en: ['the leaderboard', 'team rankings', 'top marketer table', 'employee ranking board', 'staff leaderboard'],
      bn: ['লিডারবোর্ড', 'টিম র‍্যাংকিং', 'সেরা কর্মীদের তালিকা', 'র‍্যাংক বোর্ড', 'কর্মচারী লিডারবোর্ড'],
      bl: ['leaderboard', 'team ranking', 'top employee list', 'ranking board', 'staff leaderboard'],
    },
    directPhrases: {
      en: ['open leaderboard', 'who is winning on the team leaderboard', 'team ranking board for employees', 'check top performers'],
      bn: ['লিডারবোর্ড পেজ খোলো', 'কে এই মাসে শীর্ষে আছে', 'টিম র‍্যাংকিং তালিকা দেখাও'],
      bl: ['leaderboard page kholo', 'ke top e ache dekhte chai', 'team ranking dekhao'],
    },
  },

  // 24. Employee Leads
  {
    label: '/employee/leads',
    verbs: {
      en: ['open', 'view', 'show', 'call', 'check', 'manage my'],
      bn: ['খোলো', 'দেখাও', 'কল করো', 'চেক করো', 'যোগাযোগ করো'],
      bl: ['kholo', 'dekhao', 'call koro', 'check koro', 'contact koro'],
    },
    objects: {
      en: ['my customer leads', 'employee leads list', 'buyers assigned to me', 'my follow-up customer contacts', 'my client pipeline'],
      bn: ['আমার লিড তালিকা', 'আমাকে দেওয়া ক্রেতাদের ফোন', 'আমার কাস্টমার', 'আমার ক্লায়েন্ট তালিকা'],
      bl: ['amar lead list', 'amake dewa customer', 'amar buyer contacts', 'employee leads'],
    },
    directPhrases: {
      en: ['open employee leads', 'my assigned customer contacts to call', 'view my personal buyer leads list', 'leads assigned to me'],
      bn: ['আমার লিড পেজ খোলো', 'যেসব ক্রেতাকে আমার ফোন দেওয়া দরকার', 'আমার কাস্টমারদের তালিকা'],
      bl: ['employee leads page e jao', 'amar customer lead gula kholo', 'amake kon buyer assign korso'],
    },
  },

  // 25. Employee Plan
  {
    label: '/employee/plan',
    verbs: {
      en: ['open', 'view', 'show', 'check', 'see my tasks on'],
      bn: ['খোলো', 'দেখাও', 'চেক করো', 'দেখতে চাই'],
      bl: ['kholo', 'dekhao', 'check koro', 'dekhte chai', 'open koro'],
    },
    objects: {
      en: ['my quarterly plan', 'my 90-day plan tasks', 'milestones assigned to me', 'employee roadmap tasks'],
      bn: ['আমার প্ল্যান', 'আমার জন্য নির্ধারিত ৯০ দিনের কাজ', 'আমার মাইলস্টোন টাস্ক'],
      bl: ['amar plan', 'amar 90 diner task', 'employee plan', 'assigned milestone'],
    },
    directPhrases: {
      en: ['open employee plan', 'what are my assigned tasks in the 90 day plan', 'check my quarterly roadmap milestones'],
      bn: ['আমার প্ল্যান পেজ খোলো', '৯০ দিনের প্ল্যানে আমার দায়িত্ব কী', 'আমার মাইলস্টোন দেখতে চাই'],
      bl: ['employee plan page e jao', 'amar 90 day task list kholo', 'plan e amar kaj ki'],
    },
  },

  // 26. Employee Dashboard / Portal Home
  {
    label: '/employee',
    verbs: {
      en: ['open', 'go to', 'visit', 'navigate to', 'take me to'],
      bn: ['খোলো', 'যাও', 'নিয়ে যাও', 'ভিজিট করো'],
      bl: ['kholo', 'jao', 'niye jao', 'visit koro', 'open koro'],
    },
    objects: {
      en: ['employee portal', 'employee dashboard', 'staff home screen', 'marketer portal home', 'employee main page'],
      bn: ['কর্মী পোর্টাল', 'কর্মী ড্যাশবোর্ড', 'স্টাফ হোম পেজ', 'কর্মচারীর মূল পাতা'],
      bl: ['employee portal', 'employee dashboard', 'staff home screen', 'kormi portal'],
    },
    directPhrases: {
      en: ['open employee portal', 'go to employee dashboard', 'staff member home screen', 'take me to employee panel'],
      bn: ['কর্মী ড্যাশবোর্ড পেজে যাও', 'স্টাফ পোর্টাল খোলো', 'কর্মীদের হোম পেজে নিয়ে চলো'],
      bl: ['employee dashboard kholo', 'staff portal e niye jao', 'kormi home screen'],
    },
  },

  // 27. General Login Page
  {
    label: '/login',
    verbs: {
      en: ['open', 'go to', 'visit', 'navigate to', 'take me to'],
      bn: ['খোলো', 'যাও', 'নিয়ে যাও', 'লগইন করো'],
      bl: ['kholo', 'jao', 'niye jao', 'login koro', 'open koro'],
    },
    objects: {
      en: ['the login page', 'employee sign-in screen', 'user login screen', 'staff login portal', 'sign in page'],
      bn: ['লগইন পেজ', 'কর্মী লগইন পাতা', 'স্টাফ সাইন ইন স্ক্রিন', 'সাধারণ লগইন পেজ'],
      bl: ['login page', 'employee sign in screen', 'staff login portal', 'login screen'],
    },
    directPhrases: {
      en: ['open login page', 'where do employees sign in with email and password', 'go to user sign-in', 'staff login screen'],
      bn: ['লগইন পেজে নিয়ে যাও', 'কর্মীরা ইমেইল ও পাসওয়ার্ড দিয়ে কোথায় ঢুকবে', 'সাইন ইন পেজ খোলো'],
      bl: ['login page e jao', 'employee login screen kholo', 'staff sign in page kothay'],
    },
  },

  // 28. Website Root Landing Page
  {
    label: '/',
    verbs: {
      en: ['open', 'go to', 'visit', 'navigate to', 'take me to'],
      bn: ['খোলো', 'যাও', 'নিয়ে যাও', 'ভিজিট করো'],
      bl: ['kholo', 'jao', 'niye jao', 'visit koro', 'open koro'],
    },
    objects: {
      en: ['the main website', 'the home page', 'landing page', 'root website', 'public front page', 'company homepage'],
      bn: ['মূল ওয়েবসাইট', 'ওয়েবসাইটের প্রধান পাতা', 'পাবলিক হোম পেজ', 'ওয়েবসাইট ল্যান্ডিং পেজ'],
      bl: ['main website', 'website home page', 'landing page', 'public site', 'root website'],
    },
    directPhrases: {
      en: ['go to main website', 'open landing page', 'visit public home page', 'take me to root website'],
      bn: ['মূল ওয়েবসাইটে যাও', 'ল্যান্ডিং পেজ খোলো', 'ওয়েবসাইটের প্রথম পেজে নিয়ে যাও'],
      bl: ['main website e jao', 'landing page kholo', 'root site dekhbo'],
    },
  },

  // ------------------------- GENERAL ANSWERS (ANSWER) -------------------------
  // 29. Panel Q&A (Passcode reset instructions, backup explanations, safety, capabilities, live site info)
  {
    label: 'ANSWER',
    verbs: {
      en: ['how to', 'explain', 'where is', 'what is', 'tell me about', 'how do i change', 'how do i exit', 'what are', 'who are', 'list'],
      bn: ['কীভাবে', 'ব্যাখ্যা করো', 'কোথায় থাকে', 'কী', 'বলে দাও', 'কীভাবে বদলাবো', 'কীভাবে বের হব', 'কী কী', 'কারা', 'তালিকা দাও'],
      bl: ['kivabe', 'explain koro', 'kothay thake', 'ki', 'bolo', 'kivabe bodlabo', 'kemne ber hobo', 'ki ki', 'kara', 'list dao'],
    },
    objects: {
      en: [
        'the admin passcode instructions',
        'telegram cloud backup',
        'database storage channel',
        'how to logout safely',
        'customer phone safety rules',
        'what capabilities you have',
        'our products',
        'active campaigns',
        'current employees',
        'scoring system rules',
        'the 90-day action plan',
        'duplicate lead prevention policy',
      ],
      bn: [
        'অ্যাডমিন পাসকোড বদলানোর নিয়ম',
        'টেলিগ্রাম ক্লাউড ব্যাকআপ',
        'ডাটাবেস সংরক্ষণ',
        'নিরাপদে লগআউট করার নিয়ম',
        'কাস্টমার ফোন নাম্বার গোপন রাখা',
        'তোমার কাজ কী',
        'আমাদের পণ্যসমূহ',
        'চলমান ক্যাম্পেইনসমূহ',
        'আমাদের কর্মীবৃন্দ',
        'স্কোরিং সিস্টেমের নিয়ম',
        '৯০ দিনের কর্মপরিকল্পনা',
        'ডুপ্লিকেট কাস্টমার নিয়ম',
      ],
      bl: [
        'admin passcode change korar niyam',
        'telegram backup',
        'database kothay save hoy',
        'logout korar upay',
        'customer phone number privacy',
        'tumi ki ki paro',
        'amader product',
        'active campaign',
        'amader kormi',
        'scoring system',
        '90 days action plan',
        'duplicate customer check',
      ],
    },
    directPhrases: {
      en: [
        'where is data backup saved',
        'how does telegram storage work',
        'how can developer change admin passcode',
        'how do i logout of admin panel',
        'what can this assistant do',
        'explain safety rules for customer phone numbers',
        'who are you and how do you help',
        'what are your features',
        'what products do we have',
        'what are our active campaigns',
        'who are our active employees',
        'how does employee scoring work',
        'what is the 90-day marketing action plan',
        'what are the rules for adding customer leads',
      ],
      bn: [
        'ডেটা ব্যাকআপ কোথায় থাকে',
        'টেলিগ্রাম ব্যাকআপ কীভাবে কাজ করে',
        'অ্যাডমিন পাসকোড কীভাবে পরিবর্তন করতে হয়',
        'প্যানেল থেকে লগআউট কীভাবে করব',
        'তুমি কী কী করতে পারো',
        'কাস্টমারের ফোন নাম্বার কীভাবে গোপন রাখব',
        'তুমি কে এবং কী সাহায্য করতে পারো',
        'আমাদের কী কী পণ্য আছে',
        'আমাদের কি কি প্রোডাক্ট আছে',
        'চলমান ক্যাম্পেইনগুলো কী',
        'আমাদের কর্মীরা কারা',
        'স্কোরিং কীভাবে কাজ করে',
        '৯০ দিনের অ্যাকশন প্ল্যান কী',
        'কাস্টমার লিডের নিয়ম কী',
      ],
      bl: [
        'data backup kothay save hoy',
        'telegram backup kivabe kaj kore',
        'admin passcode kivabe change korbo',
        'panel theke logout kemne kore',
        'tumi ki ki korte paro',
        'customer phone number privacy niyam ki',
        'tumi ke amake kivabe help korba',
        'amader ki ki product ache',
        'active campaigns gula ki',
        'amader kormira kara',
        'scoring kivabe hoy',
        'action plan ki',
        'customer rules ki',
      ],
    },
  },

  // ------------------------- OFF-TOPIC DECLINE (DECLINE) -------------------------
  // 30. Off-topic Decline
  {
    label: 'DECLINE',
    verbs: {
      en: ['what is', 'who is', 'tell me', 'write', 'how to cook', 'how to fix', 'how to grow', 'translate', 'solve', 'calculate'],
      bn: ['কী', 'কে', 'বলো', 'লেখো', 'কীভাবে রান্না করে', 'কীভাবে ঠিক করব', 'কীভাবে চাষ করব', 'অনুবাদ করো', 'হিসাব করো'],
      bl: ['ki', 'ke', 'bolo', 'likho', 'kivabe ranna kore', 'kivabe thik korbo', 'kivabe chash korbo', 'translate koro', 'hisab koro'],
    },
    objects: {
      en: ['today weather in dhaka', 'biryani recipe', 'cricket score', 'a romantic poem', 'a funny joke', 'bitcoin price today', 'weight loss diet', 'trip to cox bazar', 'quantum physics', 'algebra equation'],
      bn: ['আজকের আবহাওয়া', 'বিরিয়ানির রেসিপি', 'ক্রিকেট খেলার স্কোর', 'একটি রোমান্টিক কবিতা', 'মজার জোকস', 'বিটকয়েনের দাম', 'ওজন কমানোর ডায়েট', 'কক্সবাজার ভ্রমণ', 'কোয়ান্টাম পদার্থবিজ্ঞান', 'অংকের সমাধান'],
      bl: ['ajker weather', 'biryani recipe', 'cricket score', 'ekta kobita', 'ekta joke', 'bitcoin er dam', 'weight loss upay', 'cox bazar trip', 'math er problem'],
    },
    directPhrases: {
      en: [
        'what is the weather in dhaka today', 'how do i cook chicken biryani', 'tell me a funny joke', 'write me a love poem',
        'what is the score of today cricket match', 'how to lose belly fat in 7 days', 'which phone is best under 25000',
        'who won the fifa world cup', 'what is the current price of gold in bangladesh', 'how to grow oyster mushroom at home straw sterilization',
        'fix my home wifi router', 'explain the theory of relativity', 'translate hello world into german',
      ],
      bn: [
        'আজকে কি বৃষ্টি হবে', 'কাচ্চি বিরিয়ানি কীভাবে রান্না করে', 'আমাকে একটা মজার কৌতুক বলো', 'একটি প্রেমের কবিতা লিখে দাও',
        'আজকের ক্রিকেট খেলার লাইভ স্কোর কত', 'দ্রুত মেদ কমানোর উপায় কী', '২৫ হাজার টাকার মধ্যে সেরা ফোন কোনটি',
        'বিশ্বকাপ ফুটবল কে জিতেছে', 'বাংলাদেশে আজকের সোনার দাম কত', 'বাসায় খড়ের মধ্যে মাশরুম চাষ করার পদ্ধতি',
        'আমার ওয়াইফাই ইন্টারনেট কাজ করছে না কেন',
      ],
      bl: [
        'ajke brishti hobe kina', 'kacchi biryani kivabe ranna kore', 'ekta funny joke bolo', 'amar jonno ekta kobita likho',
        'cricket khelar score koto', 'weight komanor upay ki', 'valoo phone kon ta', 'world cup ke jitse',
        'basay mushroom chash korbo kemne', 'wifi problem solve koro', 'tumi ki prem koro', 'amar mon kharap',
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// 2. Rich Wrappers and Questions (English, Bangla, Banglish)
// ---------------------------------------------------------------------------

export const WRAPPERS: Record<Lang, string[]> = {
  en: [
    '{S}',
    'please {S}',
    'can you {S}',
    'how do i {S}',
    'i want to {S}',
    'hey, {S} please',
    'is it possible to {S}?',
    'help me {S}',
    '{S} for me',
    'could you {S}?',
    'where can i {S}',
    'i need to {S} now',
    'kindly {S}',
    'how can i {S}?',
    'would you {S} please',
    'let me {S}',
    'what are the steps to {S}?',
    'take me to {S}',
    'open {S}',
    'show {S}',
    'navigate to {S}',
    'where is {S}',
    'how to {S}',
    'i need to access {S}',
    'go to {S} page',
    'show me {S} screen',
    'bring me to {S}',
    'display {S}',
    'show the {S}',
    'can i see {S}',
    'tell me how to {S}',
    'take me right now to {S}',
    'can you immediately open {S}',
    'where do i go to {S}',
    'i would like to {S}',
    'direct me to {S}',
    'pull up {S}',
    'bring up {S} table',
    'show the complete {S}',
    'where or how can i {S}',
    'where can i {S}',
    'how can i {S}',
    'admin asks where or how can i {S}',
    'tell me where or how to {S}',
    'where or how to {S}',
    'execute task to {S}',
    'as a remote agent please {S}',
    'check live status and {S}',
    'perform operation to {S}',
    'deep search and {S}',
    'filter data and {S}',
    'compare results and {S}',
  ],
  bn: [
    '{S}',
    '{S} প্লিজ',
    'দয়া করে {S}',
    'আমি {S}',
    '{S} কিভাবে?',
    '{S} কীভাবে করব?',
    '{S} কেমনে করব?',
    '{S} পারবে?',
    '{S} তো',
    'একটু {S}',
    '{S} দেখতে চাই',
    'আমারে {S} নিয়ে যাও',
    'আমাকে {S} এ নিয়ে যাও',
    '{S} কোথায় পাব?',
    '{S} কোথায় থাকে?',
    '{S} করতে চাই',
    '{S} পেজে যাও',
    '{S} পেজটি খোলো',
    '{S} অপশনটা কোথায়?',
    '{S} নিয়ম কী?',
    'একটু দেখাও {S}',
    '{S} ওপেন করো',
    'আমাকে {S} দেখাও',
    '{S} কীভাবে দেখব?',
    'আমি {S} করতে আগ্রহী',
    'দয়া করে দেখাও {S}',
    '{S} পেজ ওপেন করো',
    '{S} অপশনটা বের করো তো',
    '{S} অবিলম্বে নিয়ে চলো',
    'ঝটপট {S} পেজে যাও',
    '{S} একটু খুলে দাও',
    '{S} তালিকা দেখতে চাচ্ছি',
    '{S} করতে সাহায্য করো',
    'কোথায় বা কিভাবে {S}',
    'কোথায় পাব এবং কীভাবে {S}',
    'অ্যাডমিন জানতে চায় কোথায় বা কিভাবে {S}',
    '{S} কোথায় ও কীভাবে করব',
    'রিমোট এজেন্ট হিসেবে {S}',
    'অপারেশন সম্পন্ন করো এবং {S}',
    'ফিল্টার করে বের করো {S}',
    'লাইভ ডেটা দেখে {S}',
    'তুলে ধরো {S}',
    'সকল জটিল হিসাবসহ {S}',
  ],
  bl: [
    '{S}',
    '{S} plz',
    'please {S}',
    'ektu {S}',
    '{S} kivabe',
    '{S} kibhabe korbo',
    '{S} kemne',
    '{S} kemne korbo',
    'ami {S}',
    'amake {S}',
    'amare {S}',
    '{S} parba?',
    '{S} dekhte chai',
    'amare niye jao {S}',
    'take me to {S}',
    'amake niye jao {S} page e',
    '{S} kothay',
    '{S} kothay ache',
    '{S} kothay pabo',
    '{S} korte chai',
    '{S} page e jao',
    '{S} open koro',
    '{S} dekhao',
    '{S} option ta koi',
    'bujhaye bolo {S}',
    'dekhao to {S}',
    'shune bolo {S}',
    '{S} kivabe pabo',
    'amare {S} page dekhao',
    '{S} visit korte chai',
    'kivabe {S} pabo',
    '{S} open koro to',
    '{S} ekhoni kholo',
    'amare {S} e niye cholo',
    '{S} tab ta koi',
    '{S} form khulte chai',
    '{S} check korbo kivabe',
    '{S} list ta open koro',
    'joldi {S} screen e jao',
    '{S} details dekhan',
    'where or how can i {S}',
    'kothay ba kivabe {S}',
    'kothay gele {S}',
    'admin asks where or how can i {S}',
    'kothay ba kemne {S} korbo',
    'kothay pabo ar kivabe {S}',
    'boloto {S}',
    'ami jante chai {S}',
    'shuno {S}',
    'tell me {S}',
    'can you show me {S}',
    'remote agent hisebe {S}',
    'kaj ta kore {S}',
    'filter kore {S} ber koro',
    'compare kore {S} dekhao',
    'sob live data check kore {S}',
    'jotil hishab shoho {S}',
    'admin bolse {S}',
  ],
};

export const NAMES = {
  employee: [
    'Rahim', 'Karim', 'Sumaiya', 'Tanvir Ahmed', 'Mahmud', 'Arif', 'Habib', 'Sultana', 'Nasrin', 'Jahid',
    'রহিম', 'করিম', 'সুমাইয়া', 'তানভীর আহমেদ', 'মাহমুদ', 'আরিফ', 'সুলতানা', 'নাসরিন',
  ],
  section: [
    'Dhaka Farmers', 'Agro BD', 'Mushroom Lovers', 'Chittagong Agro', 'Green Field', 'Organic BD', 'Sylhet Mushroom',
    'ঢাকা কৃষক', 'এগ্রো বিডি', 'মাশরুম লাভার্স', 'সবুজ খামার',
  ],
};

// ---------------------------------------------------------------------------
// 3. Fast PRNG and Sentence Permutation Synthesizer with Typo Inoculation
// ---------------------------------------------------------------------------

let seed = 42;
export function setSeed(s: number) {
  seed = s >>> 0;
}
export function rand(): number {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
export function pick<T>(list: T[]): T {
  return list[Math.floor(rand() * list.length)];
}

const COMMON_TYPOS: Record<string, string[]> = {
  account: ['acount', 'accout', 'acnt', 'acc'],
  employee: ['employe', 'emloyee', 'emplyee', 'emploee', 'emploe', 'empl'],
  employees: ['employes', 'emloyees', 'emplyees', 'empls'],
  password: ['pasword', 'passwrd', 'paswrd', 'passwod', 'passwd', 'pswd'],
  customer: ['custmr', 'custmer', 'coustomer', 'costomer', 'cumtomer'],
  customers: ['custmrs', 'custmers', 'coustomers', 'costomers'],
  dashboard: ['dshboard', 'dashbord', 'dashbaord', 'dashborad'],
  section: ['sectin', 'sektion', 'sction', 'secton'],
  sections: ['sectins', 'sektions', 'sctions'],
  campaign: ['campegn', 'campain', 'campan', 'campagin'],
  campaigns: ['campegns', 'campains', 'campagins'],
  product: ['prodct', 'produt', 'pruduct', 'poduct'],
  products: ['prodcts', 'produts', 'pruducts'],
  report: ['reprt', 'reprot', 'repor'],
  reports: ['reprts', 'reprots'],
  create: ['crteate', 'creat', 'crate'],
  check: ['chck', 'chek'],
  update: ['updat', 'udpate'],
  register: ['ragister', 'regester', 'registar'],
  settings: ['seting', 'setings', 'settngs', 'setting'],
  leads: ['leed', 'leds', 'leeds'],
  kormi: ['kormy', 'kormee', 'kormira', 'kormider'],
  kalker: ['kalke', 'klaker', 'kalekr', 'kalkeer', 'kalkar', 'kalkr'],
  gotokal: ['gotokaler', 'gotkla', 'gotokaal', 'gotokale'],
  yesterday: ['yesterdays', 'yesterdy', 'yestarday', 'yestrday'],
  tarikh: ['traikh', 'trkh', 'tariq'],
  notun: ['notn', 'notoon', 'nutun'],
  dekhao: ['dehkhao', 'dekao', 'dekho', 'dekaho'],
  kholo: ['khol', 'kolbo', 'kulo'],
  banao: ['bano', 'banaw', 'banau'],
  bosao: ['bosao', 'boshaw', 'bosa'],
  jog: ['jog', 'jug', 'jok'],
  kivabe: ['kibhabe', 'kemne', 'kivbe'],
  kothay: ['kotay', 'kothae', 'koy'],
};

function applyTypo(sentence: string): string {
  const words = sentence.split(' ');
  const i = Math.floor(rand() * words.length);
  const w = words[i];
  if (!w || w.length < 3) return sentence;

  const lowerW = w.toLowerCase();
  // 1. If word has known common typos, pick one
  if (COMMON_TYPOS[lowerW] && rand() < 0.6) {
    words[i] = pick(COMMON_TYPOS[lowerW]);
    return words.join(' ');
  }

  // 2. Bangla matra / character variation
  if (/[ঀ-৿]/.test(w)) {
    if (rand() < 0.5) {
      words[i] = w.replace(/ি/g, 'ী').replace(/ু/g, 'ূ').replace(/শ/g, 'স');
    } else {
      words[i] = w.replace(/ী/g, 'ি').replace(/ূ/g, 'ু').replace(/স/g, 'শ');
    }
    return words.join(' ');
  }

  // 3. Latin character operations (drop, swap, duplicate)
  const roll = rand();
  if (roll < 0.35 && w.length >= 4) {
    // Drop a letter
    const j = 1 + Math.floor(rand() * (w.length - 2));
    words[i] = w.slice(0, j) + w.slice(j + 1);
  } else if (roll < 0.7 && w.length >= 4) {
    // Swap adjacent letters
    const j = 1 + Math.floor(rand() * (w.length - 2));
    words[i] = w.slice(0, j) + w[j + 1] + w[j] + w.slice(j + 2);
  } else {
    // Duplicate a letter
    const j = Math.floor(rand() * w.length);
    words[i] = w.slice(0, j) + w[j] + w.slice(j);
  }

  return words.join(' ');
}

export function synthesizeSentence(intent: MegaIntent): string {
  const lang = pick<Lang>(['en', 'bn', 'bl']);
  let text = '';

  // 25% chance of using an exact direct phrase with a question wrapper
  if (intent.directPhrases[lang].length > 0 && rand() < 0.25) {
    const direct = pick(intent.directPhrases[lang]);
    text = pick(WRAPPERS[lang]).replace('{S}', direct);
  } else {
    // 75% combinatorial synthesis: verb + object + optional entity name
    const verb = pick(intent.verbs[lang]);
    const obj = pick(intent.objects[lang]);
    let core = lang === 'en' ? `${verb} ${obj}` : `${obj} ${verb}`;

    if (intent.nameType && rand() < 0.4) {
      const name = pick(NAMES[intent.nameType]);
      if (lang === 'en') {
        core = pick([`${core} ${name}`, `${core} named ${name}`, `${core} for ${name}`]);
      } else if (lang === 'bn') {
        core = pick([`${name} এর জন্য ${core}`, `${core} ${name}`, `${name} নামে ${core}`]);
      } else {
        core = pick([`${name} er jonno ${core}`, `${core} ${name}`, `${name} name e ${core}`]);
      }
    }

    text = pick(WRAPPERS[lang]).replace('{S}', core.trim());
  }

  // 30% realistic typo injection across all languages
  if (rand() < 0.3) {
    text = applyTypo(text);
  }

  // 15% random title case
  if (rand() < 0.15) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  return text.trim();
}

// ---------------------------------------------------------------------------
// 3b. Specialized Real-World Permutation Generators
// (Employee Creation, Credentials, Sections, Permissions, Sales & Expenses)
// ---------------------------------------------------------------------------

export const EMPLOYEE_NAMES_EN = [
  'Akkas', 'Tanvir', 'Sumaiya', 'Rafiq', 'Hasan', 'Mahmud', 'Arif', 'Habib', 'Sultana',
  'Nasrin', 'Jahid', 'Siyam', 'Kamal', 'Jamal', 'Faruk', 'Nayeem', 'Rashed', 'Shamim',
  'Mehedi', 'Sohan', 'Rubel', 'Shahid', 'Imran', 'Saif', 'Monir', 'Shakil',
];

export const EMPLOYEE_NAMES_BN = [
  'আক্কাস', 'তানভীর', 'সুমাইয়া', 'রফিক', 'হাসান', 'মাহমুদ', 'আরিফ', 'হাবিব', 'সুলতানা',
  'নাসরিন', 'জাহিদ', 'সিয়াম', 'কামাল', 'জামাল', 'ফারুক', 'নাঈম', 'রাশেদ', 'শামীম',
  'মেহেদী', 'সোহান', 'রুবেল', 'শহীদ', 'ইমরান', 'সাইফ', 'মনির', 'শাকিল',
];

export const SECTION_NAMES_EN = [
  'Dhaka Farmers', 'Agro BD', 'Mushroom Lovers', 'Chittagong Agro', 'Green Field',
  'Organic BD', 'Sylhet Mushroom', 'Bogura Agro', 'Farm Fresh', 'Mushroom Valley',
];

export const SECTION_NAMES_BN = [
  'ঢাকা কৃষক', 'এগ্রো বিডি', 'মাশরুম লাভার্স', 'সবুজ খামার', 'চট্টগ্রাম এগ্রো',
  'সিলেট মাশরুম', 'বগুড়া এগ্রো', 'অর্গানিক বিডি',
];

export const PASSWORDS = [
  '123456', '654321', '000000', '112233', 'pass123', 'secret12', 'pass@2026',
  'admin123', 'staff123', '888888', '777777', '987654', 'password', 'pass2025',
];

export const PHONES = [
  '01711223344', '01812345678', '01987654321', '01600112233', '01511223344',
  '+8801712345678', '01700998877', '01311224455',
];

export const PRODUCTS_EN = [
  'Oyster Mushroom', 'Milky Mushroom', 'Dried Mushroom', 'Mushroom Spawn',
  'spawn packet', 'dry mushroom 200g', 'fresh oyster 1kg',
];

export const PRODUCTS_BN = [
  'ঝিনুক মাশরুম', 'দুধ মাশরুম', 'শুকনো মাশরুম', 'মাশরুম স্পন',
  'স্পন প্যাকেট', 'ড্রাই মাশরুম', 'তাজা মাশরুম',
];

export const EXPENSES_EN = [
  'rickshaw fare', 'facebook boost spend', 'packaging poly', 'tea and snacks',
  'delivery courier', 'delivery rider charge', 'printing flyers',
];

export const EXPENSES_BN = [
  'রিকশা ভাড়া', 'ফেসবুক বুস্টিং খরচ', 'প্যাকেজিং পলি', 'চা নাস্তা',
  'ডেলিভারি খরচ', 'কুরিয়ার চার্জ', 'প্রিন্টিং খরচ',
];

function randomEmail(name: string): string {
  const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'staff';
  const domain = pick(['gmail.com', 'company.com', 'yahoo.com', 'outlook.com']);
  const suffix = rand() < 0.3 ? String(Math.floor(rand() * 900) + 100) : '';
  return `${clean}${suffix}@${domain}`;
}

export function synthesizeEmployeePattern(): { text: string; label: string } {
  const nameEn = pick(EMPLOYEE_NAMES_EN);
  const nameBn = pick(EMPLOYEE_NAMES_BN);
  const pass = pick(PASSWORDS);
  const phone = pick(PHONES);
  const email = randomEmail(nameEn);

  const templates = [
    // Banglish single-line
    `${nameEn} nam er employee profile banao email ${email} password ${pass}`,
    `${nameEn} nam er employee profile banao ${email} ${pass}`,
    `${nameEn} er employee id banao password ${pass} email ${email}`,
    `${nameEn} er employee id banao pass ${pass} email ${email}`,
    `${nameEn} namer employee profile banao email ${email} pass ${pass}`,
    `${nameEn} er jonno employee account banao email ${email} pass ${pass}`,
    `${nameEn} er employee profile banao pass ${pass} email ${email}`,
    `${nameEn} er kormi profile banao pass ${pass} mail ${email}`,
    `${nameEn} namer kormi id banao password ${pass} email ${email}`,
    `${nameEn} er kormi id banao pass ${pass}`,
    `${nameEn} er employee id banao`,
    `notun employee banao nam ${nameEn} pass ${pass} email ${email}`,
    `notun kormi account banao nam ${nameEn} pass ${pass} email ${email}`,
    `notun kormi profile banao ${nameEn} pass ${pass} mail ${email}`,
    `create employee profile ${nameEn} email ${email} pass ${pass}`,
    `add employee ${nameEn} phone ${phone} pass ${pass}`,
    `kormi profile create koro name: ${nameEn} email: ${email} pass: ${pass}`,
    `notun staff register koro nam ${nameEn} pass ${pass}`,

    // Banglish multiline
    `${nameEn} nam er employee profile banao\n${email}\n${pass}`,
    `${nameEn} nam er employee profile banao\n${email}\n${phone}`,
    `${nameEn} er employee id banao\npassword ${pass}\nemail ${email}`,
    `${nameEn} namer employee profile banao\nemail: ${email}\npass: ${pass}`,
    `${nameEn} er kormi profile banao\n${email}\n${pass}`,
    `${nameEn} er employee id banao\n${pass}\n${email}`,
    `notun kormi banao\nnam: ${nameEn}\nmail: ${email}\npass: ${pass}`,
    `create employee profile for ${nameEn}\n${email}\n${pass}`,

    // Plain multiline credentials (critical permutation!)
    `${nameEn}\n${email}\n${pass}`,
    `${nameEn}\n${phone}\n${pass}`,
    `${nameEn}\n${pass}\n${email}`,
    `${nameBn}\n${email}\n${pass}`,
    `${nameBn}\n${phone}\n${pass}`,
    `name: ${nameEn}\nemail: ${email}\npassword: ${pass}`,
    `nam: ${nameEn}\nemail: ${email}\npass: ${pass}`,
    `নাম: ${nameBn}\nইমেইল: ${email}\nপাসওয়ার্ড: ${pass}`,
    `নাম: ${nameBn}\nফোন: ${phone}\nপাসওয়ার্ড: ${pass}`,
    `Name: ${nameEn}\nPass: ${pass}\nMail: ${email}`,
    `employee:\nname: ${nameEn}\nmail: ${email}\npass: ${pass}`,

    // Bangla single-line & multiline
    `${nameBn} নামের কর্মী প্রোফাইল বানাও ইমেইল ${email} পাসওয়ার্ড ${pass}`,
    `${nameBn} নামের কর্মী প্রোফাইল বানাও ${email} ${pass}`,
    `${nameBn} এর কর্মী আইডি বানাও পাসওয়ার্ড ${pass} ইমেইল ${email}`,
    `${nameBn} নামের নতুন কর্মী যুক্ত করো পাসওয়ার্ড ${pass}`,
    `${nameBn} এর জন্য কর্মী অ্যাকাউন্ট তৈরি করো ইমেইল ${email} পাসওয়ার্ড ${pass}`,
    `নতুন কর্মীর অ্যাকাউন্ট খোলো নাম ${nameBn} পাসওয়ার্ড ${pass}`,
    `কর্মী প্রোফাইল তৈরি করো নাম: ${nameBn} পাসওয়ার্ড: ${pass} ইমেইল: ${email}`,
    `${nameBn} নামের কর্মী প্রোফাইল বানাও\n${email}\n${pass}`,
    `${nameBn} এর কর্মী আইডি বানাও\nপাসওয়ার্ড: ${pass}\nইমেইল: ${email}`,
    `নতুন কর্মী প্রোফাইল তৈরি করো:\nনাম: ${nameBn}\nইমেইল: ${email}\nপাসওয়ার্ড: ${pass}`,

    // Questions / How-to variations (critical for queries like "kormi add korbo kivabe")
    `kormi add korbo kivabe`,
    `kivabe kormi add korbo`,
    `kormi kivabe jog korbo`,
    `notun kormi kivabe add korbo`,
    `kivabe notun employee account khulbo`,
    `employee profile kivabe banabo`,
    `kormi add korte chai kivabe korbo`,
    `employee kivabe register korbo`,
    `kivabe employee list dekhte pabo`,
    `kormi kothay add korbo`,
    `notun staff kothay add kore`,
    `কর্মী কীভাবে যোগ করব`,
    `কর্মী যোগ করব কিভাবে`,
    `নতুন কর্মী যোগ করব কিভাবে`,
    `নতুন কর্মী যোগ করব কিভাবে?`,
    `কীভাবে নতুন কর্মী যুক্ত করব`,
    `নতুন কর্মীর অ্যাকাউন্ট কীভাবে খুলব`,
    `কর্মী প্রোফাইল কীভাবে তৈরি করব`,
    `নতুন কর্মী কোথায় যোগ করব`,
    `how do i add an employee`,
    `how to add new employee`,
    `how can i create employee profile`,
    `where do i register new staff`,
    `where can i manage employees`,
    `where do i add new employee`,

    // English single-line & multiline
    `create employee profile for ${nameEn} with email ${email} and password ${pass}`,
    `make employee id for ${nameEn} password ${pass} email ${email}`,
    `add new employee named ${nameEn} email ${email} password ${pass}`,
    `register staff member ${nameEn} password ${pass} email ${email}`,
    `create an employee account name: ${nameEn} pass: ${pass} email: ${email}`,
    `create employee profile for ${nameEn}\n${email}\n${pass}`,
    `add employee:\nname: ${nameEn}\nemail: ${email}\npassword: ${pass}`,
  ];

  let text = pick(templates);
  if (rand() < 0.25 && !text.includes('\n')) {
    const lang = pick<Lang>(['en', 'bn', 'bl']);
    text = pick(WRAPPERS[lang]).replace('{S}', text);
  }
  if (rand() < 0.2) text = applyTypo(text);
  return { text, label: '/admin/employees' };
}

export function synthesizeAssignmentAndPermissionPattern(): { text: string; label: string } {
  const nameEn = pick(EMPLOYEE_NAMES_EN);
  const nameBn = pick(EMPLOYEE_NAMES_BN);
  const secEn = pick(SECTION_NAMES_EN);
  const secBn = pick(SECTION_NAMES_BN);

  const templates = [
    // Section assignment
    `${nameEn} ke ${secEn} section e assign koro`,
    `${nameEn} ke ${secEn} group e diye dao`,
    `${nameEn} ke ${secEn} section assign korte chai`,
    `${nameBn} কে ${secBn} সেকশনে যুক্ত করো`,
    `${nameBn}-কে ${secBn} গ্রুপ বরাদ্দ দাও`,
    `assign ${nameEn} to ${secEn} section`,
    `allocate ${secEn} group to employee ${nameEn}`,
    `assign section ${secEn} to ${nameEn}`,

    // Permissions (Full customer view toggle)
    `${nameEn} ke sob customer dekhar access dao`,
    `${nameEn} ke sob lead dekhar permission dao`,
    `${nameEn} ke full customer database access dao`,
    `${nameEn} er customer view permission on koro`,
    `${nameEn} er sob customer access bondho koro`,
    `${nameEn} er customer permission off koro`,
    `${nameBn} কে সম্পূর্ণ কাস্টমার ডেটাবেস দেখার অনুমতি দাও`,
    `${nameBn} এর কাস্টমার দেখার পারমিশন বন্ধ করো`,
    `grant ${nameEn} permission to view all customers`,
    `allow ${nameEn} full access to customer leads`,
    `revoke customer access for ${nameEn}`,
    `disable full customer view for ${nameEn}`,
    `turn off customer database access for ${nameEn}`,
  ];

  let text = pick(templates);
  if (rand() < 0.2) text = applyTypo(text);
  return { text, label: '/admin/employees' };
}

export function synthesizeDailySalesExpensePattern(): { text: string; label: string } {
  const prodEn = pick(PRODUCTS_EN);
  const prodBn = pick(PRODUCTS_BN);
  const expEn = pick(EXPENSES_EN);
  const expBn = pick(EXPENSES_BN);
  const amount1 = Math.floor(rand() * 90 + 10) * 100;
  const amount2 = Math.floor(rand() * 20 + 5) * 50;
  const qty = Math.floor(rand() * 15 + 1);

  const isEmployeeEntry = rand() < 0.65;
  if (isEmployeeEntry) {
    const templates = [
      `Ajker bikri:\n${prodEn} ${qty} ta ${amount1} tk\nKhoroch:\n${expEn} ${amount2} taka`,
      `Daily entry:\nSold ${qty} packets of ${prodEn} for ${amount1} BDT\nAd spend: ${amount2} tk`,
      `আজকের দৈনিক এন্ট্রি:\n${prodBn} ${qty} টি বিক্রি ${amount1} টাকা\nখরচ: ${expBn} ${amount2} টাকা`,
      `bikri o khoroch entry:\nsales ${amount1} tk, cost ${amount2} tk`,
      `daily sales entry:\n${prodEn} ${amount1} taka`,
      `ajker sale entry dao:\n${prodEn} ${qty} piece ${amount1} tk`,
      `khoroch entry:\n${expEn} ${amount2} tk`,
      `expense log:\n${expEn} ${amount2} taka`,
      `ajke ${qty} packet ${prodEn} sell korlam ${amount1} taka`,
      `ajker bikri entry:\n${amount1} taka bikri\n${amount2} taka khoroch`,
    ];
    let text = pick(templates);
    if (rand() < 0.2) text = applyTypo(text);
    return { text, label: '/employee/daily-entry' };
  } else {
    const templates = [
      `ajker total sales koto holo`,
      `ajker mot bikri o khoroch koto`,
      `today daily sales and revenue report`,
      `show today daily report with employee wise sales`,
      `আজকের মোট বিক্রি এবং খরচ কত হয়েছে দেখাও`,
      `দৈনিক সেলস এবং খরচের সারসংক্ষেপ দেখতে চাই`,
      `kalker sales report dekhao`,
      `yesterday total daily sales`,
      `daily report page kholo`,
      `আজকের বিক্রি ও খরচের হিসাব দেখাও`,
    ];
    let text = pick(templates);
    if (rand() < 0.2) text = applyTypo(text);
    return { text, label: '/admin/reports/daily' };
  }
}

export function synthesizeSectionAndLinksPattern(): { text: string; label: string } {
  const secEn = pick(SECTION_NAMES_EN);
  const secBn = pick(SECTION_NAMES_BN);
  const id1 = Math.floor(rand() * 899999 + 100000);
  const id2 = Math.floor(rand() * 899999 + 100000);

  const templates = [
    `notun section banao ${secEn}`,
    `create new section named ${secEn}`,
    `নতুন সেকশন তৈরি করো ${secBn}`,
    `ekta facebook group section kholo ${secEn}`,
    `add links to ${secEn}:\nhttps://facebook.com/groups/${id1}\nhttps://facebook.com/groups/${id2}`,
    `${secEn} e link add koro:\nhttps://facebook.com/groups/${id1}\nhttps://facebook.com/groups/${id2}`,
    `লিংক যোগ করো ${secBn} সেকশনে:\nhttps://facebook.com/groups/${id1}\nhttps://facebook.com/groups/${id2}`,
    `bulk upload links to ${secEn}:\nhttps://facebook.com/groups/${id1}`,
  ];

  let text = pick(templates);
  if (rand() < 0.2) text = applyTypo(text);
  return { text, label: '/admin/sections' };
}

// ---------------------------------------------------------------------------
// 4. Memory-Efficient Streaming Trainer
// ---------------------------------------------------------------------------

export interface TrainMegaOptions {
  totalCount: number;
  holdout?: string;
  outputPath?: string;
  examWeight?: number;
  minFreq?: number;
  dryRun?: boolean;
}

export async function trainMega(options: TrainMegaOptions) {
  const {
    totalCount = 1_000_000,
    holdout = 'exam4.json',
    outputPath = join(__dirname, '../../src/lib/agent/model.json'),
    examWeight = 12,
    minFreq = 2,
    dryRun = false,
  } = options;

  console.log(`\n======================================================`);
  console.log(`🚀 Starting High-Volume Permutation Training (~${totalCount.toLocaleString()} examples)`);
  console.log(`Target Output: ${outputPath}`);
  console.log(`Holdout file: ${holdout} | Exam Weight: ${examWeight} | Min Feature Freq: ${minFreq}`);
  console.log(`======================================================\n`);

  // Step 1: Collect all distinct classes
  const allClassesSet = new Set<string>();
  for (const intent of MEGA_INTENTS) {
    allClassesSet.add(intent.label);
  }

  // Ingest hand-written exam sets for ground-truth coverage
  const examItems: { text: string; label: string; weight: number }[] = [];
  for (const file of ['exam.json', 'exam2.json', 'exam3.json', 'exam4.json']) {
    if (file === holdout) {
      console.log(`🛡️  Holding out ${file} from training corpus.`);
      continue;
    }
    const path = join(__dirname, file);
    if (!existsSync(path)) continue;
    const list = JSON.parse(readFileSync(path, 'utf8')) as { text: string; expect: string }[];
    for (const it of list) {
      examItems.push({ text: it.text, label: it.expect, weight: examWeight });
      allClassesSet.add(it.expect);
    }
  }

  // Ingest grounded questions & variations from subagent1_lexicon.json
  const lexiconPath = '/Users/mdyeakubsarker/.gemini/antigravity-cli/brain/29fc42ea-23fa-4978-b634-aa78e52ee977/scratch/subagent1_lexicon.json';
  if (existsSync(lexiconPath)) {
    try {
      const lexData = JSON.parse(readFileSync(lexiconPath, 'utf8'));
      if (lexData.routes && Array.isArray(lexData.routes)) {
        let lexCount = 0;
        for (const r of lexData.routes) {
          let target = r.route;
          if (target.startsWith('/admin/sections/')) target = '/admin/sections';
          if (!allClassesSet.has(target)) {
            if (target.startsWith('/admin')) target = '/admin/dashboard';
            else if (target.startsWith('/employee')) target = '/employee/dashboard';
            else target = 'ANSWER';
          }
          if (r.common_questions) {
            for (const lang of ['en', 'bn', 'bl'] as Lang[]) {
              for (const q of r.common_questions[lang] || []) {
                examItems.push({ text: q, label: target, weight: examWeight });
                lexCount++;
              }
            }
          }
          if (r.colloquial_variations) {
            for (const lang of ['en', 'bn', 'bl'] as Lang[]) {
              for (const v of r.colloquial_variations[lang] || []) {
                examItems.push({ text: v, label: target, weight: Math.floor(examWeight / 2) });
                lexCount++;
              }
            }
          }
        }
        console.log(`📚 Ingested ${lexCount} grounded website questions & variations from lexicon.`);
      }
    } catch (err) {
      console.warn('Could not load lexicon:', err);
    }
  }

  const classes = Array.from(allClassesSet).sort();
  const numClasses = classes.length;
  const idx = new Map(classes.map((c, i) => [c, i]));

  console.log(`Registered ${numClasses} intent classes.`);

  // Step 2: Initialize counts with compact numeric arrays to avoid V8 memory bloat
  const docCount = new Uint32Array(numClasses);
  const totals = new Uint32Array(numClasses);
  const counts = new Map<string, Int32Array>();

  const startTime = Date.now();

  // Step 3: Stream exam items into count tables
  console.log(`Feeding ${examItems.length.toLocaleString()} weighted exam examples...`);
  for (const item of examItems) {
    const c = idx.get(item.label);
    if (c === undefined) continue;
    docCount[c] += item.weight;
    for (const f of features(item.text)) {
      let row = counts.get(f);
      if (!row) {
        row = new Int32Array(numClasses);
        counts.set(f, row);
      }
      row[c] += item.weight;
      totals[c] += item.weight;
    }
  }

  // Step 4: Stream synthesized permutations directly into counts
  console.log(`Streaming ${totalCount.toLocaleString()} synthetic natural language permutations...`);
  const intentsLen = MEGA_INTENTS.length;

  for (let i = 1; i <= totalCount; i++) {
    // Uniformly sample across all system classes to maintain balanced likelihood denominators
    const intent = MEGA_INTENTS[i % intentsLen];
    const label = intent.label;
    let text = '';

    if (label === '/admin/employees') {
      const r = rand();
      if (r < 0.55) {
        text = synthesizeEmployeePattern().text;
      } else if (r < 0.80) {
        text = synthesizeAssignmentAndPermissionPattern().text;
      } else {
        text = synthesizeSentence(intent);
      }
    } else if (label === '/employee/daily-entry') {
      if (rand() < 0.60) {
        text = synthesizeDailySalesExpensePattern().text;
      } else {
        text = synthesizeSentence(intent);
      }
    } else if (label === '/admin/reports/daily') {
      if (rand() < 0.40) {
        text = synthesizeDailySalesExpensePattern().text;
      } else {
        text = synthesizeSentence(intent);
      }
    } else if (label === '/admin/sections') {
      if (rand() < 0.50) {
        text = synthesizeSectionAndLinksPattern().text;
      } else {
        text = synthesizeSentence(intent);
      }
    } else {
      text = synthesizeSentence(intent);
    }

    const c = idx.get(label)!;
    if (c === undefined) continue;

    docCount[c] += 1;

    for (const f of features(text)) {
      let row = counts.get(f);
      if (!row) {
        row = new Int32Array(numClasses);
        counts.set(f, row);
      }
      row[c] += 1;
      totals[c] += 1;
    }

    if (i % 100_000 === 0 || i === totalCount) {
      const elapsedSec = (Date.now() - startTime) / 1000;
      const rate = Math.round(i / (elapsedSec || 1));
      const memMb = Math.round(process.memoryUsage().heapUsed / (1024 * 1024));
      const pct = ((i / totalCount) * 100).toFixed(0);
      console.log(`  ⚡ [${pct}%] ${i.toLocaleString()} / ${totalCount.toLocaleString()} generated (${rate.toLocaleString()} ex/sec, heap: ${memMb} MB)`);
    }
  }

  const generationTimeSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nSynthesized total stream in ${generationTimeSec}s. Pruning low-frequency noise (minFreq >= ${minFreq})...`);

  // Step 5: Prune features and build sparse matrix
  const sparse: Record<string, number[]> = {};
  let totalFeaturesBefore = counts.size;

  for (const [f, row] of counts) {
    let sum = 0;
    for (let c = 0; c < numClasses; c++) sum += row[c];
    if (sum < minFreq) continue;

    const s: number[] = [];
    for (let c = 0; c < numClasses; c++) {
      if (row[c] > 0) s.push(c, row[c]);
    }
    sparse[f] = s;
  }

  const prunedVocabSize = Object.keys(sparse).length;
  console.log(`Vocabulary pruned: ${totalFeaturesBefore.toLocaleString()} features -> ${prunedVocabSize.toLocaleString()} active n-grams.`);

  // Step 6: Construct Naive Bayes model object
  let totalDocs = 0;
  for (let c = 0; c < numClasses; c++) totalDocs += docCount[c];

  const model = {
    classes,
    prior: Array.from(docCount).map((d) => Math.log((d + 1) / (totalDocs + numClasses))),
    totals: Array.from(totals),
    vocabSize: prunedVocabSize,
    counts: sparse,
  };

  // Step 7: Write to model.json unless dryRun is set
  if (!dryRun) {
    console.log(`Writing trained model to ${outputPath}...`);
    writeFileSync(outputPath, JSON.stringify(model));
    console.log(`✅ Model successfully written! Size: ${(Buffer.byteLength(JSON.stringify(model)) / (1024 * 1024)).toFixed(2)} MB`);
  } else {
    console.log(`[Dry Run] Model not written to disk.`);
  }

  console.log(`\n🎉 Training complete in ${((Date.now() - startTime) / 1000).toFixed(1)} seconds!`);
  return model;
}

// ---------------------------------------------------------------------------
// CLI Execution
// ---------------------------------------------------------------------------

if (require.main === module || (typeof process !== 'undefined' && process.argv[1]?.endsWith('train-mega.ts'))) {
  const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  const count = Number(arg('count') ?? 1_000_000);
  const holdout = arg('holdout') ?? 'exam4.json';
  const out = arg('out') ?? join(__dirname, '../../src/lib/agent/model.json');
  const examWeight = Number(arg('exam-weight') ?? 12);
  const minFreq = Number(arg('min-freq') ?? 2);
  const dryRun = process.argv.includes('--dry-run');

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
}
