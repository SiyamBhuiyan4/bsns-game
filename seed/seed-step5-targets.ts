import prisma from '../src/lib/prisma';
import { MetricType, PeriodType, BudgetScope } from '@prisma/client';
import { subDays, startOfMonth, endOfMonth, parseISO, format } from 'date-fns';
import { getDhakaDateString } from '../src/lib/date';

async function main() {
  console.log('Seeding Step 5: Targets, Budgets, and 14 days of Daily Performance Entries...');

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) {
    throw new Error('Admin user not found. Run initial seed first.');
  }

  const employees = await prisma.user.findMany({ where: { role: 'EMPLOYEE' } });
  if (employees.length === 0) {
    throw new Error('No employees found.');
  }

  const sections = await prisma.groupSection.findMany();
  if (sections.length === 0) {
    throw new Error('No sections found.');
  }

  const products = await prisma.product.findMany();
  if (products.length === 0) {
    throw new Error('No products found.');
  }

  const currentMonthStr = getDhakaDateString().slice(0, 7);
  const monthStart = startOfMonth(parseISO(`${currentMonthStr}-01`));
  const monthEnd = endOfMonth(monthStart);

  // 1. Seed Monthly Marketing Budget
  await prisma.budgetLimit.upsert({
    where: { id: 'budget-monthly-current' },
    update: {
      amount: 50000.0,
      month: currentMonthStr,
      set_by: admin.id,
    },
    create: {
      id: 'budget-monthly-current',
      scope: BudgetScope.MONTHLY_TOTAL,
      month: currentMonthStr,
      amount: 50000.0,
      set_by: admin.id,
    },
  });
  console.log(`✓ Set monthly budget for ${currentMonthStr}: ৳ 50,000`);

  // 2. Seed Targets for sections
  for (const s of sections) {
    const isAgro = s.name.includes('Agro');
    const targets = [
      { metric: MetricType.SALES_AMOUNT, val: isAgro ? 100000.0 : 80000.0 },
      { metric: MetricType.PROFIT_AMOUNT, val: isAgro ? 30000.0 : 24000.0 },
      { metric: MetricType.POSTS_DONE, val: isAgro ? 150.0 : 120.0 },
      { metric: MetricType.NEW_CLIENTS, val: isAgro ? 25.0 : 20.0 },
      { metric: MetricType.B2B_ORDERS, val: isAgro ? 10.0 : 15.0 },
      { metric: MetricType.RETENTION_COUNT, val: isAgro ? 15.0 : 12.0 },
      { metric: MetricType.FOLLOWUPS_DONE, val: isAgro ? 80.0 : 60.0 },
    ];

    for (const t of targets) {
      const existing = await prisma.sectionTarget.findFirst({
        where: {
          section_id: s.id,
          metric_type: t.metric,
          period_type: PeriodType.MONTHLY,
          period_start: monthStart,
        },
      });

      if (!existing) {
        await prisma.sectionTarget.create({
          data: {
            section_id: s.id,
            metric_type: t.metric,
            target_value: t.val,
            period_type: PeriodType.MONTHLY,
            period_start: monthStart,
            period_end: monthEnd,
            set_by: admin.id,
          },
        });
      }
    }
  }
  console.log('✓ Targets seeded for all sections.');

  // 3. Seed 14 days of Daily Performance Entries, Product Sales, and Daily Texts
  const issuesSample = [
    'ফেসবুক গ্রুপে পোস্ট অ্যাপ্রুভ হতে দেরি হয়েছে। কয়েকজন ক্রেতা কম দামে চাওয়াতে আলোচনা চলছে।',
    'পাইকাররা ক্যাশ অন ডেলিভারি না পেয়ে আপত্তি জানিয়েছিল, পরবর্তীতে আলোচনার মাধ্যমে সমাধান হয়েছে।',
    'কয়েকটি রেস্তোরাঁ নিয়মিত সরবরাহের নিশ্চয়তা চেয়েছে। সাপ্লাই চেইন টিমের সাথে কথা বলা দরকার।',
    'গ্যানোডার্মা পাউডার এর স্টক কম ছিল, ক্রেতাদের কাল ডেলিভারি দেওয়ার প্রতিশ্রুতি দিয়েছি।',
    'বৃষ্টির কারণে ডেলিভারি বয় পৌঁছাতে দেরি করেছে, ক্রেতাকে ফোন করে আপডেট রাখা হয়েছিল।',
  ];

  const prioritiesSample = [
    '১. ৫ জন পাইকারকে ফলো-আপ কল করা ২. নতুন মাশরুম রেসিপি পোস্ট শেয়ার করা ৩. রেস্তোরাঁ গ্রুপে পোস্ট দেওয়া',
    '১. বকেয়া পেমেন্টের ফলো-আপ ২. ৩টি নতুন B2B লিড জেনারেট করা ৩. ইনবক্স মেসেজের উত্তর দ্রুত দেওয়া',
    '১. পাইকারি অর্ডার কনফার্ম করা ২. কৃষি মেলা সংশ্লিষ্ট ফেসবুক গ্রুপগুলোতে পোস্ট ৩. পুরাতন ১০ জন ক্রেতাকে ফোন',
    '১. গ্যানোডার্মা প্যাকেজিং রিভিউ ২. ৫টি রেস্তোরাঁর সাথে কোটেশন শেয়ার ৩. গ্রুপের লিংক সম্পন্ন করা',
    '১. সাপ্তাহিক সেলস টার্গেট রিভিউ ২. নতুন ডিলারের সাথে মিটিং ৩. নিষ্ক্রিয় লিড পুনরায় সক্রিয় করা',
  ];

  const today = new Date();

  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const entryDate = subDays(today, dayOffset);
    const dateStr = format(entryDate, 'yyyy-MM-dd');
    const parsedDate = new Date(`${dateStr}T00:00:00.000Z`);

    for (let empIdx = 0; empIdx < employees.length; empIdx++) {
      const emp = employees[empIdx];
      const baseMultiplier = empIdx === 0 ? 1.1 : 0.9;
      const variation = 0.8 + ((dayOffset * 7 + empIdx * 13) % 40) / 100; // 0.8 - 1.2

      const dailySales = Math.round(3500 * baseMultiplier * variation);
      const dailyProfit = Math.round(dailySales * 0.32);
      const dailyNewClients = Math.max(1, Math.round(2 * baseMultiplier * variation));
      const dailyB2b = (dayOffset % 3 === 0) ? 1 : 0;
      const dailyRetention = (dayOffset % 2 === 0) ? 1 : 0;
      const dailyFollowups = Math.round(6 * baseMultiplier * variation);

      // Upsert metrics
      const metrics = [
        { metric: MetricType.SALES_AMOUNT, val: dailySales },
        { metric: MetricType.PROFIT_AMOUNT, val: dailyProfit },
        { metric: MetricType.NEW_CLIENTS, val: dailyNewClients },
        { metric: MetricType.B2B_ORDERS, val: dailyB2b },
        { metric: MetricType.RETENTION_COUNT, val: dailyRetention },
        { metric: MetricType.FOLLOWUPS_DONE, val: dailyFollowups },
      ];

      for (const m of metrics) {
        await prisma.dailyEntry.upsert({
          where: {
            employee_id_entry_date_metric_type: {
              employee_id: emp.id,
              entry_date: parsedDate,
              metric_type: m.metric,
            },
          },
          update: { value: m.val },
          create: {
            employee_id: emp.id,
            entry_date: parsedDate,
            metric_type: m.metric,
            value: m.val,
          },
        });
      }

      // Upsert Product sales
      if (products.length >= 2) {
        const p1 = products[0]; // fresh mushroom
        const p2 = products[1]; // ganoderma
        const q1 = Math.round(dailySales * 0.6 / Number(p1.selling_price));
        const q2 = Math.max(1, Math.round(dailySales * 0.4 / Number(p2.selling_price)));

        await prisma.dailyProductSale.upsert({
          where: {
            employee_id_entry_date_product_id: {
              employee_id: emp.id,
              entry_date: parsedDate,
              product_id: p1.id,
            },
          },
          update: { quantity: q1, amount: q1 * Number(p1.selling_price) },
          create: {
            employee_id: emp.id,
            entry_date: parsedDate,
            product_id: p1.id,
            quantity: q1,
            amount: q1 * Number(p1.selling_price),
          },
        });

        await prisma.dailyProductSale.upsert({
          where: {
            employee_id_entry_date_product_id: {
              employee_id: emp.id,
              entry_date: parsedDate,
              product_id: p2.id,
            },
          },
          update: { quantity: q2, amount: q2 * Number(p2.selling_price) },
          create: {
            employee_id: emp.id,
            entry_date: parsedDate,
            product_id: p2.id,
            quantity: q2,
            amount: q2 * Number(p2.selling_price),
          },
        });
      }

      // Upsert Daily Text
      const issue = issuesSample[(dayOffset + empIdx) % issuesSample.length];
      const priority = prioritiesSample[(dayOffset + empIdx) % prioritiesSample.length];

      await prisma.dailyText.upsert({
        where: {
          employee_id_entry_date: {
            employee_id: emp.id,
            entry_date: parsedDate,
          },
        },
        update: {
          main_issue: issue,
          next_priorities: priority,
        },
        create: {
          employee_id: emp.id,
          entry_date: parsedDate,
          main_issue: issue,
          next_priorities: priority,
        },
      });
    }
  }

  console.log('✓ 14 days of daily entries, product sales, and daily reflection text seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding Step 5:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
