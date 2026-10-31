// What the assistant knows about the admin panel: one entry per task or question.
// Steps mirror the admin manual (src/app/admin/manual/page.tsx); keep the two in sync.

export type Action = 'add' | 'edit' | 'delete' | 'view' | 'how' | 'what';

export type Topic = {
  id: string;
  /** Page this topic lives on (null = answer only). */
  href: string | null;
  pageBn: string;
  pageEn: string;
  /** Subject words. A message must hit at least one to match this topic. */
  keywords: string[];
  /** Actions this topic answers best (used as a bonus, not a requirement). */
  actions: Action[];
  /** Short answer or numbered steps. */
  bn: string[];
  en: string[];
  /** Supports ?add=1&name= or ?q= deep links. */
  deep?: 'employee' | 'section';
  /** At least one of these must appear, so broad keyword lists do not steal other questions. */
  requires?: string[];
  /** Whole phrases that strongly point to this topic ("user guide", "home page"). */
  phrases?: string[];
  /** A second group of words that must also appear (e.g. assigning needs a section word). */
  alsoRequires?: string[];
};

const TEAM = { href: '/admin/employees', pageBn: 'টিম', pageEn: 'Team' };
const GROUPS = { href: '/admin/sections', pageBn: 'গ্রুপ', pageEn: 'Groups' };
const EMP = ['employee', 'employees', 'staff', 'member', 'members', 'worker', 'workers', 'marketer', 'marketers', 'person', 'people', 'user', 'users', 'team', 'কর্মী', 'কর্মচারী', 'স্টাফ', 'সদস্য', 'মার্কেটার', 'টিম', 'kormi', 'kormir', 'kormider', 'kormike', 'kormira', 'লোক', 'ইউজার', 'ব্যবহারকারী'];
const SEC = ['section', 'sections', 'group', 'groups', 'সেকশন', 'গ্রুপ', 'গ্রুপের', 'সেকশনের', 'grup', 'sekshon'];
const LINK = ['link', 'links', 'url', 'urls', 'facebook', 'fb', 'লিংক', 'লিঙ্ক', 'ফেসবুক', 'linkgula'];
/** Words that really mean a link ("facebook ad" is not a link). */
const LINK_CORE = ['link', 'links', 'url', 'urls', 'লিংক', 'লিঙ্ক', 'linkgula'];

export const TOPICS: Topic[] = [
  // ---------- Team ----------
  { id: 'add_employee', ...TEAM, deep: 'employee', keywords: EMP, actions: ['add'], phrases: ['joined', 'join korse', 'জয়েন করছে', 'make his login', 'make her login', 'login banate', 'লগইন বানাতে', 'new guy', 'notun chele', 'নতুন ছেলে', 'new account', 'needs an account', 'account lagbe', 'অ্যাকাউন্ট লাগবে', 'টিম পেজ', 'team page'],
    bn: ['মেনু থেকে "টিম" খুলুন।', '"নতুন কর্মী যোগ করুন" বাটনে চাপুন।', 'নাম, মোবাইল, ইমেইল ও পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) লিখুন।', 'সেভ চাপুন। কর্মী এখন /login পেজে ইমেইল ও পাসওয়ার্ড দিয়ে ঢুকতে পারবেন।'],
    en: ['Open "Team" from the menu.', 'Press "Add Employee" (নতুন কর্মী যোগ করুন).', 'Enter name, mobile, email and a password (at least 6 characters).', 'Press Save. The employee can now sign in at /login with that email and password.'] },
  { id: 'edit_employee', ...TEAM, deep: 'employee', keywords: [...EMP, 'name', 'phone', 'mobile', 'email', 'details', 'info', 'deactivate', 'disable', 'নাম', 'ফোন', 'মোবাইল', 'ইমেইল', 'তথ্য', 'নিষ্ক্রিয়', 'number', 'নম্বর', 'চাকরি', 'job', 'resigned', 'quit', 'ছেড়ে', 'হালনাগাদ', 'email', 'vul', 'wrong'], actions: ['edit', 'delete'], phrases: ['chakri chere', 'চাকরি ছেড়ে', 'resigned', 'left job', 'left the company'],
    bn: ['"টিম" পেজ খুলুন।', 'কর্মীর সারিতে "সম্পাদনা" (পেন্সিল) আইকনে চাপুন।', 'নাম, ফোন বা ইমেইল বদলান। কর্মীকে বন্ধ করতে স্ট্যাটাস নিষ্ক্রিয় করুন।', 'সেভ চাপুন।'],
    en: ['Open the "Team" page.', 'Tap the edit (pencil) icon in the employee row.', 'Change the name, phone or email. To switch a person off, set them inactive.', 'Press Save.'] },
  { id: 'reset_password', ...TEAM, deep: 'employee', keywords: ['password', 'passwords', 'forgot', 'forgotten', 'পাসওয়ার্ড', 'ভুলে', 'রিসেট', 'ঢুকতে', ...EMP, 'login', 'লগইন'], actions: ['edit', 'how', 'add'], phrases: ['parche na', 'পারছে না', "won't let", "can't log", 'cannot log', 'cant login', 'dhukte', 'ঢুকতে পারছে'],
    requires: ['password', 'passwords', 'forgot', 'forgotten', 'পাসওয়ার্ড', 'ভুলে', 'ঢুকতে'],
    bn: ['"টিম" পেজ খুলুন।', 'কর্মীর সারিতে চাবির আইকনে ("পাসওয়ার্ড রিসেট করুন") চাপুন।', 'নতুন পাসওয়ার্ড লিখে নিশ্চিত করুন।', 'নতুন পাসওয়ার্ডটি শুধু ওই কর্মীকে জানান।'],
    en: ['Open the "Team" page.', 'Tap the key icon ("Reset password") in the employee row.', 'Type the new password and confirm.', 'Tell the new password only to that employee.'] },
  { id: 'assign_section', ...TEAM, deep: 'employee', keywords: ['assign', 'assigned', 'assignment', 'allot', 'attach', 'allocate', 'give', 'diye', 'dite', 'অ্যাসাইন', 'অ্যাসাইনমেন্ট', 'বরাদ্দ', 'দিতে', 'দিয়ে', ...EMP, ...SEC], actions: ['add', 'edit', 'how'],
    requires: ['assign', 'assigned', 'assignment', 'allot', 'attach', 'allocate', 'give', 'অ্যাসাইন', 'বরাদ্দ', 'দিতে', 'দেওয়া', 'দিয়ে', 'diye', 'dite'],
    bn: ['"টিম" পেজ খুলুন।', 'কর্মীর সারিতে "অ্যাসাইন" বাটনে চাপুন।', 'যে সেকশনগুলো দিতে চান সেগুলো বেছে নিন (একাধিক দেওয়া যায়)।', 'সেভ চাপুন। কর্মী শুধু নিজের সেকশনের লিংক দেখবেন।'],
    en: ['Open the "Team" page.', 'Press "Assign" (অ্যাসাইন) in the employee row.', 'Pick the sections to give them (more than one is fine).', 'Press Save. Employees only see links of their own sections.'] },
  { id: 'view_employee', ...TEAM, deep: 'employee', keywords: [...EMP, 'performance', 'progress', 'score', 'status', 'state', 'work', 'পারফরম্যান্স', 'অগ্রগতি', 'অবস্থা', 'কাজ', 'obostha', 'list', 'তালিকা', 'performing', 'perform', 'doing', 'লিস্ট', 'kemon', 'কেমন'], actions: ['view'], phrases: ['keeps missing his numbers', 'missing numbers', 'show me his progress', 'পারফরম্যান্সটা দেখাও', 'performanceta dekhao', 'kemon kaj', 'কেমন কাজ', 'kemon perform', 'কেমন perform', 'how is', 'is doing', 'is performing', 'doing lately', 'লিংক শেষ', 'links finished', 'finished links', 'how many links', 'কয়টা লিংক'],
    bn: ['"টিম" পেজে কর্মীর সারিতে তার "সম্পন্ন লিংক" সংখ্যা দেখা যায়।', 'দৈনিক বা মাসিক রিপোর্টে প্রতি কর্মীর বিক্রি, মুনাফা ও স্কোর দেখা যায়।'],
    en: ['On the "Team" page, the "Done" number in a row shows finished links.', 'Daily and monthly reports show each person\'s sales, profit and score.'] },

  // ---------- Groups ----------
  { id: 'add_section', ...GROUPS, deep: 'section', keywords: SEC, actions: ['add'],
    bn: ['মেনু থেকে "গ্রুপ" খুলুন।', '"নতুন সেকশন যোগ করুন" বাটনে চাপুন।', 'সেকশনের নাম লিখুন (যেমন "Agro Groups")। চাইলে বিবরণ দিন।', 'সেভ চাপুন। এরপর সেকশনের নামে চাপ দিয়ে লিংক যোগ করুন।'],
    en: ['Open "Groups" from the menu.', 'Press "Add Section" (নতুন সেকশন যোগ করুন).', 'Type a section name (for example "Agro Groups"). Add a description if you like.', 'Press Save. Then tap the section name to add its links.'] },
  { id: 'add_link', ...GROUPS, deep: 'section', keywords: [...LINK, ...SEC], actions: ['add'], requires: LINK_CORE, phrases: ['কাজ করছে না, নতুন লিংক', 'নতুন লিংক বানাতে', 'create new link', 'make new link'],
    bn: ['"গ্রুপ" পেজে সেকশনের নামে চাপুন।', 'একটি লিংকের জন্য "নতুন গ্রুপ লিংক যোগ করুন" চাপুন।', 'লিংক ও নাম লিখে সেভ করুন।', 'অনেক লিংক একসাথে দিতে CSV আপলোড ব্যবহার করুন।'],
    en: ['On "Groups", tap the section name.', 'For one link, press "Add group link" (নতুন গ্রুপ লিংক যোগ করুন).', 'Enter the link and its name, then save.', 'For many links at once, use CSV upload.'] },
  { id: 'upload_csv', ...GROUPS, keywords: ['csv', 'excel', 'sheet', 'file', 'upload', 'import', 'bulk', 'many', 'uplod', 'সিএসভি', 'ফাইল', 'আপলোড', 'একসাথে', 'অনেক'], actions: ['add', 'how'], phrases: ['upload a csv', 'upload csv', 'csv upload', 'সিএসভি আপলোড', 'csv টা upload', 'csv ta upload', 'csv file upload', 'import a csv', 'upload korbo links', 'links er csv upload', 'links upload', 'লিংক upload', 'csv uplod'],
    bn: ['"গ্রুপ" পেজে সেকশনের সারিতে "CSV আপলোড করুন" চাপুন।', 'CSV ফাইলে "url" কলাম থাকতেই হবে; "title" কলাম ঐচ্ছিক।', 'ফাইল বেছে নিন। প্রিভিউতে দেখাবে কয়টি সেভ হবে, কয়টি ডুপ্লিকেট, কয়টি অবৈধ।', 'ঠিক থাকলে নিশ্চিত করুন। অবৈধ সারির কারণ "মন্তব্য / কারণ" কলামে থাকে।'],
    en: ['On "Groups", press "Upload CSV" on the section row.', 'The CSV must have a "url" column; "title" is optional.', 'Choose the file. The preview shows how many will be saved, duplicates and invalid rows.', 'Confirm if it looks right. Reasons for invalid rows are in the "মন্তব্য / কারণ" column.'] },
  { id: 'deactivate_links', ...GROUPS, keywords: [...LINK, 'deactivate', 'disable', 'off', 'remove', 'stop', 'বন্ধ', 'নিষ্ক্রিয়'], requires: LINK_CORE, actions: ['delete', 'edit'], phrases: ['not working', 'কাজ করে না', 'dead link', 'kaj kore na'],
    bn: ['সেকশনের লিংক পেজ খুলুন।', 'যেসব লিংক বন্ধ করবেন সেগুলোতে টিক দিন, তারপর নিষ্ক্রিয় বাটনে চাপুন।', 'সব লিংক একসাথে বন্ধ করতে বাল্ক বাটন ("সকল সক্রিয় লিংক নিষ্ক্রিয়") চাপুন এবং নিশ্চিত করুন।'],
    en: ['Open the section\'s link page.', 'Tick the links to switch off, then press the deactivate button.', 'To switch off all links at once, press the bulk "deactivate all active links" button and confirm.'] },
  { id: 'edit_link', ...GROUPS, keywords: [...LINK], requires: LINK_CORE, actions: ['edit'],
    bn: ['সেকশনের লিংক পেজ খুলুন।', 'লিংকের সারিতে "সম্পাদনা" আইকনে চাপুন।', 'লিংক বা নাম বদলে সেভ করুন।'],
    en: ['Open the section\'s link page.', 'Tap the edit icon in the link row.', 'Change the link or its name and save.'] },
  { id: 'view_sections', ...GROUPS, deep: 'section', keywords: [...SEC, 'inactive'], actions: ['view'],
    bn: ['"গ্রুপ" পেজে সব সেকশন ও তাদের লিংক সংখ্যা দেখা যায়। সেকশনের নামে চাপলে লিংকগুলো দেখবেন।'],
    en: ['The "Groups" page lists every section and its link count. Tap a section to see its links.'] },
  { id: 'upload_history', href: '/admin/csv/history', pageBn: 'আপলোড ইতিহাস', pageEn: 'Upload History', keywords: ['history', 'previous', 'past', 'upload', 'uploads', 'csv', 'সিএসভি', 'ইতিহাস', 'হিস্ট্রি', 'আগের', 'আপলোড', 'ager', 'record', 'records', 'হিস্টোরি', 'পুরানো', 'পুরনো', 'পূর্বের', 'purano', 'imports', 'রেকর্ড', 'তালিকা', 'uploaded', 'itihas', 'duplicate', 'duplicates', 'ডুপ্লিকেট', 'before', 'আগে'], phrases: ['files i uploaded', 'upload korsilam', 'আপলোড হয়েছে', 'আপলোড করেছিলাম', 'upload records', 'upload history', 'আপলোড হিস্টোরি', 'আপলোড হিস্ট্রি', 'upload er record', 'log of uploads', 'previous imports', 'আপলোডের তালিকা', 'আপলোডের রেকর্ড', 'csv upload records', 'upload history kothay'], alsoRequires: ['upload', 'uploads', 'uploaded', 'আপলোড', 'file', 'files', 'ফাইল', 'csv', 'সিএসভি', 'import', 'imports', 'ইমপোর্ট'],
    requires: ['before', 'আগে', 'kal', 'last', 'duplicate', 'duplicates', 'ডুপ্লিকেট', 'itihas', 'uploaded', 'korsilam', 'হয়েছে', 'করেছিলাম', 'record', 'records', 'হিস্টোরি', 'পুরানো', 'পুরনো', 'পূর্বের', 'purano', 'imports', 'রেকর্ড', 'তালিকা', 'last', 'yesterday', 'গতকাল', 'শেষ', 'history', 'previous', 'past', 'ইতিহাস', 'হিস্ট্রি', 'আগের', 'ager'], actions: ['view'],
    bn: ['মেনু থেকে "আপলোড ইতিহাস" খুলুন। আগের প্রতিটি CSV আপলোডে কয়টি যোগ, ডুপ্লিকেট ও অবৈধ ছিল দেখা যায়।'],
    en: ['Open "Upload History" from the menu. It shows each past CSV upload with added, duplicate and invalid counts.'] },

  // ---------- Products & campaigns ----------
  { id: 'add_product', href: '/admin/products', pageBn: 'পণ্য', pageEn: 'Products', keywords: ['product', 'products', 'item', 'items', 'mushroom', 'পণ্য', 'প্রোডাক্ট', 'মাশরুম', 'ponno', 'ponner', 'unit', 'units', 'ইউনিট', 'কেজি', 'kg', 'packet', 'প্যাকেট', 'catalog', 'selling', 'ঝিনুক', 'শুকনো', 'মাশরুম', 'mushroom', 'item', 'items', 'আইটেম', 'oyster', 'অয়েস্টার', 'price', 'দাম', 'button', 'বাটন', 'milky', 'মিল্কি', 'ঝিনুক', 'শুকনা', 'dried', 'বিক্রয়মূল্য'], actions: ['add'],
    bn: ['মেনু থেকে "পণ্য" খুলুন।', '"নতুন পণ্য যোগ করুন" চাপুন।', 'বাংলা ও ইংরেজি নাম, একক (kg, packet) ও বিক্রয়মূল্য লিখুন।', 'সেভ চাপুন।'],
    en: ['Open "Products" from the menu.', 'Press "Add Product" (নতুন পণ্য যোগ করুন).', 'Enter the Bangla and English name, the unit (kg, packet) and the selling price.', 'Press Save.'] },
  { id: 'edit_product', href: '/admin/products', pageBn: 'পণ্য', pageEn: 'Products', keywords: ['product', 'products', 'price', 'prices', 'পণ্য', 'প্রোডাক্ট', 'দাম', 'মূল্য', 'ponno', 'ponner', 'dam', 'unit', 'units', 'ইউনিট', 'কেজি', 'kg', 'packet', 'প্যাকেট', 'catalog', 'selling', 'ঝিনুক', 'শুকনো', 'মাশরুম', 'mushroom', 'item', 'items', 'আইটেম', 'oyster', 'অয়েস্টার', 'price', 'দাম', 'button', 'বাটন', 'milky', 'মিল্কি', 'ঝিনুক', 'শুকনা', 'dried', 'বিক্রয়মূল্য', 'inactive', 'নিষ্ক্রিয়'], actions: ['edit', 'delete', 'view'],
    bn: ['"পণ্য" পেজে পণ্যের সারিতে সম্পাদনা চাপুন।', 'দাম, একক বা স্ট্যাটাস বদলান। বিক্রি বন্ধ করতে স্ট্যাটাস নিষ্ক্রিয় করুন।', 'সেভ চাপুন।'],
    en: ['On "Products", press edit on the product row.', 'Change the price, unit or status. To stop selling it, set it inactive.', 'Press Save.'] },
  { id: 'add_campaign', href: '/admin/campaigns', pageBn: 'ক্যাম্পেইন', pageEn: 'Campaigns', keywords: ['campaign', 'campaigns', 'ad', 'ads', 'advert', 'boost', 'promotion', 'ক্যাম্পেইন', 'বিজ্ঞাপন', 'অ্যাড', 'বুস্ট'], actions: ['add'],
    bn: ['মেনু থেকে "ক্যাম্পেইন" খুলুন।', '"নতুন ক্যাম্পেইন তৈরি করুন" চাপুন।', 'নাম, চ্যানেল (যেমন Facebook Ad), পণ্য ও বাজেট লিখুন।', 'স্ট্যাটাস বেছে নিন (পরিকল্পিত, চলমান, স্থগিত, সমাপ্ত) এবং সেভ করুন।'],
    en: ['Open "Campaigns" from the menu.', 'Press "Create campaign" (নতুন ক্যাম্পেইন তৈরি করুন).', 'Enter name, channel (for example Facebook Ad), product and budget.', 'Pick a status (Planned, Running, Paused, Ended) and save.'] },
  { id: 'edit_campaign', href: '/admin/campaigns', pageBn: 'ক্যাম্পেইন', pageEn: 'Campaigns', keywords: ['campaign', 'campaigns', 'roas', 'spend', 'pause', 'ক্যাম্পেইন', 'খরচ', 'স্থগিত', 'budget', 'বাজেট', 'khoroch', 'boost', 'বুস্ট', 'running', 'চলমান', 'ad', 'ads', 'অ্যাড', 'অ্যাডে', 'বিজ্ঞাপন', 'বিজ্ঞাপনে', 'adds'], phrases: ['over budget', 'বাজেট পার', 'par hoye', 'worth the money', 'making money', 'লাভ হচ্ছে', 'labh hocche', 'spent on', 'খরচ হইছে', 'খরচ হয়েছে', 'khoroch hoise', 'budget limit', 'বাজেট সীমা'],
    requires: ['ad', 'ads', 'অ্যাড', 'অ্যাডে', 'বিজ্ঞাপন', 'বিজ্ঞাপনে', 'boost', 'বুস্ট', 'campaign', 'campaigns', 'roas', 'spend', 'ক্যাম্পেইন', 'ক্যাম্পেইনের', 'khoroch'], actions: ['edit', 'view', 'delete'],
    bn: ['"ক্যাম্পেইন" পেজে সারির "সম্পাদনা" চাপুন।', 'বাজেট বা স্ট্যাটাস বদলে সেভ করুন।', 'খরচের রং: ৮০% এর নিচে সবুজ, ৮০–১০০% হলুদ, ১০০% এর বেশি লাল।'],
    en: ['On "Campaigns", press edit (সম্পাদনা) on the row.', 'Change the budget or status and save.', 'Spend colours: under 80% green, 80–100% yellow, over 100% red.'] },

  // ---------- Leads ----------
  { id: 'add_lead', href: '/admin/leads', pageBn: 'লিড', pageEn: 'Leads', keywords: ['lead', 'leads', 'customer', 'customers', 'buyer', 'buyers', 'client', 'clients', 'লিড', 'কাস্টমার', 'ক্রেতা', 'ক্লায়েন্ট', 'গ্রাহক', 'kreta', 'kretar', 'grahok', 'পাইকার', 'হোটেল', 'restaurant', 'owner', 'মালিক', 'malik', 'customers', 'কাস্টমারদের', 'wholesaler', 'dealer', 'kastomar'], actions: ['add'],
    bn: ['মেনু থেকে "লিড" খুলুন।', '"নতুন লিড যুক্ত করুন" চাপুন।', 'ক্রেতার নাম, ফোন ও ধরন লিখুন। একই ফোন আগে থাকলে সতর্ক করবে।', 'সেভ চাপুন।'],
    en: ['Open "Leads" from the menu.', 'Press "Add Lead" (নতুন লিড যুক্ত করুন).', 'Enter buyer name, phone and type. A duplicate phone shows a warning.', 'Press Save.'] },
  { id: 'lead_stage', href: '/admin/leads', pageBn: 'লিড', pageEn: 'Leads', keywords: ['lead', 'leads', 'stage', 'status', 'ordered', 'lost', 'qualified', 'contacted', 'pipeline', 'লিড', 'স্টেজ', 'অর্ডার', 'বাতিল', 'অবস্থা', 'customer', 'customers', 'buyer', 'buyers', 'কাস্টমার', 'ক্রেতা', 'lead', 'leads', 'kastomar', 'mr', 'ms', 'filter', 'lost', 'বাতিল', 'kinbe', 'কিনবে', 'buy', 'contacted', 'যোগাযোগ'], phrases: ['sob buyer', 'সব বায়ার', 'সব ক্রেতা', 'kinbe na', 'কিনবে না', "won't buy", 'wont buy', 'contact hoy nai', 'যোগাযোগ হয়নি', 'not contacted', 'অর্ডার দিছে', 'order dise', 'lost hoise', 'বাতিল হইছে', 'as lost', 'lost kore dao', 'বাতিল করে দাও', 'order korse emon'],
 actions: ['edit', 'view'],
    bn: ['"লিড" পেজে উপরের ট্যাবে স্টেজ বেছে নিন: নতুন, যোগাযোগকৃত, যোগ্য, অর্ডার, বাতিল।', 'স্টেজ বদলাতে লিডে "স্টেজ পরিবর্তন" থেকে নতুন স্টেজ বাছুন।'],
    en: ['On "Leads", use the tabs to pick a stage: New, Contacted, Qualified, Ordered, Lost.', 'To move a lead, use "Change stage" (স্টেজ পরিবর্তন) and pick the new stage.'] },
  { id: 'followup', href: '/admin/leads', pageBn: 'লিড', pageEn: 'Leads', keywords: ['followup', 'follow', 'note', 'notes', 'comment', 'ফলোআপ', 'ফলো', 'নোট', 'মন্তব্য'], actions: ['add', 'view'],
    bn: ['"লিড" পেজে লিডের উপর চাপুন।', 'আগের ফলোআপ নোট দেখা যাবে।', 'নতুন নোট "ফলোআপ নোট লিখুন" বক্সে লিখে সেভ করুন।'],
    en: ['On "Leads", tap the lead.', 'You will see past follow-up notes.', 'Type a new note in the follow-up box and save.'] },

  // ---------- Targets & budget ----------
  { id: 'set_target', href: '/admin/targets', pageBn: 'টার্গেট ও বাজেট', pageEn: 'Targets & Budget', keywords: ['target', 'targets', 'goal', 'goals', 'quota', 'targt', 'টার্গেট', 'লক্ষ্য', 'লক্ষ্যমাত্রা', 'section', 'sections', 'সেকশন'], phrases: ['targt komao', 'target komao', 'koto korbe', 'কত করবে', 'should the team hit', 'team hit'],
    requires: ['target', 'targets', 'targt', 'goal', 'goals', 'quota', 'টার্গেট', 'লক্ষ্য', 'লক্ষ্যমাত্রা'], actions: ['add', 'edit', 'view', 'delete'],
    bn: ['মেনু থেকে "টার্গেট ও বাজেট" খুলুন।', 'নতুন টার্গেট ফর্মে সেকশন ও মেট্রিক বেছে নিন।', 'সংখ্যা লিখুন এবং মেয়াদ বাছুন (মাসিক, দৈনিক বা কাস্টম)।', 'প্রিভিউ দেখে সেভ করুন। বদলাতে "সম্পাদনা", মুছতে "মুছে ফেলুন"।'],
    en: ['Open "Targets & Budget" from the menu.', 'In the new target form, pick a section and a metric.', 'Enter the number and pick the period (Monthly, Daily or Custom).', 'Check the preview and save. Use edit to change it, delete to remove it.'] },
  { id: 'copy_targets', href: '/admin/targets', pageBn: 'টার্গেট ও বাজেট', pageEn: 'Targets & Budget', keywords: ['copy', 'reuse', 'duplicate', 'next', 'কপি', 'পরের', 'target', 'targets', 'টার্গেট', 'last', 'আগের', 'porer'], phrases: ['মাসের মতো', 'maser moto', 'like last month', 'reuse', 'আবার ব্যবহার', 'copy', 'কপি'],
    requires: ['copy', 'duplicate', 'কপি', 'reuse'], actions: ['add', 'how'],
    bn: ['"টার্গেট ও বাজেট" পেজে "বাল্ক কপি" ব্যবহার করুন।', 'কপির ধরন বাছুন: মাস থেকে মাস বা সেকশন থেকে সেকশন।'],
    en: ['On "Targets & Budget", use "Bulk copy" (বাল্ক কপি).', 'Pick the copy type: month to month or section to section.'] },
  { id: 'set_budget', href: '/admin/targets', pageBn: 'টার্গেট ও বাজেট', pageEn: 'Targets & Budget', keywords: ['budget', 'budgets', 'money', 'limit', 'বাজেট', 'টাকা', 'খরচ', 'সীমা', 'ad', 'ads', 'marketing', 'মার্কেটিং', 'monthly', 'মাসিক'],
    requires: ['budget', 'budgets', 'বাজেট', 'money', 'টাকা'], actions: ['add', 'edit', 'view'],
    bn: ['"টার্গেট ও বাজেট" পেজে "বিজ্ঞাপন ও মার্কেটিং বাজেট নির্ধারণ" অংশে যান।', 'মাস বাছুন, তারপর ক্যাম্পেইন বা মোট বাজেট ও টাকার পরিমাণ (৳) লিখুন।', 'সেভ করুন। খরচ "বাজেট খরচ ট্র্যাকিং" অংশে দেখা যাবে।'],
    en: ['On "Targets & Budget", go to the marketing budget part.', 'Pick the month, then a campaign or the monthly total, and enter the amount (৳).', 'Save. Spending shows under budget tracking.'] },

  // ---------- Reports ----------
  { id: 'report_daily', href: '/admin/reports/daily', pageBn: 'দৈনিক রিপোর্ট', pageEn: 'Daily Report', keywords: ['daily', 'today', 'todays', 'sales', 'report', 'reports', 'দৈনিক', 'আজ', 'আজকের', 'বিক্রি', 'সেল', 'রিপোর্ট', 'ajker', 'ajke', 'sale', 'doinik', 'protidiner', 'প্রতিদিনের', 'hisab', 'yesterday', 'yesterdays', 'গতকাল', 'কালকের', 'গতকালকের', 'কালকে', 'kalker', 'kalke', 'gotokal', 'gotokaler', 'ager', 'poroshu', 'poroshur', 'পরশু', 'everyone', 'date', 'তারিখ', 'tarikh', 'reported', 'সংখ্যাগুলো'], actions: ['view'], phrases: ['what happened today', 'আজকের সংখ্যাগুলো', 'aj koyta order aslo', 'আজ কয়টা লিড আসছে', 'numbers for last', 'reported on a specific date', 'kal ke ki', 'কে কী কাজ', 'specific date', 'কাজের রিপোর্ট', 'আজকের রিপোর্ট', 'ajker report', 'kalker report', 'কালকের রিপোর্ট', 'গতকালকের রিপোর্ট', 'kalker summary', 'gotokaler report', 'yesterday report', 'yesterdays report', 'ager diner report', 'kalke koto sale', 'kalke ki hoise', 'kalke koyta order', 'poroshur report', 'yesterday sales', 'kalker hisab', 'kalker hishab'],
    bn: ['মেনু থেকে "দৈনিক" রিপোর্ট খুলুন এবং তারিখ বেছে নিন।', 'প্রতি কর্মীর পোস্ট, বিক্রি, মুনাফা ও স্কোর দেখা যাবে।'],
    en: ['Open the "Daily" report from the menu and pick a date.', 'You see each person\'s posts, sales, profit and score.'] },
  { id: 'report_weekly', href: '/admin/reports/weekly', pageBn: 'সাপ্তাহিক রিপোর্ট', pageEn: 'Weekly Report', keywords: ['weekly', 'week', 'publish', 'draft', 'report', 'reports', 'সাপ্তাহিক', 'সপ্তাহ', 'প্রকাশ', 'ড্রাফট', 'রিপোর্ট', 'saptahik', 'shoptaho', 'মূল্যায়ন', 'evaluation', 'review', 'soptaher', 'সপ্তাহের'], actions: ['view', 'add', 'edit'],
    bn: ['সাপ্তাহিক রিপোর্ট পেজে সপ্তাহ বেছে নিন।', 'প্রশ্নের উত্তর ও মূল্যায়ন লিখুন।', 'পরে বদলাতে চাইলে "ড্রাফট সংরক্ষণ" চাপুন।', '"রিপোর্ট প্রকাশ করুন" চাপলে রিপোর্ট চূড়ান্ত হয়; আর বদলানো যায় না।'],
    en: ['On the weekly report page, pick the week.', 'Fill in the answers and the evaluation.', 'Press "Save draft" if you want to change it later.', 'Pressing "Publish report" makes it final; it cannot be changed after that.'] },
  { id: 'report_monthly', href: '/admin/reports/monthly', pageBn: 'মাসিক রিপোর্ট', pageEn: 'Monthly Report', keywords: ['monthly', 'month', 'rank', 'ranking', 'report', 'reports', 'মাসিক', 'মাস', 'র‍্যাংক', 'রিপোর্ট', 'masik', 'mashik', 'মাসের', 'masher', 'মান্থলি', 'maser', 'mashe', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর', 'gotomasher', 'profit', 'লাভ', 'মুনাফা'], actions: ['view'], phrases: ['how did october go', 'how did november go', 'last month', 'month end', 'এই মাসে', 'ei mashe', 'গত মাস', 'মাসের রিপোর্ট'],
    bn: ['মেনু থেকে "মাসিক" রিপোর্ট খুলুন এবং মাস বাছুন।', 'প্রতি কর্মীর র‍্যাংক, বিক্রি, মুনাফা ও মাসিক স্কোর দেখা যাবে।'],
    en: ['Open the "Monthly" report from the menu and pick the month.', 'You see each person\'s rank, sales, profit and monthly score.'] },
  { id: 'report_pdf', href: '/admin/reports/weekly', pageBn: 'রিপোর্ট', pageEn: 'Reports', keywords: ['pdf', 'download', 'export', 'print', 'excel', 'পিডিএফ', 'ডাউনলোড', 'প্রিন্ট', 'report', 'reports', 'রিপোর্ট'], actions: ['view', 'how'],
    bn: ['রিপোর্ট পেজের "পিডিএফ" বা এক্সপোর্ট লিংকে চাপুন। ফাইলটি ডাউনলোড হবে।'],
    en: ['Tap the "PDF" or export link on the report page. The file will download.'] },

  // ---------- Plan ----------
  { id: 'plan_task', href: '/admin/plan', pageBn: '৯০ দিনের প্ল্যান', pageEn: '90-Day Plan', keywords: ['plan', 'planing', 'planning', 'task', 'tasks', 'phase', 'milestone', 'milestones', '90', 'প্ল্যান', 'প্ল্যানিং', 'টাস্ক', 'ফেজ', 'মাইলস্টোন', 'পরিকল্পনা', '৯০', 'diner', 'আটকে', 'blocked', 'stuck', 'roadmap', 'quarterly', 'অগ্রগতি', 'task', 'due', 'বাকি', 'baki'], actions: ['add', 'edit', 'view'], phrases: ['planing page', 'assign a task', 'task assign', 'তিন মাস', 'তিন মাসের', '3 maser', 'three month', 'কর্মপরিকল্পনা', 'porikolpona', 'plan e kon', 'প্ল্যানে কোন', 'প্ল্যানের কোন', 'plan er kon'],
    bn: ['মেনু থেকে "৯০ দিনের প্ল্যান" খুলুন।', 'একটি ফেজ খুলে টাস্ক যোগ বাটনে চাপুন; বাংলা ও ইংরেজি শিরোনাম, কর্মী ও তারিখ দিন।', 'টাস্কের স্ট্যাটাস বদলান: শুরু হয়নি, চলমান, সম্পন্ন বা স্থগিত।', 'ফেজ শেষে মাইলস্টোন মূল্যায়ন করুন: অর্জিত, আংশিক, অনর্জিত।'],
    en: ['Open "90-Day Plan" from the menu.', 'Open a phase and use the add-task button; enter titles, the person and the due date.', 'Change a task status: Not started, In progress, Done or Blocked.', 'At the end of a phase, rate the milestone: Met, Partial, Missed.'] },

  // ---------- Settings & audit ----------
  { id: 'settings_score', href: '/admin/settings', pageBn: 'সেটিংস', pageEn: 'Settings', keywords: ['setting', 'settings', 'score', 'scoring', 'weight', 'weights', 'threshold', 'failing', 'cap', 'achievement', 'সেটিংস', 'স্কোর', 'ওজন', 'থ্রেশহোল্ড', 'passing', 'পাসিং', 'fail', 'ফেল', 'gurutto', 'গুরুত্ব', 'importance', 'অ্যাচিভমেন্ট', 'ক্যাপ'], actions: ['edit', 'view', 'how'], phrases: ['section weight', 'সেকশনের ওজন', 'achievement cap', 'অর্জনের সর্বোচ্চ', 'score weight', 'scoring weight', 'failing threshold'],
    bn: ['মেনু থেকে "সেটিংস" খুলুন।', 'সেকশন ওয়েট, অ্যাচিভমেন্ট ক্যাপ ও ব্যর্থতা থ্রেশহোল্ড (ডিফল্ট ৮০%) বদলান।', 'নিচের "Save" না চাপলে কিছু বদলাবে না।'],
    en: ['Open "Settings" from the menu.', 'Change section weights, the achievement cap and the failing threshold (default 80%).', 'Nothing changes until you press "Save" at the bottom.'] },
  { id: 'settings_undo', href: '/admin/settings', pageBn: 'সেটিংস', pageEn: 'Settings', keywords: ['undo', 'revert', 'mistake', 'wrong', 'আনডু', 'ভুল', 'ফেরত'], actions: ['how', 'edit', 'what'], phrases: ['undo', 'আনডু'],
    bn: ['আনডু একটি সাম্প্রতিক লিংক পরিবর্তন ফিরিয়ে আনে; সব কিছু নয়।', '"সেটিংস" পেজে আনডু চালু বা বন্ধ করুন, তারপর Save চাপুন।'],
    en: ['Undo reverses a recent link change; it does not reset everything.', 'Turn undo on or off on "Settings", then press Save.'] },
  { id: 'settings_window', href: '/admin/settings', pageBn: 'সেটিংস', pageEn: 'Settings', keywords: ['window', 'days', 'language', 'schedule', 'default', 'defaults', 'উইন্ডো', 'দিন', 'ভাষা', 'ডিফল্ট', 'schedule', 'সময়সূচি', 'time'], actions: ['edit', 'how'], phrases: ['how long', 'কতক্ষণ', 'kotokkhon', 'language', 'ভাষা', 'কত দিন পর্যন্ত', 'how many days', 'রিপোর্টের সময়সূচি', 'edit window', 'report schedule', 'default language', 'এডিট উইন্ডো', 'ডিফল্ট ভাষা'], requires: ['long', 'কতক্ষণ', 'kotokkhon', 'window', 'days', 'language', 'schedule', 'default', 'defaults', 'উইন্ডো', 'ভাষা', 'ডিফল্ট', 'সময়সূচি', 'time'],
    bn: ['"সেটিংস" পেজে এডিট উইন্ডো (কত দিন আগের তথ্য কর্মী বদলাতে পারবে), সাপ্তাহিক রিপোর্টের সময় ও ডিফল্ট ভাষা ঠিক করুন।', 'আগের অবস্থায় ফিরতে ডিফল্ট বাটন, তারপর Save চাপুন।'],
    en: ['On "Settings", set the edit window (how many days back employees can edit), the weekly report time and the default language.', 'To go back to defaults, press the default button, then Save.'] },
  { id: 'audit', href: '/admin/audit', pageBn: 'অডিট লগ', pageEn: 'Audit Log', keywords: ['audit', 'log', 'logs', 'who', 'changed', 'deleted', 'removed', 'activity', 'modify', 'modifying', 'অডিট', 'লগ', 'মুছেছে', 'বদলেছে'], actions: ['view'], phrases: ['what did nusrat change', 'modify korse', 'মডিফাই করছে', 'data modify', 'history of changes', 'পরিবর্তনের ইতিহাস', 'change er itihash', 'what was changed', 'ki change hoise', 'কী বদলানো হয়েছে', 'change history', 'change er history', 'filter changes', 'কী কী পরিবর্তন', 'মুছে ফেলা', 'change record', 'json', 'audit log', 'activity log', 'অডিট লগ'],
    bn: ['মেনু থেকে "অডিট লগ" খুলুন।', 'নাম, অ্যাকশন বা এনটিটি (যেমন Product, Lead) দিয়ে ফিল্টার করুন।', 'বিস্তারিত দেখতে সারিতে চাপুন।'],
    en: ['Open "Audit Log" from the menu.', 'Filter by user, action or entity (for example Product or Lead).', 'Tap a row for the details.'] },

  // ---------- General ----------
  { id: 'dashboard', href: '/admin/dashboard', pageBn: 'ড্যাশবোর্ড', pageEn: 'Dashboard', keywords: ['dashboard', 'home', 'overview', 'summary', 'checklist', 'ড্যাশবোর্ড', 'হোম', 'সারাংশ', 'চেকলিস্ট', 'homepage', 'overview', 'ওভারভিউ', 'সামগ্রিক', 'snapshot', 'front'], actions: ['view', 'how'], phrases: ['setup checklist', 'checklist', 'চেকলিস্ট', 'big picture', 'বড় চিত্র', 'boro chitro', 'at a glance', 'overall', 'stats', 'মেইন পেজ', 'main page', 'start page', 'prothom page', 'in total', 'mot koyjon', 'মোট কতজন', 'ড্যাশবর্ড', 'bird', 'এক নজরে', 'first page', 'শুরুর', 'ধাপ', 'view of the business', 'whole business', 'main screen', 'মেইন স্ক্রিন', 'প্রথম পেজ', 'মূল পাতা', 'front page', 'getting started', 'ek jaygay', 'এক জায়গায়', 'quick view', 'summary screen', 'home page', 'main page', 'হোম পেজ', 'mul page'],
    bn: ['ড্যাশবোর্ডে সক্রিয় কর্মী, সেকশন, সম্পন্ন লিংক ও শীর্ষ কর্মী দেখা যায়।', 'উপরের "শুরুর ধাপ" চেকলিস্ট ধাপে ধাপে সেটআপ দেখায়।'],
    en: ['The dashboard shows active team members, sections, done links and top performers.', 'The "Getting started" checklist at the top walks you through setup.'] },
  { id: 'passcode', href: null, pageBn: '', pageEn: '', keywords: ['passcode', 'admin', 'pin', 'পাসকোড', 'অ্যাডমিন', 'পিন'], actions: ['edit', 'how', 'what'], phrases: ['অ্যাডমিন পাসকোড', 'admin passcode', 'admin pin'],
    bn: ['অ্যাডমিন প্যানেলে /admin-login পেজে পাসকোড দিয়ে ঢুকতে হয়।', 'পাসকোড বদলানো সার্ভার সেটিংসে (Vercel-এর ADMIN_PASSCODE) হয়; এটি ডেভেলপারকে দিয়ে বদলান।', 'পাসকোড কারও সাথে শেয়ার করবেন না।'],
    en: ['The admin panel is opened with the passcode on the /admin-login page.', 'The passcode is changed in the server settings (ADMIN_PASSCODE on Vercel); ask your developer to change it.', 'Never share the passcode.'] },
  { id: 'logout', href: null, pageBn: '', pageEn: '', keywords: ['logout', 'signout', 'exit', 'লগআউট', 'বের'], actions: ['how'], phrases: ['সাইন আউট', 'sign-out', 'ber hobo', 'ber hote', 'sign out', 'log out', 'বের হব', 'বের হও'],
    bn: ['উপরের ডানে "লগআউট" বাটনে চাপুন। আপনি পাসকোড পেজে ফিরে যাবেন।'],
    en: ['Press "Logout" at the top right. You return to the passcode page.'] },
  { id: 'employee_login', href: null, pageBn: '', pageEn: '', keywords: ['employee', 'employees', 'কর্মী', 'login', 'signin', 'লগইন'], actions: ['how', 'what'], requires: ['dhukbe', 'ঢুকবে', 'log', 'login', 'signin', 'sign', 'লগইন', 'ঢুক', 'ঢোকে'], phrases: ['log in', 'nijer account', 'নিজের account', 'dhukbe', 'ঢুকবে'],
    bn: ['কর্মীরা /login পেজে নিজের ইমেইল ও পাসওয়ার্ড দিয়ে ঢোকেন। অ্যাডমিন সেখানে ঢুকতে পারেন না।'],
    en: ['Employees sign in at /login with their own email and password. The admin cannot sign in there.'] },
  { id: 'safety', href: null, pageBn: '', pageEn: '', keywords: ['safe', 'safety', 'নিরাপদ', 'নিরাপত্তা', 'screenshot', 'screenshots', 'স্ক্রিনশট', 'share', 'শেয়ার', 'private', 'গোপন'], actions: ['what', 'how'],
    requires: ['safe', 'safety', 'নিরাপদ', 'নিরাপত্তা', 'private', 'গোপন'],
    bn: ['অ্যাডমিন পাসকোড কারও সাথে শেয়ার করবেন না।', 'ক্রেতার ফোন নম্বর পুরো দেখা যায়; স্ক্রিনশট শেয়ার করার আগে নম্বর ঢেকে দিন।', 'কর্মীর নতুন পাসওয়ার্ড শুধু ওই কর্মীকেই জানান।'],
    en: ['Never share the admin passcode.', 'Buyer phone numbers are shown in full; cover them before sharing a screenshot.', 'Tell a new employee password only to that employee.'] },
  { id: 'data_backup', href: null, pageBn: '', pageEn: '', keywords: ['data', 'backup', 'saved', 'telegram', 'database', 'storage', 'ডেটা', 'ব্যাকআপ', 'টেলিগ্রাম', 'store', 'stored', 'সেভ', 'thake'], phrases: ['save hoy', 'kothay thake', 'কোথায় থাকে', 'সেভ হয়', 'data saved', 'data stored'],
    requires: ['data', 'backup', 'telegram', 'database', 'storage', 'ডেটা', 'ব্যাকআপ', 'টেলিগ্রাম'], actions: ['what', 'how'],
    bn: ['প্রতিটি পরিবর্তনের পর সব তথ্য স্বয়ংক্রিয়ভাবে একটি Telegram স্টোরেজ চ্যানেলে সংরক্ষিত হয়। আলাদা কিছু করতে হয় না।'],
    en: ['After every change, all data is saved automatically to a Telegram storage channel. You do not need to do anything.'] },
  { id: 'manual', href: '/admin/manual', pageBn: 'নির্দেশিকা', pageEn: 'Manual', keywords: ['manual', 'guide', 'tutorial', 'documentation', 'নির্দেশিকা', 'গাইড', 'ম্যানুয়াল', 'handbook', 'instructions', 'instruction', 'tutorial', 'টিউটোরিয়াল', 'সহায়িকা', 'বই', 'nirdeshika', 'গাইড', 'নির্দেশনা'], actions: ['view', 'how'], phrases: ['bebohar bidhi', 'ব্যবহার বিধি', 'help page', 'features', 'ফিচার', 'bibaron', 'বিবরণ', 'panel work', 'panel kivabe', 'প্যানেল কিভাবে', 'চালাবো', 'chalabo', 'wrong page', 'ভুল পেজ', 'vul page', 'help book', 'how everything works', 'new admin', 'নতুন অ্যাডমিন', 'ধাপে ধাপে', 'user manual', 'whole panel', 'পুরো প্যানেল', 'সমস্যা ও সমাধান', 'common problems', 'sob porte', 'kivabe chole', 'প্যানেলের বই', 'সব ফিচারের', 'user guide', 'help guide', 'ইউজার গাইড'],
    bn: ['পুরো নির্দেশিকা বাংলা ও ইংরেজিতে "নির্দেশিকা" পেজে আছে।'],
    en: ['The full guide in Bangla and English is on the "Manual" page.'] },
  { id: 'teach', href: '/admin/assistant', pageBn: 'সহকারী শেখান', pageEn: 'Teach Assistant', keywords: ['teach', 'train', 'learn', 'শেখাও', 'শেখান', 'শেখাবো', 'ট্রেনিং', 'শেখা', 'শেখাতে', 'shekhao', 'shekha', 'phrase', 'phrases', 'বাক্য', 'শব্দ', 'bot', 'assistant', 'সহকারী', 'সহকারীকে', 'shortcut', 'shortcuts', 'helper', 'চ্যাটবট', 'বট', 'chatbot', 'প্রশিক্ষণ', 'শিখিয়ে', 'শেখানোর', 'অ্যাসিস্ট্যান্ট', 'টিচ', 'shikhao', 'শিখাও'], actions: ['add', 'how'], phrases: ['when i type', 'likhle', 'লিখলে', 'শিখাও', 'shikhao', 'teach that', 'teach you', 'let me teach', 'map ', 'নিজের শব্দ', 'শব্দ দিয়ে', 'never understand', 'teach assistant', 'টিচ অ্যাসিস্ট্যান্ট', 'own word', 'nijer word', 'shortcut word', 'বুঝতে পারেনি', 'teach the assistant', 'new phrase', 'নতুন বাক্য'],
    bn: ['"সহকারী শেখান" পেজে একটি বাক্য লিখুন এবং কোন পেজ খুলবে তা বাছুন। পরের বার আমি সেটা বুঝব।'],
    en: ['On "Teach Assistant", type a phrase and pick the page it should open. Next time I will understand it.'] },
];

/** Pages offered on the teach page and as suggestions. */
export const PAGES = [
  { id: 'dashboard', href: '/admin/dashboard', labelBn: 'ড্যাশবোর্ড', labelEn: 'Dashboard' },
  { id: 'team', href: '/admin/employees', labelBn: 'টিম', labelEn: 'Team' },
  { id: 'groups', href: '/admin/sections', labelBn: 'গ্রুপ', labelEn: 'Groups' },
  { id: 'uploads', href: '/admin/csv/history', labelBn: 'আপলোড ইতিহাস', labelEn: 'Upload History' },
  { id: 'products', href: '/admin/products', labelBn: 'পণ্য ও সেলস টার্গেট', labelEn: 'Product Goals' },
  { id: 'leads', href: '/admin/leads', labelBn: 'লিড', labelEn: 'Leads' },
  { id: 'targets', href: '/admin/targets', labelBn: 'টার্গেট ও বাজেট', labelEn: 'Targets & Budget' },
  { id: 'report_daily', href: '/admin/reports/daily', labelBn: 'দৈনিক রিপোর্ট', labelEn: 'Daily Report' },
  { id: 'report_weekly', href: '/admin/reports/weekly', labelBn: 'সাপ্তাহিক রিপোর্ট', labelEn: 'Weekly Report' },
  { id: 'report_monthly', href: '/admin/reports/monthly', labelBn: 'মাসিক রিপোর্ট', labelEn: 'Monthly Report' },
  { id: 'plan', href: '/admin/plan', labelBn: '৯০ দিনের প্ল্যান', labelEn: '90-Day Plan' },
  { id: 'settings', href: '/admin/settings', labelBn: 'সেটিংস', labelEn: 'Settings' },
  { id: 'audit', href: '/admin/audit', labelBn: 'অডিট লগ', labelEn: 'Audit Log' },
  { id: 'manual', href: '/admin/manual', labelBn: 'নির্দেশিকা', labelEn: 'Manual' },
  { id: 'assistant', href: '/admin/assistant', labelBn: 'সহকারী শেখান', labelEn: 'Teach Assistant' },
];

/** Words that signal an action, in many phrasings. Checked against whole words and prefixes. */
export const ACTION_WORDS: Record<Action, string[]> = {
  add: ['add', 'new', 'create', 'make', 'insert', 'register', 'enter', 'put', 'save', 'record', 'start', 'launch', 'run', 'onboard', 'যোগ', 'যুক্ত', 'নতুন', 'তৈরি', 'বানা', 'বানাও', 'অ্যাড', 'এড', 'দিতে', 'ঢোকা', 'শুরু', 'চালু', 'jog', 'notun', 'banao', 'banabo', 'chalu', 'shuru', 'entry'],
  edit: ['edit', 'change', 'update', 'modify', 'rename', 'reset', 'fix', 'correct', 'set', 'move', 'increase', 'reduce', 'adjust', 'mark', 'raise', 'lower', 'এডিট', 'পরিবর্তন', 'বদল', 'আপডেট', 'ঠিক', 'সেট', 'রিসেট', 'সরাও', 'বাড়াও', 'বাড়িয়ে', 'বাড়াতে', 'বাড়াব', 'কমাও', 'কমাতে', 'bodlao', 'bodlabo', 'thik', 'bariye', 'baraw', 'komao'],
  delete: ['delete', 'remove', 'deactivate', 'disable', 'stop', 'cancel', 'off', 'pause', 'মুছ', 'ডিলিট', 'বাদ', 'বন্ধ', 'নিষ্ক্রিয়', 'থামাও', 'থামা', 'bondho', 'bad'],
  view: ['show', 'see', 'view', 'check', 'find', 'search', 'open', 'look', 'display', 'give', 'filter', 'দেখ', 'দেখাও', 'দেখতে', 'খুঁজ', 'চেক', 'খুলে', 'খোল', 'খোলো', 'dekhao', 'dekhte', 'dekhabo', 'kholo', 'khuje'],
  how: ['how', 'where', 'steps', 'guide', 'possible', 'way', 'কিভাবে', 'কীভাবে', 'কেমনে', 'উপায়', 'সম্ভব', 'নিয়ম', 'কোথায়', 'kivabe', 'kibhabe', 'kemne', 'kothay'],
  what: ['what', 'meaning', 'mean', 'explain', 'why', 'কী', 'কি', 'মানে', 'অর্থ', 'কেন', 'বুঝিয়ে'],
};

/** Generic words that alone should not decide the topic ("what is the weather today"). */
export const WEAK = new Set([
  'today', 'todays', 'sales', 'saved', 'save', 'file', 'many', 'off', 'stop', 'work', 'status', 'state', 'details',
  'info', 'history', 'previous', 'past', 'next', 'days', 'default', 'defaults', 'who', 'changed',
  'mistake', 'wrong', 'admin', 'start', 'people', 'person', 'month', 'week', 'note', 'notes',
  'money', 'limit', 'copy', 'change', 'rename', 'আজ', 'দিন', 'কাজ', 'তথ্য', 'ভুল', 'কে', 'মাস', 'সপ্তাহ', 'টাকা', 'শুরু',
  'phone', 'mobile', 'স্কোর', 'আজকের', 'অবস্থা', 'list', 'তালিকা', 'facebook', 'ফেসবুক', 'marketing', 'last', 'আগের', 'ager',
  'weight', 'weights', 'ওজন', 'ajke', 'ajker', 'today',
  'monthly', 'মাসিক', 'masik', 'mashik', 'mushroom', 'মাশরুম', 'মাশরুমের',
]);

/** Words that mark a question as outside the panel even if it shares panel words ("weight loss target"). */
export const OFF_TOPIC = new Set([
  'c++', 'cpp', 'python', 'java', 'javascript', 'coding', 'code', 'program', 'programming', 'html', 'css', 'algorithm', 'leetcode', 'কোডিং', 'কোড', 'প্রোগ্রাম', 'প্রোগ্রামিং',
  'football', 'cricket', 'match', 'weather', 'rain', 'dollar', 'gold', 'bitcoin', 'stock', 'girlfriend', 'boyfriend',
  'relationship', 'love', 'recipe', 'cook', 'cooking', 'movie', 'song', 'music', 'joke', 'poem', 'loss', 'diet',
  'salary', 'বেতন', 'instagram', 'follower', 'followers', 'clothes', 'kapor', 'কাপড়', 'কাপড়ের', 'chash', 'tiktok',
  'gym', 'exam', 'homework', 'grow', 'growing', 'farming', 'law', 'rights', 'electricity', 'bill', 'bills', 'multiply', 'times', 'plus', 'minus', 'president', 'capital', 'translate',
  'gmail', 'wifi', 'chatgpt', 'car', 'tips', 'tax', 'news', 'soup', 'loan', 'bank',
  'টিপস', 'ট্যাক্স', 'গান', 'gaan', 'khobor', 'খবর', 'স্যুপ', 'ঋণ', 'ব্যাংক', 'আইন', 'আইনে',
  'ফুটবল', 'ক্রিকেট', 'খেলার', 'আবহাওয়া', 'বৃষ্টি', 'ডলার', 'সোনা', 'রান্না', 'গান', 'সিনেমা', 'কবিতা', 'জোকস',
  'গুণ', 'যোগফল', 'চাষ', 'কমানোর', 'কমানো', 'রাজধানী', 'প্রেম', 'ডায়েট', 'rag', 'golpo', 'ranna',
]);

/** Polite filler that should never decide the topic. */
export const FILLER = new Set([
  'hey', 'hi', 'hello', 'please', 'pls', 'plz', 'can', 'could', 'would', 'will', 'you', 'u', 'i', 'me', 'my', 'we', 'our',
  'want', 'wanna', 'need', 'like', 'to', 'a', 'an', 'the', 'is', 'it', 'its', 'be', 'do', 'does', 'did', 'of', 'for', 'in',
  'on', 'at', 'with', 'and', 'or', 'this', 'that', 'there', 'here', 'some', 'any', 'one', 'kindly', 'just', 'now', 'go',
  'called', 'named', 'name', 'new', 'by', 'from', 'into', 'about', 'tell', 'let', 'know', 'help', 'way', 'possible',
  'আমি', 'আমার', 'আমাকে', 'আপনি', 'তুমি', 'একটা', 'একটি', 'কি', 'কী', 'প্লিজ', 'দয়া', 'করে', 'করো', 'করুন', 'কর', 'দাও', 'দিন',
  'চাই', 'চাচ্ছি', 'চাইছি', 'পারবে', 'পারবেন', 'পারো', 'যায়', 'নামে', 'নাম', 'এর', 'টা', 'টি', 'গুলো', 'এখন', 'একটু', 'হবে',
  'করব', 'করবো', 'করতে', 'করেছি', 'করেছে', 'করবেন', 'করলে', 'কিভাবে', 'কীভাবে', 'গেছে', 'গেছেন', 'হয়েছে', 'একজন', 'জন', 'কে', 'কেউ',
  'ছেলে', 'মেয়ে', 'জয়েন', 'chele', 'meye', 'guy', 'girl', 'boy', 'join', 'joined', 'নতুন',
  'kortese', 'korche', 'kortesi', 'kaj', 'করছে', 'করতেছে', 'করতেছি', 'ওর', 'ওকে', 'তার', 'tar', 'or', 'lately', 'doing',
  'parche', 'parchi', 'pare', 'na', 'nai', 'hocche', 'hoy', 'পারছে', 'পারছেন', 'পারছি', 'না', 'নাই', 'হচ্ছে', 'his', 'her', 'he', 'she', 'can\'t', 'cant', 'cannot', 'not',
  'admin', 'অ্যাডমিন', 'অ্যাডমিনের', 'এডমিন',
  'koro', 'korbo', 'korte', 'chai', 'plz', 'ektu', 'ami', 'amake', 'amar', 'parba', 'parben', 'ta', 'e', 'er', 'dao', 'den', 'name', 'diye', 'tumi', 'apni',
  'থেকে', 'জন্য', 'সাথে', 'আর', 'ও', 'এবং', 'যে', 'এই', 'ওই', 'সব', 'সকল', 'নিয়ে', 'দেখি', 'দিবেন', 'দাও', 'দেন',
]);
