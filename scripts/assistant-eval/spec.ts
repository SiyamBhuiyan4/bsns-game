// Test vocabulary for the admin assistant, written independently of src/lib/agent/knowledge.ts
// so the evaluation finds real gaps instead of echoing the assistant's own keyword lists.
// Each intent lists how admins might phrase the action and the thing, in English, Bangla and Banglish.

export type Lang = 'en' | 'bn' | 'bl'; // bl = Banglish (Bangla in Latin letters)

export type IntentSpec = {
  /** Expected topic id from knowledge.ts, or a special label. */
  expect: string;
  /** Page the admin must end up on (null = answer only, no page). */
  page: string | null;
  verbs: Record<Lang, string[]>;
  objects: Record<Lang, string[]>;
  /** Insert a random name into the sentence. */
  name?: 'employee' | 'section';
};

const none: Record<Lang, string[]> = { en: [''], bn: [''], bl: [''] };

export const INTENTS: IntentSpec[] = [
  { expect: 'add_employee', page: '/admin/employees', name: 'employee',
    verbs: { en: ['add', 'create', 'register', 'make', 'onboard', 'add new', 'set up', 'enter'], bn: ['যোগ করো', 'যোগ করব', 'যুক্ত করো', 'তৈরি করো', 'নতুন বানাও', 'অ্যাড করো', 'যোগ করতে চাই'], bl: ['add koro', 'add korbo', 'jog koro', 'notun banao', 'add korte chai'] },
    objects: { en: ['an employee', 'a new employee', 'staff', 'a staff member', 'a team member', 'a marketer', 'a worker', 'new member', 'a user'], bn: ['কর্মী', 'নতুন কর্মী', 'স্টাফ', 'টিম মেম্বার', 'মার্কেটার', 'একজন লোক', 'কর্মচারী'], bl: ['kormi', 'notun kormi', 'staff', 'team member', 'marketer', 'employee'] } },
  { expect: 'edit_employee', page: '/admin/employees', name: 'employee',
    verbs: { en: ['edit', 'change', 'update', 'modify', 'correct', 'fix'], bn: ['এডিট করো', 'পরিবর্তন করো', 'বদলাও', 'আপডেট করো', 'ঠিক করো'], bl: ['edit koro', 'change koro', 'update koro', 'bodlao', 'thik koro'] },
    objects: { en: ["employee's phone number", 'employee details', 'staff info', 'employee name', 'the email of an employee', 'team member details'], bn: ['কর্মীর ফোন নম্বর', 'কর্মীর তথ্য', 'কর্মীর নাম', 'কর্মীর ইমেইল', 'স্টাফের তথ্য'], bl: ['kormir phone number', 'kormir info', 'employee details', 'kormir nam'] } },
  { expect: 'reset_password', page: '/admin/employees', name: 'employee',
    verbs: { en: ['reset', 'change', 'recover', 'fix', 'set a new'], bn: ['রিসেট করো', 'বদলাও', 'নতুন দাও', 'ঠিক করো'], bl: ['reset koro', 'change koro', 'notun dao'] },
    objects: { en: ['employee password', "staff member's password", 'forgotten password', 'the password of a worker', 'login password'], bn: ['কর্মীর পাসওয়ার্ড', 'ভুলে যাওয়া পাসওয়ার্ড', 'স্টাফের পাসওয়ার্ড'], bl: ['kormir password', 'password', 'vule jaoa password'] } },
  { expect: 'assign_section', page: '/admin/employees', name: 'employee',
    verbs: { en: ['assign', 'give', 'allocate', 'allot', 'attach'], bn: ['অ্যাসাইন করো', 'বরাদ্দ দাও', 'দিয়ে দাও', 'দিতে চাই'], bl: ['assign koro', 'diye dao', 'dite chai'] },
    objects: { en: ['a section to an employee', 'groups to a staff member', 'a group to a marketer', 'sections to the team', 'section to worker'], bn: ['কর্মীকে সেকশন', 'কর্মীকে গ্রুপ', 'মার্কেটারকে সেকশন', 'স্টাফকে গ্রুপ'], bl: ['kormike section', 'kormike group', 'staff ke section'] } },
  { expect: 'view_employee', page: '/admin/employees', name: 'employee',
    verbs: { en: ['show', 'check', 'see', 'view', 'look at', 'find'], bn: ['দেখাও', 'চেক করো', 'দেখতে চাই', 'খুঁজে দাও'], bl: ['dekhao', 'check koro', 'dekhte chai', 'khuje dao'] },
    objects: { en: ['employee performance', 'staff progress', 'the status of an employee', 'how my team is doing', 'employee list', 'all staff'], bn: ['কর্মীর পারফরম্যান্স', 'কর্মীর অগ্রগতি', 'কর্মীর অবস্থা', 'সব কর্মী', 'কর্মীদের তালিকা'], bl: ['kormir performance', 'kormider list', 'sob kormi', 'kormir obostha'] } },

  { expect: 'add_section', page: '/admin/sections', name: 'section',
    verbs: { en: ['create', 'add', 'make', 'set up', 'start', 'open a new'], bn: ['তৈরি করো', 'বানাও', 'যোগ করো', 'খোলো', 'নতুন বানাও'], bl: ['banao', 'add koro', 'create koro', 'notun kholo'] },
    objects: { en: ['a new group', 'a section', 'a new section', 'a facebook group section', 'a group category'], bn: ['নতুন গ্রুপ', 'সেকশন', 'নতুন সেকশন', 'গ্রুপ সেকশন'], bl: ['notun group', 'section', 'notun section', 'group section'] } },
  { expect: 'add_link', page: '/admin/sections', name: 'section',
    verbs: { en: ['add', 'put', 'insert', 'save', 'paste'], bn: ['যোগ করো', 'যুক্ত করো', 'দাও', 'সেভ করো'], bl: ['add koro', 'jog koro', 'dao', 'save koro'] },
    objects: { en: ['links to a group', 'a facebook link to a section', 'a group link', 'urls into a section', 'a new link'], bn: ['গ্রুপে লিংক', 'সেকশনে লিংক', 'ফেসবুক লিংক', 'নতুন লিংক'], bl: ['group e link', 'section e link', 'facebook link', 'notun link'] } },
  { expect: 'upload_csv', page: '/admin/sections',
    verbs: { en: ['upload', 'import', 'bulk upload', 'add many', 'load'], bn: ['আপলোড করো', 'একসাথে যোগ করো', 'ইমপোর্ট করো'], bl: ['upload koro', 'eksathe add koro', 'import koro'] },
    objects: { en: ['a csv file', 'csv', 'an excel sheet of links', 'many links at once', 'a file with links'], bn: ['সিএসভি ফাইল', 'CSV ফাইল', 'অনেক লিংক', 'লিংকের ফাইল'], bl: ['csv file', 'onek link', 'link er file'] } },
  { expect: 'deactivate_links', page: '/admin/sections',
    verbs: { en: ['deactivate', 'disable', 'turn off', 'remove', 'stop'], bn: ['বন্ধ করো', 'নিষ্ক্রিয় করো', 'বাদ দাও', 'সরাও'], bl: ['bondho koro', 'off koro', 'bad dao'] },
    objects: { en: ['some links', 'old links', 'all links in a section', 'dead group links'], bn: ['কিছু লিংক', 'পুরনো লিংক', 'সব লিংক'], bl: ['kichu link', 'purono link', 'sob link'] } },
  { expect: 'upload_history', page: '/admin/csv/history',
    verbs: { en: ['show', 'see', 'check', 'view'], bn: ['দেখাও', 'দেখতে চাই'], bl: ['dekhao', 'dekhte chai'] },
    objects: { en: ['upload history', 'past uploads', 'previous csv uploads'], bn: ['আপলোড ইতিহাস', 'আগের আপলোড'], bl: ['upload history', 'ager upload'] } },

  { expect: 'add_product', page: '/admin/products',
    verbs: { en: ['add', 'create', 'list', 'register'], bn: ['যোগ করো', 'যুক্ত করো', 'তৈরি করো'], bl: ['add koro', 'jog koro'] },
    objects: { en: ['a product', 'a new product', 'a new mushroom item', 'an item'], bn: ['পণ্য', 'নতুন পণ্য', 'প্রোডাক্ট', 'মাশরুম পণ্য'], bl: ['product', 'notun product', 'ponno'] } },
  { expect: 'edit_product', page: '/admin/products',
    verbs: { en: ['change', 'update', 'edit', 'increase', 'reduce'], bn: ['বদলাও', 'আপডেট করো', 'পরিবর্তন করো', 'বাড়াও', 'কমাও'], bl: ['change koro', 'update koro', 'bariye dao', 'komao'] },
    objects: { en: ['product price', 'the price of a product', 'product details', 'mushroom price'], bn: ['পণ্যের দাম', 'প্রোডাক্টের দাম', 'পণ্যের তথ্য'], bl: ['product er dam', 'ponner dam'] } },
  { expect: 'add_campaign', page: '/admin/campaigns',
    verbs: { en: ['create', 'start', 'add', 'launch', 'run'], bn: ['তৈরি করো', 'শুরু করো', 'চালু করো', 'যোগ করো'], bl: ['create koro', 'shuru koro', 'chalu koro'] },
    objects: { en: ['a campaign', 'a new facebook ad', 'an ad campaign', 'a boost'], bn: ['ক্যাম্পেইন', 'নতুন বিজ্ঞাপন', 'ফেসবুক অ্যাড'], bl: ['campaign', 'notun ad', 'facebook ad'] } },
  { expect: 'edit_campaign', page: '/admin/campaigns',
    verbs: { en: ['pause', 'edit', 'change', 'check', 'stop'], bn: ['থামাও', 'এডিট করো', 'বদলাও', 'দেখাও'], bl: ['pause koro', 'edit koro', 'dekhao'] },
    objects: { en: ['a campaign', 'campaign spend', 'campaign budget', 'ad spend', 'roas'], bn: ['ক্যাম্পেইন', 'ক্যাম্পেইনের খরচ', 'ক্যাম্পেইনের বাজেট'], bl: ['campaign', 'campaign er khoroch'] } },

  { expect: 'add_lead', page: '/admin/leads',
    verbs: { en: ['add', 'create', 'enter', 'record', 'save'], bn: ['যোগ করো', 'যুক্ত করো', 'এন্ট্রি দাও', 'সেভ করো'], bl: ['add koro', 'entry dao', 'save koro'] },
    objects: { en: ['a lead', 'a new customer', 'a buyer', 'a new client', 'a potential customer'], bn: ['লিড', 'নতুন কাস্টমার', 'ক্রেতা', 'নতুন গ্রাহক'], bl: ['lead', 'notun customer', 'kreta'] } },
  { expect: 'lead_stage', page: '/admin/leads',
    verbs: { en: ['move', 'change', 'mark', 'update'], bn: ['বদলাও', 'আপডেট করো', 'সরাও'], bl: ['change koro', 'update koro'] },
    objects: { en: ['lead stage', 'a lead to ordered', 'lead status', 'a customer to lost', 'the pipeline stage'], bn: ['লিডের স্টেজ', 'লিডের অবস্থা', 'লিড অর্ডারে'], bl: ['lead er stage', 'lead status'] } },
  { expect: 'followup', page: '/admin/leads',
    verbs: { en: ['add', 'write', 'see', 'check'], bn: ['লিখো', 'যোগ করো', 'দেখাও'], bl: ['likho', 'add koro', 'dekhao'] },
    objects: { en: ['a follow-up note', 'followup notes', 'a note on a lead', 'follow up'], bn: ['ফলোআপ নোট', 'লিডে নোট', 'ফলোআপ'], bl: ['followup note', 'follow up'] } },

  { expect: 'set_target', page: '/admin/targets',
    verbs: { en: ['set', 'add', 'create', 'change', 'define'], bn: ['সেট করো', 'ঠিক করো', 'বদলাও', 'দাও'], bl: ['set koro', 'thik koro', 'change koro'] },
    objects: { en: ['a monthly target', 'sales targets', 'a goal for a section', 'targets'], bn: ['মাসিক টার্গেট', 'বিক্রির লক্ষ্য', 'টার্গেট', 'লক্ষ্যমাত্রা'], bl: ['target', 'monthly target', 'sales target'] } },
  { expect: 'copy_targets', page: '/admin/targets',
    verbs: { en: ['copy', 'duplicate', 'reuse'], bn: ['কপি করো'], bl: ['copy koro'] },
    objects: { en: ['targets to next month', "last month's targets"], bn: ['টার্গেট পরের মাসে', 'আগের মাসের টার্গেট'], bl: ['target porer mashe'] } },
  { expect: 'set_budget', page: '/admin/targets',
    verbs: { en: ['set', 'add', 'change', 'increase', 'check'], bn: ['সেট করো', 'ঠিক করো', 'বাড়াও', 'দেখাও'], bl: ['set koro', 'baraw', 'dekhao'] },
    objects: { en: ['the monthly budget', 'marketing budget', 'ad budget', 'budget limit'], bn: ['মাসিক বাজেট', 'মার্কেটিং বাজেট', 'বাজেট'], bl: ['budget', 'monthly budget'] } },

  { expect: 'report_daily', page: '/admin/reports/daily',
    verbs: { en: ['show', 'open', 'see', 'check', 'give me'], bn: ['দেখাও', 'খোলো', 'দেখতে চাই'], bl: ['dekhao', 'kholo', 'dekhte chai'] },
    objects: { en: ["today's report", 'the daily report', "today's sales", 'daily sales report'], bn: ['আজকের রিপোর্ট', 'দৈনিক রিপোর্ট', 'আজকের বিক্রি'], bl: ['ajker report', 'daily report', 'ajker sale'] } },
  { expect: 'report_weekly', page: '/admin/reports/weekly',
    verbs: { en: ['show', 'open', 'publish', 'write', 'check'], bn: ['দেখাও', 'খোলো', 'প্রকাশ করো'], bl: ['dekhao', 'kholo', 'publish koro'] },
    objects: { en: ['the weekly report', "this week's report", 'weekly review'], bn: ['সাপ্তাহিক রিপোর্ট', 'এই সপ্তাহের রিপোর্ট'], bl: ['weekly report', 'saptahik report'] } },
  { expect: 'report_monthly', page: '/admin/reports/monthly',
    verbs: { en: ['show', 'open', 'see', 'check'], bn: ['দেখাও', 'খোলো'], bl: ['dekhao', 'kholo'] },
    objects: { en: ['the monthly report', "this month's report", 'monthly ranking'], bn: ['মাসিক রিপোর্ট', 'এই মাসের রিপোর্ট', 'মাসিক র‍্যাংকিং'], bl: ['monthly report', 'masik report'] } },

  { expect: 'plan_task', page: '/admin/plan',
    verbs: { en: ['add', 'show', 'update', 'create', 'check'], bn: ['যোগ করো', 'দেখাও', 'আপডেট করো'], bl: ['add koro', 'dekhao', 'update koro'] },
    objects: { en: ['a task to the 90 day plan', 'the 90-day plan', 'plan milestones', 'a new task'], bn: ['৯০ দিনের প্ল্যান', 'প্ল্যানে টাস্ক', 'মাইলস্টোন'], bl: ['90 diner plan', 'plan e task', 'milestone'] } },
  { expect: 'settings_score', page: '/admin/settings',
    verbs: { en: ['change', 'adjust', 'set', 'update'], bn: ['বদলাও', 'সেট করো', 'ঠিক করো'], bl: ['change koro', 'set koro'] },
    objects: { en: ['scoring weights', 'the failing threshold', 'score settings', 'achievement cap'], bn: ['স্কোরিং সেটিংস', 'স্কোরের ওজন', 'ব্যর্থতা থ্রেশহোল্ড'], bl: ['scoring settings', 'score er weight'] } },
  { expect: 'audit', page: '/admin/audit',
    verbs: { en: ['who deleted', 'who changed', 'who removed', 'who edited'], bn: ['কে মুছেছে', 'কে বদলেছে', 'কে ডিলিট করেছে'], bl: ['ke delete korse', 'ke change korse'] },
    objects: { en: ['the product', 'a lead', 'my campaign', 'the target'], bn: ['পণ্যটা', 'লিডটা', 'টার্গেটটা'], bl: ['product ta', 'lead ta', 'target ta'] } },
  { expect: 'audit', page: '/admin/audit',
    verbs: { en: ['show', 'check', 'open', 'see'], bn: ['দেখাও', 'খোলো'], bl: ['dekhao', 'kholo'] },
    objects: { en: ['the audit log', 'activity log', 'change history log'], bn: ['অডিট লগ', 'অ্যাক্টিভিটি লগ'], bl: ['audit log', 'activity log'] } },
];

/** Polite or question wrappers. {S} is replaced by "verb object" (English) or "object verb" (Bangla). */
export const WRAPPERS: Record<Lang, { tune: string[]; heldOut: string[] }> = {
  en: {
    tune: ['{S}', 'please {S}', 'can you {S}', 'how do i {S}', 'i want to {S}', 'hey, {S} please', 'is it possible to {S}?', 'help me {S}', '{S} for me', 'could you {S}?'],
    heldOut: ['where can i {S}', 'i need to {S} now', 'kindly {S}', 'how can i {S}?', 'would you {S} please', 'let me {S}', 'what are the steps to {S}?'],
  },
  bn: {
    tune: ['{S}', '{S} প্লিজ', 'দয়া করে {S}', 'আমি {S}', '{S} কিভাবে?', '{S} পারবে?', '{S} তো'],
    heldOut: ['একটু {S}', '{S} কীভাবে করব?', '{S} সম্ভব?', 'আমাকে {S}'],
  },
  bl: {
    tune: ['{S}', '{S} plz', 'ektu {S}', '{S} kivabe', 'ami {S}'],
    heldOut: ['{S} parba?', 'amake {S}', '{S} kemne'],
  },
};

export const NAMES = {
  employee: ['Rahim', 'Karim', 'Sumaiya', 'Tanvir Ahmed', 'রহিম', 'করিম', 'সুমাইয়া'],
  section: ['Dhaka Farmers', 'Agro BD', 'Mushroom Lovers', 'ঢাকা কৃষক', 'এগ্রো গ্রুপ'],
};

/** Questions that are not about the panel: the assistant must decline these. */
export const OFF_TOPIC: string[] = [
  'what is the capital of france', 'write me a poem', 'what is the weather today', 'tell me a joke', 'who won the world cup',
  'how do i cook rice', 'translate hello to spanish', 'what is 25 times 4', 'recommend a movie', 'who is the president of america',
  'how to lose weight', 'what time is it in london', 'explain quantum physics', 'write an email to my boss', 'best phone under 20000',
  'বাংলাদেশের রাজধানী কী', 'একটা কবিতা লেখো', 'আজকের আবহাওয়া কেমন', 'একটা জোকস বলো', 'ভাত কীভাবে রান্না করে',
  'বিশ্বকাপ কে জিতেছে', 'ওজন কমানোর উপায়', 'ক্রিকেট খেলার স্কোর কত', 'একটা গল্প বলো', 'ইংরেজিতে অনুবাদ করো',
  'ajke weather kemon', 'ekta joke bolo', 'world cup ke jitse', 'bhat kivabe ranna kore', 'ekta golpo bolo',
  'what is bitcoin price', 'how to fix my car', 'play some music', 'what is love', 'how far is the moon',
];
