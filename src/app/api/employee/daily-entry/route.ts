import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { getDhakaDateString, isDateWithinEditWindow, parseDateOnly } from '@/lib/date';
import { LOCK_NOTICE, SAVE_SUCCESS_MESSAGE } from '@/lib/daily-entry';
import { makeTranslator } from '@/lib/i18n/translate';
import { readLangFromRequest } from '@/lib/i18n/request-lang';
import { MetricType } from '@prisma/client';
import { z } from 'zod';

const dailyEntrySubmitSchema = z.object({
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  metrics: z.object({
    SALES_AMOUNT: z.number().min(0).default(0),
    PROFIT_AMOUNT: z.number().min(0).default(0),
    CONFIRMED_ORDERS: z.number().int().min(0).default(0),
    NEW_LEADS: z.number().int().min(0).default(0),
    NEW_CLIENTS: z.number().int().min(0).default(0),
    RETENTION_COUNT: z.number().int().min(0).default(0),
    AD_SPEND: z.number().min(0).default(0),
    FOLLOWUPS_DONE: z.number().int().min(0).default(0),
    B2B_ORDERS: z.number().int().min(0).default(0),
    B2B_INQUIRIES: z.number().int().min(0).default(0),
    B2B_INQUIRY_VALUE: z.number().min(0).default(0),
    POSTS_DONE: z.number().int().min(0).optional(),
  }),
  product_sales: z.array(
    z.object({
      product_id: z.string().min(1).max(100),
      quantity: z.number().min(0),
      amount: z.number().min(0),
    })
  ).max(500).optional().default([]),
  // Omitted fields keep what is already saved: My Work sends only next_priorities and no
  // metric notes, and must not wipe the main issue or notes written on the Daily Entry page.
  daily_text: z.object({
    main_issue: z.string().max(500).optional().nullable(),
    next_priorities: z.string().max(500).optional().nullable(),
  }).optional().default({}),
  metric_notes: z.record(z.string(), z.string().max(300)).optional(),
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isValidDateStr = (v: string) => DATE_RE.test(v) && !isNaN(parseDateOnly(v).getTime());

export async function GET(req: NextRequest) {
  try {
    // Notices follow the language the user is reading the app in.
    const L = makeTranslator(readLangFromRequest(req));

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin Prohibition (Section 7.2): Admin CANNOT open or submit employee daily entry form
    if (session.role === 'ADMIN') {
      return NextResponse.json(
        {
          error: 'অ্যাডমিন কর্মচারী দৈনিক এন্ট্রি ফর্ম খুলতে বা দেখতে পারবেন না।',
          is_admin_forbidden: true,
          can_edit: false,
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date') || getDhakaDateString();
    if (!isValidDateStr(dateStr)) {
      return NextResponse.json({ error: 'সঠিক তারিখ দিন (YYYY-MM-DD) / Invalid date' }, { status: 400 });
    }
    const targetEmployeeId = session.id;

    // Get scoring settings for edit window
    const settings = await prisma.scoringSettings.findUnique({ where: { id: 'default' } });
    const editWindowDays = settings?.employee_edit_window_days ?? 1;

    const { isAllowed, todayDhaka, oldestAllowedDhaka } = isDateWithinEditWindow(
      dateStr,
      editWindowDays
    );

    const parsedDate = parseDateOnly(dateStr);

    // Fetch entries
    const entries = await prisma.dailyEntry.findMany({
      where: {
        employee_id: targetEmployeeId,
        entry_date: parsedDate,
      },
    });

    // Fetch product sales
    const productSales = await prisma.dailyProductSale.findMany({
      where: {
        employee_id: targetEmployeeId,
        entry_date: parsedDate,
      },
      include: {
        product: true,
      },
    });

    // Fetch daily text
    const dailyText = await prisma.dailyText.findUnique({
      where: {
        employee_id_entry_date: {
          employee_id: targetEmployeeId,
          entry_date: parsedDate,
        },
      },
    });

    // Count completions done on this date by this employee
    const dayStartUtc = new Date(`${dateStr}T00:00:00+06:00`);
    const dayEndUtc = new Date(`${dateStr}T23:59:59.999+06:00`);

    const postsCount = await prisma.linkCompletion.count({
      where: {
        employee_id: targetEmployeeId,
        completed_at: {
          gte: dayStartUtc,
          lte: dayEndUtc,
        },
        undone_at: null,
      },
    });

    // Also get last 7 days summary for history table
    const sevenDaysAgo = new Date(parsedDate);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const historyEntries = await prisma.dailyEntry.findMany({
      where: {
        employee_id: targetEmployeeId,
        entry_date: {
          gte: sevenDaysAgo,
          lte: parsedDate,
        },
      },
      orderBy: { entry_date: 'desc' },
    });

    const defaultMetrics: Record<string, { value: number; note: string | null }> = {
      SALES_AMOUNT: { value: 0, note: null },
      PROFIT_AMOUNT: { value: 0, note: null },
      CONFIRMED_ORDERS: { value: 0, note: null },
      NEW_LEADS: { value: 0, note: null },
      NEW_CLIENTS: { value: 0, note: null },
      RETENTION_COUNT: { value: 0, note: null },
      AD_SPEND: { value: 0, note: null },
      FOLLOWUPS_DONE: { value: 0, note: null },
      B2B_ORDERS: { value: 0, note: null },
      B2B_INQUIRIES: { value: 0, note: null },
      B2B_INQUIRY_VALUE: { value: 0, note: null },
      POSTS_DONE: { value: postsCount, note: null },
    };

    const metricsMap = entries.reduce<Record<string, { value: number; note: string | null }>>(
      (acc, curr) => {
        acc[curr.metric_type] = {
          value: Number(curr.value),
          note: curr.note,
        };
        return acc;
      },
      defaultMetrics
    );

    return NextResponse.json({
      date: dateStr,
      today: todayDhaka,
      oldest_allowed: oldestAllowedDhaka,
      is_locked: !isAllowed,
      lock_notice: !isAllowed ? L(LOCK_NOTICE) : null,
      can_edit: isAllowed,
      metrics: metricsMap,
      // Live count of task-queue completions for the day; metrics.POSTS_DONE is the saved
      // figure once the employee has adjusted and saved it.
      queue_posts: postsCount,
      product_sales: productSales.map((ps) => ({
        product_id: ps.product_id,
        product_name_bn: ps.product?.name_bn ?? '',
        product_name_en: ps.product?.name_en ?? '',
        unit: ps.product?.unit ?? '',
        selling_price: Number(ps.product?.selling_price ?? 0),
        quantity: Number(ps.quantity),
        amount: Number(ps.amount),
      })),
      daily_text: dailyText || { main_issue: '', next_priorities: '' },
      history: historyEntries,
    });
  } catch (error) {
    console.error('Error fetching daily entry:', error);
    return NextResponse.json({ error: 'Failed to fetch daily entry' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Notices follow the language the user is reading the app in.
    const L = makeTranslator(readLangFromRequest(req));

    const session = await getSession();
    // Admin Prohibition: Admin CANNOT open or submit employee daily entry form. API returns 403 if Admin tries to post.
    if (!session || session.role !== 'EMPLOYEE') {
      return NextResponse.json(
        { error: 'Forbidden. Only employees can submit their own daily performance.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = dailyEntrySubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { entry_date, metrics, daily_text } = parsed.data;
    if (!isValidDateStr(entry_date)) {
      return NextResponse.json({ error: 'সঠিক তারিখ দিন (YYYY-MM-DD) / Invalid date' }, { status: 400 });
    }

    // One row per product: duplicate rows for a product are added together (the store keeps
    // one sale per employee, day and product, so two rows would fail the whole save).
    const productTotals = new Map<string, { product_id: string; quantity: number; amount: number }>();
    for (const ps of parsed.data.product_sales) {
      if (!(ps.quantity > 0 || ps.amount > 0)) continue;
      const prev = productTotals.get(ps.product_id);
      productTotals.set(ps.product_id, {
        product_id: ps.product_id,
        quantity: (prev?.quantity ?? 0) + ps.quantity,
        amount: (prev?.amount ?? 0) + ps.amount,
      });
    }
    const product_sales = [...productTotals.values()];

    // Every product must exist (an inactive one is fine: an older day may still list it).
    if (product_sales.length > 0) {
      const known = await prisma.product.findMany({
        where: { id: { in: product_sales.map((p) => p.product_id) } },
        select: { id: true },
      });
      const knownIds = new Set(known.map((p: { id: string }) => p.id));
      if (product_sales.some((p) => !knownIds.has(p.product_id))) {
        return NextResponse.json({ error: 'অজানা পণ্য / Unknown product' }, { status: 400 });
      }
    }

    // Check edit window (today and yesterday only)
    const settings = await prisma.scoringSettings.findUnique({ where: { id: 'default' } });
    const editWindowDays = settings?.employee_edit_window_days ?? 1;

    const { isAllowed, todayDhaka, oldestAllowedDhaka } = isDateWithinEditWindow(
      entry_date,
      editWindowDays
    );

    if (!isAllowed) {
      return NextResponse.json(
        {
          error: LOCK_NOTICE,
          message: L(`এই তারিখের entry এখন বন্ধ (Locked)। অনুমোদিত সময়সীমা: ${oldestAllowedDhaka} থেকে ${todayDhaka} পর্যন্ত।`),
        },
        { status: 403 }
      );
    }

    const parsedDate = parseDateOnly(entry_date);

    // Fetch old values before saving for AuditLog
    const oldEntries = await prisma.dailyEntry.findMany({
      where: {
        employee_id: session.id,
        entry_date: parsedDate,
      },
    });

    const oldProductSales = await prisma.dailyProductSale.findMany({
      where: {
        employee_id: session.id,
        entry_date: parsedDate,
      },
    });

    const oldDailyText = await prisma.dailyText.findUnique({
      where: {
        employee_id_entry_date: {
          employee_id: session.id,
          entry_date: parsedDate,
        },
      },
    });

    const oldMetrics: Record<string, { value: number; note: string | null }> = {};
    oldEntries.forEach((e) => {
      oldMetrics[e.metric_type] = {
        value: Number(e.value),
        note: e.note,
      };
    });

    const oldValues = {
      metrics: oldMetrics,
      product_sales: oldProductSales.map((ps) => ({
        product_id: ps.product_id,
        quantity: Number(ps.quantity),
        amount: Number(ps.amount),
      })),
      daily_text: oldDailyText
        ? {
            main_issue: oldDailyText.main_issue,
            next_priorities: oldDailyText.next_priorities,
          }
        : null,
    };

    // Notes not sent keep their saved text; sent notes replace it (an empty string clears it).
    const metric_notes: Record<string, string> = parsed.data.metric_notes
      ? parsed.data.metric_notes
      : Object.fromEntries(Object.entries(oldMetrics).map(([k, v]) => [k, v.note ?? '']));

    const mainIssue =
      daily_text.main_issue !== undefined ? daily_text.main_issue || null : oldDailyText?.main_issue ?? null;
    const nextPriorities =
      daily_text.next_priorities !== undefined
        ? daily_text.next_priorities || null
        : oldDailyText?.next_priorities ?? null;

    const newValues = {
      metrics,
      metric_notes,
      product_sales,
      daily_text: { main_issue: mainIssue, next_priorities: nextPriorities },
    };

    // Save/upsert all metrics within a transaction (re-saving updates existing rows)
    await prisma.$transaction(
      async (tx) => {
        // 1. Metric entries (exact 11 metrics in section order)
        const metricEntries = [
          { type: MetricType.SALES_AMOUNT, val: metrics.SALES_AMOUNT },
          { type: MetricType.PROFIT_AMOUNT, val: metrics.PROFIT_AMOUNT },
          { type: MetricType.CONFIRMED_ORDERS, val: metrics.CONFIRMED_ORDERS },
          { type: MetricType.NEW_LEADS, val: metrics.NEW_LEADS },
          { type: MetricType.NEW_CLIENTS, val: metrics.NEW_CLIENTS },
          { type: MetricType.RETENTION_COUNT, val: metrics.RETENTION_COUNT },
          { type: MetricType.AD_SPEND, val: metrics.AD_SPEND },
          { type: MetricType.FOLLOWUPS_DONE, val: metrics.FOLLOWUPS_DONE },
          { type: MetricType.B2B_ORDERS, val: metrics.B2B_ORDERS },
          { type: MetricType.B2B_INQUIRIES, val: metrics.B2B_INQUIRIES },
          { type: MetricType.B2B_INQUIRY_VALUE, val: metrics.B2B_INQUIRY_VALUE },
          ...(metrics.POSTS_DONE !== undefined
            ? [{ type: MetricType.POSTS_DONE, val: metrics.POSTS_DONE }]
            : []),
        ];

        await Promise.all(
          metricEntries.map((m) =>
            tx.dailyEntry.upsert({
              where: {
                employee_id_entry_date_metric_type: {
                  employee_id: session.id,
                  entry_date: parsedDate,
                  metric_type: m.type,
                },
              },
              update: {
                value: m.val,
                note: metric_notes[m.type] || null,
              },
              create: {
                employee_id: session.id,
                entry_date: parsedDate,
                metric_type: m.type,
                value: m.val,
                note: metric_notes[m.type] || null,
              },
            })
          )
        );

        // 2. Product breakdown (re-saving updates rows)
        await tx.dailyProductSale.deleteMany({
          where: {
            employee_id: session.id,
            entry_date: parsedDate,
          },
        });

        const validProducts = product_sales;
        if (validProducts.length > 0) {
          await Promise.all(
            validProducts.map((ps) =>
              tx.dailyProductSale.create({
                data: {
                  employee_id: session.id,
                  entry_date: parsedDate,
                  product_id: ps.product_id,
                  quantity: ps.quantity,
                  amount: ps.amount,
                },
              })
            )
          );
        }

        // 3. Daily Text
        await tx.dailyText.upsert({
          where: {
            employee_id_entry_date: {
              employee_id: session.id,
              entry_date: parsedDate,
            },
          },
          update: {
            main_issue: mainIssue,
            next_priorities: nextPriorities,
          },
          create: {
            employee_id: session.id,
            entry_date: parsedDate,
            main_issue: mainIssue,
            next_priorities: nextPriorities,
          },
        });
      },
      {
        maxWait: 10000,
        timeout: 20000,
      }
    );

    // Write AuditLog with action ENTRY_SAVE with old and new values
    await createAuditLog({
      actorId: session.id,
      action: 'ENTRY_SAVE',
      entity: 'DailyEntry',
      entityId: session.id,
      payload: {
        entry_date,
        old_values: oldValues,
        new_values: newValues,
        old: oldValues,
        new: newValues,
        metrics,
        products_count: product_sales.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: L(SAVE_SUCCESS_MESSAGE),
    });
  } catch (error) {
    console.error('Error saving daily entry:', error);
    return NextResponse.json({ error: 'Failed to save daily entry' }, { status: 500 });
  }
}
