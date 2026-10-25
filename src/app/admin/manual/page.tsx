'use client';

import { useState } from 'react';
import {
  BookOpen,
  LogIn,
  LayoutDashboard,
  Users,
  Layers,
  Package,
  UserPlus,
  Target,
  FileText,
  CalendarCheck,
  Settings,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

type Mode = 'both' | 'bn' | 'en';
type Pair = { bn: string; en: string };

type ManualSection = {
  id: string;
  icon: LucideIcon;
  title: Pair;
  steps: Pair[];
  tips?: Pair[];
};

const MODE_LABELS: { mode: Mode; label: string }[] = [
  { mode: 'bn', label: 'বাংলা' },
  { mode: 'en', label: 'English' },
  { mode: 'both', label: 'Both' },
];

const SECTIONS: ManualSection[] = [
  {
    id: 'sign-in',
    icon: LogIn,
    title: { bn: 'সাইন ইন কীভাবে করবেন', en: 'How to sign in' },
    steps: [
      { bn: 'ব্রাউজারে অ্যাডমিন লগইন পেজ খুলুন।', en: 'Open the admin login page in your browser.' },
      { bn: 'পাসকোড বক্সে অ্যাডমিন পাসকোড লিখুন।', en: 'Type the admin passcode in the passcode box.' },
      { bn: 'চোখের আইকনে চাপলে পাসকোড দেখা যাবে, আবার চাপলে লুকিয়ে যাবে।', en: 'Tap the eye icon to show or hide the passcode.' },
      { bn: '"প্রবেশ করুন (Enter)" বাটনে চাপুন।', en: 'Press the "প্রবেশ করুন (Enter)" button.' },
      { bn: 'ঠিক হলে আপনি সরাসরি ড্যাশবোর্ডে চলে যাবেন।', en: 'If the passcode is correct, you go straight to the dashboard.' },
    ],
    tips: [
      { bn: 'ভুল হলে লাল বক্সে বার্তা আসবে। আবার চেষ্টা করুন।', en: 'If it is wrong, a red message appears. Try again.' },
      { bn: 'পাসকোড কারও সাথে শেয়ার করবেন না।', en: 'Never share the passcode with anyone.' },
    ],
  },
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    title: { bn: 'ড্যাশবোর্ড ও শুরুর চেকলিস্ট', en: 'Dashboard and the getting-started checklist' },
    steps: [
      { bn: 'ড্যাশবোর্ড হলো প্রথম পেজ। এখানে সক্রিয় কর্মী, সেকশন, সম্পন্ন লিংক ও শীর্ষ কর্মী দেখা যায়।', en: 'The dashboard is the first page. It shows active team members, sections, done links and top performers.' },
      { bn: 'উপরে "শুরুর চেকলিস্ট" থাকে। এখানে ৫টি কাজ আছে।', en: 'The "getting-started checklist" is at the top. It has 5 tasks.' },
      { bn: 'ধাপ ১: কর্মী যোগ করুন (টিম পেজ)।', en: 'Step 1: Add your team members (Team page).' },
      { bn: 'ধাপ ২: একটি গ্রুপ সেকশন তৈরি করে তাতে লিংক যোগ করুন।', en: 'Step 2: Create a group section and add its links.' },
      { bn: 'ধাপ ৩: প্রতিটি কর্মীকে একটি সেকশনে অ্যাসাইন করুন।', en: 'Step 3: Assign each employee to a section.' },
      { bn: 'ধাপ ৪: পণ্য যোগ করুন (ঐচ্ছিক)।', en: 'Step 4: Add your products (optional).' },
      { bn: 'ধাপ ৫: মাসিক টার্গেট সেট করুন (ঐচ্ছিক)।', en: 'Step 5: Set monthly targets (optional).' },
      { bn: 'কোনো ধাপে চাপলে সেই পেজ খুলবে।', en: 'Tap any step to open its page.' },
      { bn: 'নিচের "কম স্কোর" ও "বাজেট" কার্ডে সমস্যাযুক্ত কর্মী ও ক্যাম্পেইন দেখা যায়।', en: 'The "failing" and "budget" cards lower down show team members and campaigns that need attention.' },
    ],
  },
  {
    id: 'team',
    icon: Users,
    title: { bn: 'টিম: কর্মী যোগ, পাসওয়ার্ড রিসেট, সেকশন অ্যাসাইন', en: 'Team: add employees, reset passwords, assign sections' },
    steps: [
      { bn: 'সাইডবার বা মেনু থেকে "টিম" খুলুন।', en: 'Open "Team" from the menu.' },
      { bn: 'কর্মী যোগ করতে "নতুন কর্মী যোগ করুন (Add Employee)" বাটনে চাপুন।', en: 'To add a person, press "নতুন কর্মী যোগ করুন (Add Employee)".' },
      { bn: 'নাম, মোবাইল নম্বর, ইমেইল ও পাসওয়ার্ড লিখুন। পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে।', en: 'Enter name, mobile number, email and password. The password must be at least 6 characters.' },
      { bn: 'সেভ করুন। কর্মী এখন নিজের ইমেইল ও পাসওয়ার্ড দিয়ে ঢুকতে পারবেন।', en: 'Save. The employee can now sign in with their email and password.' },
      { bn: 'কর্মীর তথ্য বদলাতে সারির "সম্পাদনা করুন" আইকনে চাপুন।', en: 'To change details, tap the "edit" icon in the employee row.' },
      { bn: 'পাসওয়ার্ড ভুলে গেলে সারির চাবির আইকনে ("পাসওয়ার্ড রিসেট করুন") চাপুন।', en: 'If the password is forgotten, tap the key icon ("পাসওয়ার্ড রিসেট করুন") in the row.' },
      { bn: 'নতুন পাসওয়ার্ড লিখে নিশ্চিত করুন। কর্মীকে নতুন পাসওয়ার্ড জানিয়ে দিন।', en: 'Enter the new password, confirm, then tell the employee the new password.' },
      { bn: 'কর্মীকে সেকশনে যুক্ত করতে সারির "অ্যাসাইন" বাটনে চাপুন।', en: 'To give a person a section, press "অ্যাসাইন" in the row.' },
      { bn: 'যে সেকশনগুলো দিতে চান সেগুলো বেছে নিন।', en: 'Pick the sections you want to give them.' },
      { bn: '"সেভ" চাপুন। "সেকশন অ্যাসাইনমেন্ট সংরক্ষিত হয়েছে" বার্তা এলে কাজ শেষ।', en: 'Press "Save". When you see "সেকশন অ্যাসাইনমেন্ট সংরক্ষিত হয়েছে", it is done.' },
    ],
    tips: [
      { bn: 'একজন কর্মীকে একাধিক সেকশন দেওয়া যায়।', en: 'One employee can have more than one section.' },
      { bn: 'কর্মীর সারিতে "সম্পন্ন লিংক" সংখ্যা তাদের কাজের অগ্রগতি দেখায়।', en: 'The "Done" number in the row shows how many links the person has finished.' },
    ],
  },
  {
    id: 'sections',
    icon: Layers,
    title: { bn: 'গ্রুপ সেকশন ও লিংক', en: 'Group sections and links' },
    steps: [
      { bn: 'মেনু থেকে "গ্রুপ সেকশন" খুলুন।', en: 'Open "Group Sections" from the menu.' },
      { bn: 'নতুন সেকশন বানাতে "নতুন সেকশন যোগ করুন (Add Section)" বাটনে চাপুন।', en: 'To create a section, press "নতুন সেকশন যোগ করুন (Add Section)".' },
      { bn: 'সেকশনের নাম লিখুন, যেমন "Agro Groups"। চাইলে ছোট বিবরণও লিখুন।', en: 'Type a section name, for example "Agro Groups". You can add a short description too.' },
      { bn: 'সেভ করুন। সেকশন তালিকায় নতুনটি দেখা যাবে।', en: 'Save. The new section appears in the list.' },
      { bn: 'সেকশনের নামে চাপলে তার লিংক পেজ খুলবে।', en: 'Tap the section name to open its link page.' },
      { bn: 'একটি মাত্র লিংক যোগ করতে "নতুন গ্রুপ লিংক যোগ করুন" বাটনে চাপুন।', en: 'To add one link, press "নতুন গ্রুপ লিংক যোগ করুন".' },
      { bn: 'গ্রুপের লিংক ও নাম লিখে সেভ করুন।', en: 'Enter the group link and name, then save.' },
      { bn: 'অনেক লিংক একসাথে যোগ করতে সেকশন সারির "CSV" বা "CSV আপলোড করুন" বাটনে চাপুন।', en: 'To add many links at once, press "CSV" or "CSV আপলোড করুন" on the section row.' },
      { bn: 'CSV ফাইলে অবশ্যই একটি "url" কলাম থাকতে হবে। "title" কলাম ঐচ্ছিক।', en: 'The CSV file must have a "url" column. The "title" column is optional.' },
      { bn: 'ফাইল বেছে নিন। প্রথমে প্রিভিউ দেখাবে: কয়টি সংরক্ষিত, কয়টি ডুপ্লিকেট, কয়টি অবৈধ।', en: 'Choose the file. First you see a preview: how many will be saved, how many are duplicates, how many are invalid.' },
      { bn: 'সব ঠিক থাকলে নিশ্চিত করে আপলোড সম্পন্ন করুন।', en: 'If it looks right, confirm to finish the upload.' },
      { bn: 'অবৈধ সারির কারণ "মন্তব্য / কারণ" কলামে লেখা থাকে। ফাইল ঠিক করে আবার আপলোড করুন।', en: 'The reason for an invalid row is in the "মন্তব্য / কারণ" column. Fix the file and upload again.' },
      { bn: 'আগের সব আপলোড দেখতে মেনু থেকে "আপলোড হিস্ট্রি" খুলুন।', en: 'To see past uploads, open "Upload History" from the menu.' },
      { bn: 'লিংক বন্ধ করতে চাইলে লিংকের পাশে টিক দিয়ে বেছে নিন, তারপর নিষ্ক্রিয় করার বাটনে চাপুন।', en: 'To turn off some links, tick them and press the deactivate button.' },
      { bn: 'সেকশনের সব সক্রিয় লিংক একসাথে বন্ধ করতে সেকশনের বাল্ক বাটনে চাপুন (এই সেকশনের সকল সক্রিয় লিংক এক ক্লিকে নিষ্ক্রিয়)। তখন নিশ্চিত করতে বলবে।', en: 'To turn off all active links in a section, press "Deactivate all active links" (the bulk button for this section). You will be asked to confirm.' },
      { bn: 'লিংকের নাম বা লিংক বদলাতে সারির "সম্পাদনা" আইকনে চাপুন।', en: 'To change a link or its name, tap the "edit" icon in the row.' },
    ],
    tips: [
      { bn: 'একই লিংক দুইবার এলে সেটি ডুপ্লিকেট হিসেবে বাদ যায়।', en: 'A link that already exists is skipped as a duplicate.' },
      { bn: 'সেকশন পেজের "সব স্ট্যাটাস / সক্রিয় / নিষ্ক্রিয়" ফিল্টার দিয়ে লিংক খুঁজতে পারবেন।', en: 'Use the "All / Active / Inactive" filter on the section page to find links.' },
    ],
  },
  {
    id: 'products',
    icon: Package,
    title: { bn: 'পণ্য ও ক্যাম্পেইন', en: 'Products and campaigns' },
    steps: [
      { bn: 'মেনু থেকে "পণ্য (Products)" খুলুন। নতুন পণ্যের জন্য "নতুন পণ্য যোগ করুন (Add Product)" চাপুন।', en: 'Open "Products" from the menu. For a new product, press "নতুন পণ্য যোগ করুন (Add Product)".' },
      { bn: 'পণ্যের নাম বাংলা ও ইংরেজিতে লিখুন। একক (যেমন kg, packet) ও বিক্রয়মূল্য লিখুন।', en: 'Enter the product name in Bangla and English. Enter the unit (for example kg or packet) and the selling price.' },
      { bn: 'স্ট্যাটাস ঠিক করে সেভ করুন।', en: 'Set the status and save.' },
      { bn: 'মেনু থেকে "ক্যাম্পেইন" খুলুন। নতুন ক্যাম্পেইনের জন্য "নতুন ক্যাম্পেইন তৈরি করুন" চাপুন।', en: 'Open "Campaigns" from the menu. For a new campaign, press "নতুন ক্যাম্পেইন তৈরি করুন".' },
      { bn: 'ক্যাম্পেইনের নাম, চ্যানেল (যেমন Facebook Ad), পণ্য ও বাজেট সীমা লিখুন।', en: 'Enter the campaign name, channel (for example Facebook Ad), product and budget limit.' },
      { bn: 'স্ট্যাটাস বেছে নিন: পরিকল্পিত, চলমান, স্থগিত বা সমাপ্ত।', en: 'Pick a status: Planned, Running, Paused or Ended.' },
      { bn: 'ক্যাম্পেইন সারিতে "সম্পাদনা" চেপে বাজেট বা স্ট্যাটাস বদলাতে পারবেন।', en: 'Press "সম্পাদনা" on a campaign row to change its budget or status.' },
    ],
    tips: [
      { bn: 'বাজেট খরচের রং: ৮০% এর নিচে সবুজ (নিরাপদ), ৮০%–১০০% হলুদ (সতর্কতা), ১০০% এর বেশি লাল (সীমা পার)।', en: 'Budget colours: under 80% is green (safe), 80%–100% is yellow (warning), over 100% is red (over limit).' },
    ],
  },
  {
    id: 'leads',
    icon: UserPlus,
    title: { bn: 'লিডস পাইপলাইন', en: 'Leads pipeline' },
    steps: [
      { bn: 'মেনু থেকে "লিডস পাইপলাইন" খুলুন।', en: 'Open "Leads Pipeline" from the menu.' },
      { bn: 'উপরের ট্যাব দিয়ে স্টেজ বেছে নিন: নতুন (NEW), যোগাযোগকৃত (CONTACTED), যোগ্য (QUALIFIED), অর্ডার সম্পন্ন (ORDERED), বাতিল (LOST)।', en: 'Use the tabs at the top to pick a stage: NEW, CONTACTED, QUALIFIED, ORDERED, LOST.' },
      { bn: 'নাম, ফোন বা চ্যানেল লিখে খুঁজতে পারবেন। ফিল্টারে মার্কেটার, চ্যানেল, ধরন ও তারিখও বাছতে পারবেন।', en: 'Search by name, phone or channel. You can also filter by marketer, channel, type and dates.' },
      { bn: 'নতুন লিড যোগ করতে "নতুন লিড যুক্ত করুন (Add Lead)" চাপুন।', en: 'To add a new lead, press "নতুন লিড যুক্ত করুন (Add Lead)".' },
      { bn: 'ক্রেতার নাম, ফোন ও ক্রেতার ধরন লিখুন। ডুপ্লিকেট ফোন নম্বর হলে সতর্ক করবে।', en: 'Enter buyer name, phone and buyer type. If the phone number is a duplicate, you will be warned.' },
      { bn: 'লিডের স্টেজ বদলাতে "স্টেজ পরিবর্তন" থেকে নতুন স্টেজ বাছুন।', en: 'To move a lead, use "স্টেজ পরিবর্তন" and pick the new stage.' },
      { bn: 'লিডের বিবরণে চাপলে আগের ফলোআপ নোট দেখা যায়।', en: 'Tap a lead to see its details and past follow-up notes.' },
      { bn: 'নতুন ফলোআপ নোট লিখতে "এডমিন পরামর্শ বা ফলোআপ নোট লিখুন" বক্সে লিখে সেভ করুন।', en: 'To add a follow-up note, type in the "এডমিন পরামর্শ বা ফলোআপ নোট" box and save.' },
    ],
    tips: [
      { bn: 'এডমিন হিসেবে ক্রেতার মোবাইল নম্বর পুরো দেখা যায়। এটি গোপন রাখুন।', en: 'As admin you see the full buyer phone number. Keep it private.' },
    ],
  },
  {
    id: 'targets',
    icon: Target,
    title: { bn: 'টার্গেট ও বাজেট', en: 'Targets and budgets' },
    steps: [
      { bn: 'মেনু থেকে "টার্গেট ও বাজেট" খুলুন।', en: 'Open "Targets & Budget" from the menu.' },
      { bn: 'টার্গেট যোগ করতে নতুন টার্গেট ফর্মে সেকশন ও মেট্রিক টাইপ বেছে নিন।', en: 'To add a target, pick a section and metric type in the new target form.' },
      { bn: 'লক্ষ্যমাত্রার সংখ্যা লিখুন, যেমন 50000 বা 100।', en: 'Enter the target number, for example 50000 or 100.' },
      { bn: 'মেয়াদ বেছে নিন: মাসিক, দৈনিক বা কাস্টম (শুরু ও শেষের তারিখ)।', en: 'Pick the period: Monthly, Daily or Custom (start and end dates).' },
      { bn: 'নিচের "লাইভ ক্যালকুলেশন প্রিভিউ" দেখে নিশ্চিত হন, তারপর সেভ করুন।', en: 'Check the "live calculation preview" below, then save.' },
      { bn: 'একই সময়ে একই সেকশনের দুইটি টার্গেট থাকলে সতর্কবার্তা আসবে।', en: 'If the same section already has an overlapping target, a warning appears.' },
      { bn: 'টার্গেট বদলাতে সারির "সম্পাদনা", মুছতে "মুছে ফেলুন" চাপুন।', en: 'To change a target, press "সম্পাদনা". To delete, press "মুছে ফেলুন".' },
      { bn: 'এক মাসের টার্গেট পরের মাসে কপি করতে "বাল্ক কপি" ব্যবহার করুন। কপির ধরন (মাস থেকে মাস বা সেকশন থেকে সেকশন) বেছে নিন।', en: 'To copy targets to another month, use "বাল্ক কপি". Pick the copy type (month to month or section to section).' },
      { bn: 'মাসিক বাজেট লিখতে "বিজ্ঞাপন ও মার্কেটিং বাজেট নির্ধারণ" অংশে যান।', en: 'To set the monthly budget, go to the "বিজ্ঞাপন ও মার্কেটিং বাজেট নির্ধারণ" part.' },
      { bn: 'মাস বেছে নিন, তারপর ক্যাম্পেইন বা মোট বাজেট এবং টাকার পরিমাণ (৳) লিখুন।', en: 'Pick the month, then choose a campaign or the monthly total, and enter the amount (৳).' },
      { bn: 'সেভ করুন।', en: 'Save.' },
      { bn: 'খরচের অবস্থা "বাজেট খরচ ট্র্যাকিং" অংশে দেখা যায়।', en: 'Spending status is shown in the "বাজেট খরচ ট্র্যাকিং" section.' },
    ],
  },
  {
    id: 'reports',
    icon: FileText,
    title: { bn: 'রিপোর্ট: দৈনিক, সাপ্তাহিক, মাসিক', en: 'Reports: daily, weekly, monthly' },
    steps: [
      { bn: 'দৈনিক রিপোর্ট: মেনু থেকে "দৈনিক রিপোর্ট" খুলুন, তারিখ বেছে নিন। প্রতি কর্মীর পোস্ট, বিক্রয়, মুনাফা ও স্কোর দেখা যায়।', en: 'Daily reports: open "Daily Reports", pick a date. You see each person\'s posts, sales, profit and score.' },
      { bn: 'সাপ্তাহিক রিপোর্ট: মেনু থেকে "সাপ্তাহিক রিপোর্ট" খুলুন, সপ্তাহের তারিখ বেছে নিন।', en: 'Weekly reports: open "Weekly Reports" and pick the week.' },
      { bn: 'সাপ্তাহিক রিপোর্টের প্রশ্নের উত্তর ও মূল্যায়ন লিখুন।', en: 'Fill in the answers and the evaluation for the weekly report.' },
      { bn: 'ড্রাফট হিসেবে রাখতে "ড্রাফট সংরক্ষণ" চাপুন। এটি পরে বদলানো যাবে।', en: 'To keep it as a draft, press "ড্রাফট সংরক্ষণ". You can change it later.' },
      { bn: 'চূড়ান্ত করতে "রিপোর্ট প্রকাশ করুন" চাপুন এবং নিশ্চিত করুন। প্রকাশের পর আর বদলানো যায় না।', en: 'To finish, press "রিপোর্ট প্রকাশ করুন" and confirm. Once published, it cannot be changed.' },
      { bn: 'PDF লাগলে রিপোর্ট পেজের "পিডিএফ" লিংকে চাপুন।', en: 'If you need a PDF, tap the "পিডিএফ" link on the report page.' },
      { bn: 'মাসিক রিপোর্ট: মেনু থেকে "মাসিক রিপোর্ট" খুলুন, মাস বেছে নিন। কর্মীদের র‍্যাংক, বিক্রয়, মুনাফা ও মাসিক স্কোর দেখা যায়।', en: 'Monthly reports: open "Monthly Reports" and pick the month. You see the rank, sales, profit and monthly score of each person.' },
    ],
    tips: [
      { bn: 'সব রিপোর্ট একসাথে দেখতে মেনু থেকে "রিপোর্ট" পেজ ব্যবহার করুন।', en: 'To see all reports together, use the "Reports" page from the menu.' },
    ],
  },
  {
    id: 'plan',
    icon: CalendarCheck,
    title: { bn: '৯০ দিনের প্ল্যান', en: '90-day plan' },
    steps: [
      { bn: 'মেনু থেকে "৯০ দিনের প্ল্যান" খুলুন।', en: 'Open "90-Day Plan" from the menu.' },
      { bn: 'প্ল্যানের নাম বা শুরুর তারিখ বদলাতে উপরের "সম্পাদনা" আইকনে চাপুন।', en: 'To change the plan name or start date, tap the "edit" icon at the top.' },
      { bn: 'প্রতিটি ফেজ খুলে তার টাস্ক দেখুন।', en: 'Open each phase to see its tasks.' },
      { bn: 'নতুন টাস্ক যোগ করতে ফেজের ভেতরে টাস্ক যোগ বাটনে চাপুন। বাংলা ও ইংরেজি শিরোনাম লিখুন।', en: 'To add a task, use the add-task button inside a phase. Enter the title in Bangla and English.' },
      { bn: 'কর্মী, শেষের তারিখ ও প্রাথমিক স্ট্যাটাস বেছে নিন, তারপর সেভ করুন।', en: 'Pick the person, due date and starting status, then save.' },
      { bn: 'টাস্কের স্ট্যাটাস বদলান: শুরু হয়নি, চলমান, সম্পন্ন বা স্থগিত।', en: 'Change a task status: Not started, In progress, Done or Blocked.' },
      { bn: 'ফলাফল লিখতে টাস্কের "ফলাফল নোট" বক্সে লিখুন।', en: 'To record a result, write in the task\'s "ফলাফল নোট" box.' },
      { bn: 'ফেজের শেষে মাইলস্টোন মূল্যায়ন করুন: অর্জিত (MET), আংশিক (PARTIAL), অনর্জিত (MISSED), বা অপেক্ষমাণ (PENDING)।', en: 'At the end of a phase, rate the milestone: MET, PARTIAL, MISSED or PENDING.' },
    ],
  },
  {
    id: 'settings',
    icon: Settings,
    title: { bn: 'সেটিংস ও অডিট লগ', en: 'Settings and audit log' },
    steps: [
      { bn: 'মেনু থেকে "সেটিংস" খুলুন।', en: 'Open "Settings" from the menu.' },
      { bn: 'সেকশন ওয়েট: কোন সেকশনের স্কোরে কতটা গুরুত্ব হবে তা বদলান।', en: 'Section weights: change how much each section counts in the score.' },
      { bn: 'অ্যাচিভমেন্ট ক্যাপ: টার্গেটের বেশি কাজের জন্য সর্বোচ্চ স্কোর বেছে নিন (১০০%, ১২০% বা সীমাহীন)।', en: 'Achievement cap: pick the maximum score for work above target (100%, 120% or no cap).' },
      { bn: 'ব্যর্থতা থ্রেশহোল্ড: এর নিচে স্কোর হলে কর্মী "Failing" দেখাবে। ডিফল্ট ৮০%।', en: 'Failing threshold: a score below this shows the person as "Failing". The default is 80%.' },
      { bn: 'আনডু (UNDO) চালু বা বন্ধ করুন। চালু থাকলে লিংকের ভুল পরিবর্তন ফিরিয়ে আনা যায়।', en: 'Turn UNDO on or off. When on, a wrong link change can be reversed.' },
      { bn: 'এডিট উইন্ডো: কত দিন আগের তথ্য কর্মী বদলাতে পারবে তা দিনে লিখুন।', en: 'Edit window: enter how many days back an employee can still edit data.' },
      { bn: 'সাপ্তাহিক রিপোর্টের সময়সূচি ও ডিফল্ট ভাষা ঠিক করুন।', en: 'Set the weekly report schedule and default language.' },
      { bn: 'বদল শেষ হলে নিচের "Save" বাটনে চাপুন। Save না করলে কিছু বদলাবে না।', en: 'When done, press the "Save" button at the bottom. If you do not press Save, nothing changes.' },
      { bn: 'সব সেটিংস আগের অবস্থায় ফেরাতে ডিফল্ট বাটনে চাপুন, তারপর Save চাপুন।', en: 'To go back to the default settings, press the default button, then press Save.' },
      { bn: 'কে কখন কী বদলেছে তা দেখতে মেনু থেকে "অডিট লগ" খুলুন।', en: 'To see who changed what and when, open "Audit Log" from the menu.' },
      { bn: 'অডিট লগে নাম, অ্যাকশন বা এনটিটি (যেমন Product, Lead) দিয়ে ফিল্টার করুন।', en: 'In the audit log, filter by user, action or entity (for example Product or Lead).' },
      { bn: 'পরিবর্তনের বিস্তারিত দেখতে সারিতে চাপুন। "কপি JSON" দিয়ে তথ্য কপি করা যায়।', en: 'Tap a row to see the change details. "কপি JSON" copies the data.' },
    ],
  },
  {
    id: 'problems',
    icon: AlertTriangle,
    title: { bn: 'সাধারণ সমস্যা ও সমাধান', en: 'Common problems and fixes' },
    steps: [
      { bn: 'পেজ অনেকক্ষণ "লোড হচ্ছে" দেখালে পেজ রিফ্রেশ করুন (ব্রাউজারের রিফ্রেশ বাটন)।', en: 'If a page keeps showing "loading", refresh the page.' },
      { bn: '"সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি" দেখালে ইন্টারনেট চেক করে আবার চেষ্টা করুন।', en: 'If you see "সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি", check your internet and try again.' },
      { bn: 'কর্মী সাইন ইন করতে না পারলে সারির চাবির আইকনে পাসওয়ার্ড রিসেট করুন।', en: 'If an employee cannot sign in, reset their password with the key icon in the row.' },
      { bn: 'কর্মী সেকশন দেখতে না পেলে "অ্যাসাইন" থেকে সেকশন দিয়েছেন কি না দেখুন।', en: 'If an employee cannot see a section, check that you assigned it under "অ্যাসাইন".' },
      { bn: 'CSV আপলোডে অনেক সারি অবৈধ হলে ফাইলে "url" কলাম আছে কি না দেখুন।', en: 'If many CSV rows are invalid, check that the file has a "url" column.' },
      { bn: 'ভুল লিংক আপলোড হলে আনডু করুন। আনডু বন্ধ থাকলে সেটিংস থেকে চালু করুন।', en: 'If a wrong link was uploaded, use undo. If undo is off, turn it on in Settings.' },
      { bn: 'রিপোর্টে "ইতিমধ্যে প্রকাশিত" দেখালে রিপোর্টটি আগেই চূড়ান্ত হয়ে গেছে। বদলাতে হলে অডিট লগ দেখুন।', en: 'If a report says "already published", it is final. To check what changed, look at the audit log.' },
      { bn: 'সেটিংস বদলেও কাজ না হলে আবার "Save" চাপুন।', en: 'If a settings change does not work, press "Save" again.' },
      { bn: 'সহকারী (নিচের ডানে বাটন): কী করতে চান লিখুন, যেমন "নতুন কর্মী যোগ" বা "লিড দেখাও"। সে সঠিক পেজ খুলে দেবে, কিছু নিজে সেভ করবে না।', en: 'Assistant (bottom-right button): type what you want, such as "add employee" or "show leads". It opens the right page; it never saves anything by itself.' },
      { bn: 'সহকারী না বুঝলে "সহকারী শেখান" পেজে বাক্যটি ও পেজটি যোগ করুন। পরের বার সে বুঝবে।', en: 'If it does not understand, add the phrase and the page on "Teach Assistant". Next time it will know.' },
      { bn: 'দ্রুত কাজের জন্য #commands আছে (#status, #groups ইত্যাদি)। তালিকা দেখতে #help লিখুন।', en: 'Quick #commands also exist (#status, #groups and more); type #help for the list.' },
    ],
  },
  {
    id: 'safety',
    icon: ShieldCheck,
    title: { bn: 'নিরাপত্তা', en: 'Safety' },
    steps: [
      { bn: 'অ্যাডমিন পাসকোড গোপন রাখুন। কারও সাথে শেয়ার করবেন না, কোথাও লিখে রাখবেন না।', en: 'Keep the admin passcode secret. Do not share it or write it down where others can see.' },
      { bn: 'কর্মীর পাসওয়ার্ড নতুন করে দিলে শুধু কর্মীকেই জানান।', en: 'When you give an employee a new password, tell it only to that employee.' },
      { bn: 'ক্রেতার মোবাইল নম্বর এডমিন হিসেবে পুরো দেখা যায়। স্ক্রিনশট শেয়ার করার আগে সতর্ক থাকুন।', en: 'As admin you see full buyer phone numbers. Be careful before sharing screenshots.' },
      { bn: 'আনডু একটি সাম্প্রতিক লিংক পরিবর্তন ফিরিয়ে আনে। এটি সব কিছু আগের অবস্থায় নেয় না। বড় পরিবর্তনের আগে অডিট লগ দেখে নিন।', en: 'Undo reverses a recent link change. It does not reset everything. Check the audit log before big changes.' },
      { bn: 'আপনার তথ্য প্রতিটি পরিবর্তনের পর Telegram-এর একটি স্টোরেজ চ্যানেলে স্বয়ংক্রিয়ভাবে সংরক্ষিত হয়। আপনাকে আলাদাভাবে কিছু করতে হয় না।', en: 'Your data is saved automatically after each change as a snapshot in a Telegram storage channel. You do not need to do anything extra.' },
    ],
  },
];

function Line({ pair, mode, strong = false }: { pair: Pair; mode: Mode; strong?: boolean }) {
  const base = strong ? 'font-semibold text-slate-900' : 'text-slate-800';
  if (mode === 'bn') {
    return <p className={`${base} text-[15px] leading-relaxed break-words`}>{pair.bn}</p>;
  }
  if (mode === 'en') {
    return <p className={`${base} text-[15px] leading-relaxed break-words`}>{pair.en}</p>;
  }
  return (
    <div className="space-y-0.5">
      <p className={`${base} text-[15px] leading-relaxed break-words`}>{pair.bn}</p>
      <p className="text-sm leading-relaxed text-slate-500 break-words">{pair.en}</p>
    </div>
  );
}

export default function AdminManualPage() {
  const [mode, setMode] = useState<Mode>('both');

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900">অ্যাডমিন ম্যানুয়াল</h1>
              <p className="truncate text-xs text-slate-500">Admin Manual</p>
            </div>
          </div>
          <div
            role="group"
            aria-label="Language"
            className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1"
          >
            {MODE_LABELS.map((item) => {
              const active = mode === item.mode;
              return (
                <button
                  key={item.mode}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMode(item.mode)}
                  className={`rounded-lg px-2 py-2 text-sm font-semibold transition ${
                    active
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl space-y-5 px-4 pt-5">
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-2.5">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="min-w-0 space-y-1">
              <Line
                mode={mode}
                strong
                pair={{
                  bn: 'এই পেজটি অ্যাডমিন প্যানেল কীভাবে কাজ করে তা সহজ ভাষায় বুঝিয়ে দেয়। প্রতিটি বিষয় ধাপে ধাপে লেখা আছে।',
                  en: 'This page explains how the admin panel works in simple steps. Each topic is written step by step.',
                }}
              />
            </div>
          </div>
          <nav aria-label="Contents" className="mt-4 flex flex-wrap gap-2">
            {SECTIONS.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              >
                {i + 1}. {mode === 'en' ? s.title.en : s.title.bn}
              </a>
            ))}
          </nav>
        </section>

        {SECTIONS.map((section, index) => {
          const Icon = section.icon;
          return (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <h2 className="text-base font-bold leading-snug text-slate-900 break-words">
                    {index + 1}. {mode === 'en' ? section.title.en : section.title.bn}
                  </h2>
                  {mode === 'both' && (
                    <p className="text-sm text-slate-500 break-words">{section.title.en}</p>
                  )}
                </div>
              </div>

              <ol className="space-y-3">
                {section.steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Line pair={step} mode={mode} />
                    </div>
                  </li>
                ))}
              </ol>

              {section.tips && section.tips.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-amber-700">
                    {mode === 'en' ? 'Tip' : mode === 'bn' ? 'পরামর্শ' : 'পরামর্শ / Tip'}
                  </p>
                  <ul className="list-disc space-y-1.5 pl-5">
                    {section.tips.map((tip, i) => (
                      <li key={i} className="marker:text-amber-500">
                        <Line pair={tip} mode={mode} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          );
        })}

        <p className="pb-4 text-center text-xs text-slate-400">
          {mode === 'en' ? 'Need more help? Ask the admin team.' : mode === 'bn' ? 'আরও সাহায্য লাগলে অ্যাডমিন টিমকে জানান।' : 'আরও সাহায্য লাগলে অ্যাডমিন টিমকে জানান। / Need more help? Ask the admin team.'}
        </p>
      </main>
    </div>
  );
}
