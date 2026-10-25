import { PrismaClient, UserRole, PlanStatus, TaskStatus, MilestoneStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Seed: Initializing Users, Sections, Links & System Settings...');

  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword123!';
  const employeePassword = process.env.EMPLOYEE_PASSWORD || 'EmployeePassword123!';

  const adminHash = await bcrypt.hash(adminPassword, 12);
  const employeeHash = await bcrypt.hash(employeePassword, 12);

  // 1. Upsert Admin (Head of Marketing)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      password_hash: adminHash,
      is_active: true,
      role: UserRole.ADMIN,
      phone: '01700000000',
    },
    create: {
      name: 'হেড অব মার্কেটিং (Admin)',
      email: 'admin@example.com',
      password_hash: adminHash,
      role: UserRole.ADMIN,
      phone: '01700000000',
      is_active: true,
    },
  });
  console.log(`✅ Admin user seeded: ${admin.email}`);

  // 2. Upsert Employee 1
  const employee1 = await prisma.user.upsert({
    where: { email: 'employee1@example.com' },
    update: {
      password_hash: employeeHash,
      is_active: true,
      role: UserRole.EMPLOYEE,
      phone: '01711000001',
    },
    create: {
      name: 'রাকিব হাসান (Marketer 1)',
      email: 'employee1@example.com',
      password_hash: employeeHash,
      role: UserRole.EMPLOYEE,
      phone: '01711000001',
      is_active: true,
    },
  });
  console.log(`✅ Employee 1 user seeded: ${employee1.email}`);

  // 3. Upsert Employee 2
  const employee2 = await prisma.user.upsert({
    where: { email: 'employee2@example.com' },
    update: {
      password_hash: employeeHash,
      is_active: true,
      role: UserRole.EMPLOYEE,
      phone: '01811000002',
    },
    create: {
      name: 'তানিয়া আক্তার (Marketer 2)',
      email: 'employee2@example.com',
      password_hash: employeeHash,
      role: UserRole.EMPLOYEE,
      phone: '01811000002',
      is_active: true,
    },
  });
  console.log(`✅ Employee 2 user seeded: ${employee2.email}`);

  // 4. Default Scoring Settings
  await prisma.scoringSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      section_weights: {
        SALES_PROFIT: 30,
        CONTENT: 20,
        NEW_BUYERS_B2B: 20,
        RETENTION: 15,
        INBOX_FOLLOWUP: 15,
      },
      achievement_cap: 1.0,
      failing_threshold: 0.8,
      undo_enabled: true,
      employee_edit_window_days: 1,
      weekly_report_day: 'SUNDAY',
      weekly_report_time: '09:00',
      language_default: 'bn',
      digit_style: 'bn',
    },
  });
  console.log('✅ ScoringSettings initialized.');

  // 5. Sections
  const agroSection = await prisma.groupSection.upsert({
    where: { name: 'Agro Groups' },
    update: { is_active: true },
    create: {
      name: 'Agro Groups',
      description: 'কৃষি, মাশরুম ও জৈব চাষি বিষয়ক ফেসবুক গ্রুপসমূহ',
      is_active: true,
    },
  });

  const restSection = await prisma.groupSection.upsert({
    where: { name: 'Restaurant Groups' },
    update: { is_active: true },
    create: {
      name: 'Restaurant Groups',
      description: 'হোটেল, রেস্টুরেন্ট, ক্যাফে ও শেফদের বাণিজ্যিক গ্রুপসমূহ',
      is_active: true,
    },
  });
  console.log(`✅ Sections seeded: "${agroSection.name}", "${restSection.name}"`);

  // 6. Sample Initial Batch
  const agroBatch = await prisma.csvUploadBatch.create({
    data: {
      section_id: agroSection.id,
      uploaded_by: admin.id,
      file_name: 'initial_agro_groups.csv',
      total_rows: 10,
      inserted: 10,
      duplicates: 0,
      invalid: 0,
    },
  });

  const restBatch = await prisma.csvUploadBatch.create({
    data: {
      section_id: restSection.id,
      uploaded_by: admin.id,
      file_name: 'initial_restaurant_groups.csv',
      total_rows: 10,
      inserted: 10,
      duplicates: 0,
      invalid: 0,
    },
  });

  // 7. Seed 10 sample links per section
  const agroLinks = [
    { url: 'https://www.facebook.com/groups/example-agro-1', title: 'Agro Farmers Bangladesh' },
    { url: 'https://www.facebook.com/groups/example-agro-2', title: 'Organic Farming BD' },
    { url: 'https://www.facebook.com/groups/example-agro-3', title: 'Mushroom Cultivators Network BD' },
    { url: 'https://www.facebook.com/groups/example-agro-4', title: 'Krishi Uddokta Forum' },
    { url: 'https://www.facebook.com/groups/example-agro-5', title: 'Ganoderma Mushroom BD Community' },
    { url: 'https://www.facebook.com/groups/example-agro-6', title: 'Modern Agri Solutions Dhaka' },
    { url: 'https://www.facebook.com/groups/example-agro-7', title: 'Bd Agro Traders & Wholesalers' },
    { url: 'https://www.facebook.com/groups/example-agro-8', title: 'Organic Food & Herbal Market BD' },
    { url: 'https://www.facebook.com/groups/example-agro-9', title: 'Rooftop Gardening & Mushroom Club' },
    { url: 'https://www.facebook.com/groups/example-agro-10', title: 'Bangladesh Agriculture & Livestock Hub' },
  ];

  for (const item of agroLinks) {
    await prisma.groupLink.upsert({
      where: {
        section_id_url: {
          section_id: agroSection.id,
          url: item.url,
        },
      },
      update: { title: item.title, is_active: true },
      create: {
        section_id: agroSection.id,
        url: item.url,
        title: item.title,
        uploaded_batch_id: agroBatch.id,
        is_active: true,
      },
    });
  }

  const restLinks = [
    { url: 'https://www.facebook.com/groups/example-restaurant-1', title: 'Restaurant Owners Dhaka' },
    { url: 'https://www.facebook.com/groups/example-restaurant-2', title: 'Dhaka Foodies & Chefs Forum' },
    { url: 'https://www.facebook.com/groups/example-restaurant-3', title: 'Hotel & Catering Supply Bangladesh' },
    { url: 'https://www.facebook.com/groups/example-restaurant-4', title: 'Fast Food & Cafe Owners Association' },
    { url: 'https://www.facebook.com/groups/example-restaurant-5', title: 'Chittagong Restaurant & Hospitality Club' },
    { url: 'https://www.facebook.com/groups/example-restaurant-6', title: 'Gulshan Banani Fine Dining Society' },
    { url: 'https://www.facebook.com/groups/example-restaurant-7', title: 'Food Truck & Cloud Kitchen BD' },
    { url: 'https://www.facebook.com/groups/example-restaurant-8', title: 'Bakery & Pastry Chefs of Dhaka' },
    { url: 'https://www.facebook.com/groups/example-restaurant-9', title: 'Commercial Kitchen Supplies BD' },
    { url: 'https://www.facebook.com/groups/example-restaurant-10', title: 'Bangladesh Restaurant Association Circle' },
  ];

  for (const item of restLinks) {
    await prisma.groupLink.upsert({
      where: {
        section_id_url: {
          section_id: restSection.id,
          url: item.url,
        },
      },
      update: { title: item.title, is_active: true },
      create: {
        section_id: restSection.id,
        url: item.url,
        title: item.title,
        uploaded_batch_id: restBatch.id,
        is_active: true,
      },
    });
  }

  console.log(`✅ Seeded 10 links each for Agro Groups and Restaurant Groups!`);

  // 8. Section Assignments
  // Employee 1: assigned to both Agro Groups & Restaurant Groups
  await prisma.assignment.upsert({
    where: {
      employee_id_section_id: {
        employee_id: employee1.id,
        section_id: agroSection.id,
      },
    },
    update: {},
    create: {
      employee_id: employee1.id,
      section_id: agroSection.id,
      assigned_by: admin.id,
    },
  });

  await prisma.assignment.upsert({
    where: {
      employee_id_section_id: {
        employee_id: employee1.id,
        section_id: restSection.id,
      },
    },
    update: {},
    create: {
      employee_id: employee1.id,
      section_id: restSection.id,
      assigned_by: admin.id,
    },
  });

  // Employee 2: assigned to Agro Groups ONLY (Acceptance Test 2 verification)
  await prisma.assignment.upsert({
    where: {
      employee_id_section_id: {
        employee_id: employee2.id,
        section_id: agroSection.id,
      },
    },
    update: {},
    create: {
      employee_id: employee2.id,
      section_id: agroSection.id,
      assigned_by: admin.id,
    },
  });

  console.log(`✅ Assignments configured: Employee 1 -> (Agro, Restaurant), Employee 2 -> (Agro only).`);

  // 9. Products Seed
  const prodMushroom = await prisma.product.upsert({
    where: { id: 'prod-mushroom-fresh' },
    update: {},
    create: {
      id: 'prod-mushroom-fresh',
      name_bn: 'তাজা ওয়েস্টার মাশরুম',
      name_en: 'Fresh Oyster Mushroom',
      unit: 'kg',
      selling_price: 350.0,
      is_active: true,
    },
  });

  const prodGanoderma = await prisma.product.upsert({
    where: { id: 'prod-ganoderma-powder' },
    update: {},
    create: {
      id: 'prod-ganoderma-powder',
      name_bn: 'গ্যানোডার্মা পাউডার (ভেষজ মাশরুম)',
      name_en: 'Ganoderma Powder (Red Reishi)',
      unit: 'packet',
      selling_price: 1200.0,
      is_active: true,
    },
  });

  const prodDryMushroom = await prisma.product.upsert({
    where: { id: 'prod-dry-mushroom' },
    update: {},
    create: {
      id: 'prod-dry-mushroom',
      name_bn: 'প্রিমিয়াম ড্রাই মাশরুম',
      name_en: 'Premium Dried Mushroom',
      unit: 'packet',
      selling_price: 650.0,
      is_active: true,
    },
  });

  console.log(`✅ Products seeded: "${prodMushroom.name_bn}", "${prodGanoderma.name_bn}", "${prodDryMushroom.name_bn}"`);

  // 10. Campaigns Seed
  const campFbGroup = await prisma.campaign.upsert({
    where: { id: 'camp-fb-group-promo' },
    update: {},
    create: {
      id: 'camp-fb-group-promo',
      name: 'অর্গানিক মাশরুম ফেসবুক গ্রুপ প্রচারণা',
      channel: 'FACEBOOK_GROUP',
      product_id: prodMushroom.id,
      owner_id: admin.id,
      start_date: new Date('2026-10-01'),
      budget_amount: 15000.0,
      status: 'RUNNING',
    },
  });

  const campFbAd = await prisma.campaign.upsert({
    where: { id: 'camp-fb-paid-ad' },
    update: {},
    create: {
      id: 'camp-fb-paid-ad',
      name: 'গ্যানোডার্মা হেলথ ও এনার্জি বুস্ট বিজ্ঞাপন',
      channel: 'FACEBOOK_AD',
      product_id: prodGanoderma.id,
      owner_id: admin.id,
      start_date: new Date('2026-10-05'),
      budget_amount: 25000.0,
      status: 'RUNNING',
    },
  });

  const campYoutube = await prisma.campaign.upsert({
    where: { id: 'camp-youtube-agri' },
    update: {},
    create: {
      id: 'camp-youtube-agri',
      name: 'কৃষি উদ্যোক্তা ইউটিউব ভিডিও প্রচারণা',
      channel: 'YOUTUBE',
      product_id: null,
      owner_id: admin.id,
      start_date: new Date('2026-10-10'),
      budget_amount: 10000.0,
      status: 'RUNNING',
    },
  });

  console.log(`✅ Campaigns seeded: 3 active campaigns.`);

  // 11. Seed 30 sample leads (with at least 5 QUALIFIED leads updated 4 days ago)
  const sampleLeadsData = [
    // 5 Unfinished orders (QUALIFIED and updated 4 days ago)
    { name: 'কামাল হোসেন (পাইকার)', phone: '01712000001', buyer_type: 'WHOLESALER', status: 'QUALIFIED', prodId: prodMushroom.id, empId: employee1.id, expected: 25000, daysAgo: 4 },
    { name: 'রেড চিলি রেস্টুরেন্ট (উত্তরা)', phone: '01712000002', buyer_type: 'RESTAURANT', status: 'QUALIFIED', prodId: prodMushroom.id, empId: employee1.id, expected: 15000, daysAgo: 5 },
    { name: 'সবুজ বাংলা এগ্রো ট্রেডার্স', phone: '01712000003', buyer_type: 'DEALER', status: 'QUALIFIED', prodId: prodGanoderma.id, empId: employee1.id, expected: 40000, daysAgo: 4 },
    { name: 'ডা: রফিকুল ইসলাম (হারবাল)', phone: '01812000004', buyer_type: 'WHOLESALER', status: 'QUALIFIED', prodId: prodGanoderma.id, empId: employee2.id, expected: 18000, daysAgo: 5 },
    { name: 'ক্যাফে রিও গুলশান', phone: '01912000005', buyer_type: 'RESTAURANT', status: 'QUALIFIED', prodId: prodDryMushroom.id, empId: employee1.id, expected: 12000, daysAgo: 4 },

    // Recent Qualified leads (less than 3 days)
    { name: 'ফারুক আহমেদ', phone: '01712000006', buyer_type: 'RETAIL', status: 'QUALIFIED', prodId: prodMushroom.id, empId: employee1.id, expected: 2000, daysAgo: 1 },
    { name: 'আকরাম ট্রেডার্স (বগুড়া)', phone: '01812000007', buyer_type: 'WHOLESALER', status: 'QUALIFIED', prodId: prodGanoderma.id, empId: employee2.id, expected: 30000, daysAgo: 0 },

    // ORDERED leads (must have order_amount)
    { name: 'হোটেল ওয়েস্টিন কিচেন', phone: '01712000008', buyer_type: 'RESTAURANT', status: 'ORDERED', prodId: prodDryMushroom.id, empId: employee1.id, amount: 24000, daysAgo: 1 },
    { name: 'নজরুল ইসলাম (কৃষক)', phone: '01812000009', buyer_type: 'FARMER', status: 'ORDERED', prodId: prodMushroom.id, empId: employee2.id, amount: 8500, daysAgo: 2 },
    { name: 'অর্গানিক লাইফ বিডি', phone: '01912000010', buyer_type: 'DEALER', status: 'ORDERED', prodId: prodGanoderma.id, empId: employee1.id, amount: 36000, daysAgo: 3 },
    { name: 'শামীম রেজা', phone: '01712000011', buyer_type: 'RETAIL', status: 'ORDERED', prodId: prodGanoderma.id, empId: employee2.id, amount: 2400, daysAgo: 2 },
    { name: 'বনফুল রেস্টুরেন্ট', phone: '01812000012', buyer_type: 'RESTAURANT', status: 'ORDERED', prodId: prodMushroom.id, empId: employee1.id, amount: 15500, daysAgo: 1 },

    // CONTACTED leads
    { name: 'জসিম উদ্দিন', phone: '01712000013', buyer_type: 'FARMER', status: 'CONTACTED', prodId: prodMushroom.id, empId: employee1.id, expected: 5000, daysAgo: 1 },
    { name: 'মাহিমা আক্তার', phone: '01812000014', buyer_type: 'RETAIL', status: 'CONTACTED', prodId: prodGanoderma.id, empId: employee2.id, expected: 1200, daysAgo: 0 },
    { name: 'ঢাকা ফুড কোর্ট', phone: '01912000015', buyer_type: 'RESTAURANT', status: 'CONTACTED', prodId: prodMushroom.id, empId: employee1.id, expected: 8000, daysAgo: 2 },
    { name: 'আমানত এগ্রো', phone: '01712000016', buyer_type: 'DEALER', status: 'CONTACTED', prodId: prodDryMushroom.id, empId: employee1.id, expected: 20000, daysAgo: 1 },
    { name: 'সেলিম মাহমুদ', phone: '01812000017', buyer_type: 'WHOLESALER', status: 'CONTACTED', prodId: prodGanoderma.id, empId: employee2.id, expected: 15000, daysAgo: 3 },

    // NEW leads
    { name: 'মাহবুব আলম', phone: '01712000018', buyer_type: 'RETAIL', status: 'NEW', prodId: prodMushroom.id, empId: employee1.id, expected: 1500, daysAgo: 0 },
    { name: 'তাহমিনা খাতুন', phone: '01812000019', buyer_type: 'RETAIL', status: 'NEW', prodId: prodGanoderma.id, empId: employee2.id, expected: 2400, daysAgo: 0 },
    { name: 'রয়্যাল ডাইন ক্যাফে', phone: '01912000020', buyer_type: 'RESTAURANT', status: 'NEW', prodId: prodMushroom.id, empId: employee1.id, expected: 10000, daysAgo: 1 },
    { name: 'হাসান এন্টারপ্রাইজ', phone: '01712000021', buyer_type: 'WHOLESALER', status: 'NEW', prodId: prodDryMushroom.id, empId: employee1.id, expected: 18000, daysAgo: 0 },
    { name: 'বেলাল চৌধুরী', phone: '01812000022', buyer_type: 'FARMER', status: 'NEW', prodId: prodMushroom.id, empId: employee2.id, expected: 4500, daysAgo: 1 },
    { name: 'সায়মা ইসলাম', phone: '01912000023', buyer_type: 'RETAIL', status: 'NEW', prodId: prodGanoderma.id, empId: employee1.id, expected: 1200, daysAgo: 0 },

    // LOST leads (must have lost_reason)
    { name: 'আল-মদিনা হোটেল', phone: '01712000024', buyer_type: 'RESTAURANT', status: 'LOST', prodId: prodMushroom.id, empId: employee1.id, reason: 'স্থানীয় বাজারে অন্য সরবরাহকারী থেকে কম দামে পেয়েছে', daysAgo: 3 },
    { name: 'মোস্তফা কামাল', phone: '01812000025', buyer_type: 'FARMER', status: 'LOST', prodId: prodGanoderma.id, empId: employee2.id, reason: 'বাজেট স্বল্পতা ও পরবর্তীতে যোগাযোগ করবে জানিয়েছে', daysAgo: 4 },
    { name: 'কুইক বাইট ফাস্টফুড', phone: '01912000026', buyer_type: 'RESTAURANT', status: 'LOST', prodId: prodDryMushroom.id, empId: employee1.id, reason: 'আপাতত মাশরুম আইটেম মেনু থেকে বাদ দিয়েছে', daysAgo: 2 },
    { name: 'রাশেদ খান', phone: '01712000027', buyer_type: 'RETAIL', status: 'LOST', prodId: prodMushroom.id, empId: employee2.id, reason: 'ডেলিভারি চার্জ বেশি মনে হওয়ায় অর্ডার বাতিল করেছে', daysAgo: 1 },
    { name: 'নিউ ঢাকা ফুডস', phone: '01812000028', buyer_type: 'DEALER', status: 'LOST', prodId: prodGanoderma.id, empId: employee1.id, reason: 'বাকিতে মাল চেয়েছিল, নগদ ছাড়া দেওয়া সম্ভব হয়নি', daysAgo: 5 },
    { name: 'তন্ময় সাহা', phone: '01912000029', buyer_type: 'WHOLESALER', status: 'LOST', prodId: prodDryMushroom.id, empId: employee2.id, reason: 'প্যাকেজিং সাইজ তাদের চাহিদামতো ছিল না', daysAgo: 3 },
    { name: 'সিরাজুল ইসলাম', phone: '01712000030', buyer_type: 'FARMER', status: 'NEW', prodId: prodMushroom.id, empId: employee1.id, expected: 6000, daysAgo: 0 },
  ];

  for (const item of sampleLeadsData) {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - (item.daysAgo || 0));

    const existingLead = await prisma.lead.findFirst({
      where: { phone: item.phone },
    });

    if (!existingLead) {
      await prisma.lead.create({
        data: {
          name: item.name,
          phone: item.phone,
          buyer_type: item.buyer_type as any,
          product_id: item.prodId || null,
          campaign_id: campFbAd.id,
          source_channel: 'ফেসবুক পেইজ ও গ্রুপ প্রচার',
          owner_id: item.empId,
          status: item.status as any,
          expected_value: (item as any).expected || null,
          order_amount: (item as any).amount || null,
          lost_reason: (item as any).reason || null,
          created_at: pastDate,
          updated_at: pastDate,
        },
      });
    }
  }

  console.log(`✅ Seeded 30 realistic leads (including 5 QUALIFIED leads older than 3 days).`);

  // 12. Seed 90-Day Plan (Step 9)
  console.log('🌱 Seeding 90-Day Marketing & Sales Plan (Step 9)...');
  const now = new Date();
  const planStartDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));

  // Helper to add days in UTC
  const addDaysUtc = (base: Date, days: number): Date => {
    const res = new Date(base);
    res.setUTCDate(res.getUTCDate() + days);
    return res;
  };

  // Remove any previously seeded plan with this name
  await prisma.plan.deleteMany({
    where: {
      name: '৯০ দিনের প্রাথমিক ডিজিটাল মার্কেটিং ও বিক্রয় কর্মপরিকল্পনা',
    },
  });

  const plan = await prisma.plan.create({
    data: {
      name: '৯০ দিনের প্রাথমিক ডিজিটাল মার্কেটিং ও বিক্রয় কর্মপরিকল্পনা',
      start_date: planStartDate,
      status: PlanStatus.ACTIVE,
      created_by: admin.id,
    },
  });

  // Phase 1
  const phase1 = await prisma.planPhase.create({
    data: {
      plan_id: plan.id,
      order_no: 1,
      name_bn: 'প্রথম ৩০ দিন — বিশ্লেষণ',
      name_en: 'Days 1–30 / Analysis',
      day_start: 1,
      day_end: 30,
    },
  });

  await prisma.planMilestone.create({
    data: {
      plan_id: plan.id,
      phase_id: phase1.id,
      title_bn: 'প্রথম ৩০ দিনের লক্ষ্য ও মূল্যায়ন',
      expected_result: 'বর্তমান ব্যবসার বেসলাইন, অগ্রাধিকারভিত্তিক পণ্যের তালিকা এবং অনুমোদিত কর্মপরিকল্পনা',
      achieved_result: 'পণ্যের তথ্য ও ডাটাবেস পর্যালোচিত',
      status: MilestoneStatus.PARTIAL,
      reviewed_at: new Date(),
    },
  });

  const phase1Tasks = [
    {
      title_bn: 'সব পণ্যের তালিকা, বিক্রির পরিমাণ, বিক্রয়মূল্য ও খরচ সংগ্রহ',
      title_en: 'Collect product list, sales volume, prices, and costs',
      owner_id: employee1.id,
      status: TaskStatus.DONE,
      progress_percent: 100,
      due_date: addDaysUtc(planStartDate, 5), // Day 6
    },
    {
      title_bn: 'বর্তমান মার্কেটিং চ্যানেল ও বিজ্ঞাপন পর্যালোচনা',
      title_en: 'Review current marketing channels and ads',
      owner_id: employee2.id,
      status: TaskStatus.DONE,
      progress_percent: 100,
      due_date: addDaysUtc(planStartDate, 11), // Day 12
    },
    {
      title_bn: 'পুরোনো ক্রেতা ও সম্ভাব্য ক্রেতার ডেটাবেস তৈরি বা পরিষ্কার করা',
      title_en: 'Build or clean customer and lead database',
      owner_id: employee1.id,
      status: TaskStatus.IN_PROGRESS,
      progress_percent: 70,
      due_date: addDaysUtc(planStartDate, 17), // Day 18
    },
    {
      title_bn: 'পণ্যভিত্তিক ক্রেতার ধরন নির্ধারণ',
      title_en: 'Determine buyer types per product',
      owner_id: employee2.id,
      status: TaskStatus.IN_PROGRESS,
      progress_percent: 50,
      due_date: addDaysUtc(planStartDate, 23), // Day 24
    },
    {
      title_bn: 'মাসিক বাজেট ও KPI-এর প্রস্তাব তৈরি',
      title_en: 'Draft proposal for monthly budget and KPIs',
      owner_id: admin.id,
      status: TaskStatus.NOT_STARTED,
      progress_percent: 0,
      due_date: addDaysUtc(planStartDate, 29), // Day 30
    },
  ];

  for (const t of phase1Tasks) {
    await prisma.planTask.create({
      data: {
        plan_id: plan.id,
        phase_id: phase1.id,
        ...t,
      },
    });
  }

  // Phase 2
  const phase2 = await prisma.planPhase.create({
    data: {
      plan_id: plan.id,
      order_no: 2,
      name_bn: 'দিন ৩১–৬০ — বাস্তবায়ন',
      name_en: 'Days 31–60 / Implementation',
      day_start: 31,
      day_end: 60,
    },
  });

  await prisma.planMilestone.create({
    data: {
      plan_id: plan.id,
      phase_id: phase2.id,
      title_bn: 'দিন ৩১–৬০ এর লক্ষ্য ও মূল্যায়ন',
      expected_result: 'বাস্তব লিড, অর্ডার, ক্যাম্পেইন পারফরম্যান্স এবং প্রথম দফার উন্নয়নের তথ্য',
      status: MilestoneStatus.PENDING,
    },
  });

  const phase2Tasks = [
    {
      title_bn: 'নির্বাচিত পণ্যের জন্য বিজ্ঞাপন ও কনটেন্ট ক্যাম্পেইন চালু করা',
      title_en: 'Launch ads and content campaigns for selected products',
      owner_id: employee1.id,
      status: TaskStatus.NOT_STARTED,
      progress_percent: 0,
      due_date: addDaysUtc(planStartDate, 35), // Day 36
    },
    {
      title_bn: 'কৃষক, পাইকার, রেস্টুরেন্ট ও ডিলারদের সঙ্গে যোগাযোগ বাড়ানো',
      title_en: 'Increase outreach to farmers, wholesalers, restaurants, and dealers',
      owner_id: employee2.id,
      status: TaskStatus.NOT_STARTED,
      progress_percent: 0,
      due_date: addDaysUtc(planStartDate, 41), // Day 42
    },
    {
      title_bn: 'লিড সংগ্রহ, ফলোআপ ও অর্ডার কনভার্সনের নিয়ম চালু করা',
      title_en: 'Establish rules for lead collection, followup, and order conversion',
      owner_id: employee1.id,
      status: TaskStatus.NOT_STARTED,
      progress_percent: 0,
      due_date: addDaysUtc(planStartDate, 47), // Day 48
    },
    {
      title_bn: 'পণ্যের বিক্রির তথ্য ও বিজ্ঞাপনের ফলাফল এক জায়গায় রাখা',
      title_en: 'Centralize product sales data and advertising results',
      owner_id: employee2.id,
      status: TaskStatus.NOT_STARTED,
      progress_percent: 0,
      due_date: addDaysUtc(planStartDate, 53), // Day 54
    },
    {
      title_bn: 'সফল ও দুর্বল ক্যাম্পেইন চিহ্নিত করা',
      title_en: 'Identify successful and underperforming campaigns',
      owner_id: admin.id,
      status: TaskStatus.NOT_STARTED,
      progress_percent: 0,
      due_date: addDaysUtc(planStartDate, 59), // Day 60
    },
  ];

  for (const t of phase2Tasks) {
    await prisma.planTask.create({
      data: {
        plan_id: plan.id,
        phase_id: phase2.id,
        ...t,
      },
    });
  }

  // Phase 3
  const phase3 = await prisma.planPhase.create({
    data: {
      plan_id: plan.id,
      order_no: 3,
      name_bn: 'দিন ৬১–৯০ — উন্নয়ন',
      name_en: 'Days 61–90 / Development',
      day_start: 61,
      day_end: 90,
    },
  });

  await prisma.planMilestone.create({
    data: {
      plan_id: plan.id,
      phase_id: phase3.id,
      title_bn: 'দিন ৬১–৯০ এর লক্ষ্য ও মূল্যায়ন',
      expected_result: 'পরিমাপযোগ্য মার্কেটিং ব্যবস্থা, বিক্রির উন্নয়নের প্রমাণ এবং পরবর্তী সময়ের পরিকল্পনা',
      status: MilestoneStatus.PENDING,
    },
  });

  const phase3Tasks = [
    {
      title_bn: 'ভালো ফল দেওয়া ক্যাম্পেইনে শর্তসাপেক্ষে বাজেট বাড়ানো',
      title_en: 'Conditionally increase budget for high-performing campaigns',
      owner_id: admin.id,
      status: TaskStatus.NOT_STARTED,
      progress_percent: 0,
      due_date: addDaysUtc(planStartDate, 65), // Day 66
    },
    {
      title_bn: 'পুরোনো ক্রেতার পুনরায় অর্ডারের কার্যক্রম শক্তিশালী করা',
      title_en: 'Strengthen re-order retention activities for existing customers',
      owner_id: employee1.id,
      status: TaskStatus.NOT_STARTED,
      progress_percent: 0,
      due_date: addDaysUtc(planStartDate, 71), // Day 72
    },
    {
      title_bn: 'B2B ক্রেতাদের জন্য নিয়মিত বিক্রয় পাইপলাইন তৈরি',
      title_en: 'Build regular sales pipeline for B2B buyers',
      owner_id: employee2.id,
      status: TaskStatus.NOT_STARTED,
      progress_percent: 0,
      due_date: addDaysUtc(planStartDate, 77), // Day 78
    },
    {
      title_bn: 'কর্মীদের KPI মূল্যায়ন ও প্রয়োজনীয় প্রশিক্ষণ',
      title_en: 'Evaluate employee KPIs and conduct needed training',
      owner_id: admin.id,
      status: TaskStatus.NOT_STARTED,
      progress_percent: 0,
      due_date: addDaysUtc(planStartDate, 83), // Day 84
    },
    {
      title_bn: 'পরবর্তী ছয় মাসের ব্যবসা সম্প্রসারণ পরিকল্পনা তৈরি',
      title_en: 'Formulate business expansion plan for next six months',
      owner_id: admin.id,
      status: TaskStatus.NOT_STARTED,
      progress_percent: 0,
      due_date: addDaysUtc(planStartDate, 89), // Day 90
    },
  ];

  for (const t of phase3Tasks) {
    await prisma.planTask.create({
      data: {
        plan_id: plan.id,
        phase_id: phase3.id,
        ...t,
      },
    });
  }

  console.log(`✅ Seeded 90-Day Plan with 3 phases, 15 tasks, and 3 milestones.`);
  console.log('\n🚀 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
