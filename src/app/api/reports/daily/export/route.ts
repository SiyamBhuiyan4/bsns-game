import { NextRequest, NextResponse } from 'next/server';
import { makeTranslator } from '@/lib/i18n/translate';
import { readLangFromRequest } from '@/lib/i18n/request-lang';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { getDhakaDateString, parseDateOnly } from '@/lib/date';
import { calculateEffectiveTargetsForRange } from '@/lib/targets';
import { calculateEmployeeScore } from '@/lib/scoring';
import { createAuditLog } from '@/lib/audit';
import { AuditAction, MetricType } from '@prisma/client';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export async function GET(req: NextRequest) {
  try {
    // The document follows the language the admin is reading the app in.
    const L = makeTranslator(readLangFromRequest(req));

    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const formatType = (searchParams.get('type') || searchParams.get('format') || 'excel').toLowerCase();
    const dateStr = searchParams.get('date') || getDhakaDateString();
    const targetDate = parseDateOnly(dateStr);

    const dayStartUtc = new Date(`${dateStr}T00:00:00+06:00`);
    const dayEndUtc = new Date(`${dateStr}T23:59:59.999+06:00`);

    // 1. Fetch active employees
    const employees = await prisma.user.findMany({
      where: { role: 'EMPLOYEE', is_active: true },
      include: {
        assignments_as_employee: { include: { section: true } },
      },
      orderBy: { name: 'asc' },
    });

    const allTargets = await prisma.sectionTarget.findMany();
    const settings = await prisma.scoringSettings.findUnique({ where: { id: 'default' } });
    const cap = settings ? Number(settings.achievement_cap) : 1.0;
    const failingThreshold = settings ? Number(settings.failing_threshold) : 0.8;

    // 2. Fetch daily entries for this date
    const allEntries = await prisma.dailyEntry.findMany({
      where: { entry_date: targetDate },
    });

    // 3. Fetch product sales for this date
    const productSales = await prisma.dailyProductSale.findMany({
      where: { entry_date: targetDate },
      include: { product: true, employee: true },
    });

    // 4. Fetch reflections for this date
    const dailyTexts = await prisma.dailyText.findMany({
      where: { entry_date: targetDate },
      include: { employee: true },
    });

    // 5. Fetch link completions (POSTS_DONE) for this date
    const linkCompletions = await prisma.linkCompletion.findMany({
      where: {
        completed_at: { gte: dayStartUtc, lte: dayEndUtc },
        undone_at: null,
      },
    });

    // 6. Fetch Leads created or ordered on this date
    const leadsCreated = await prisma.lead.findMany({
      where: { created_at: { gte: dayStartUtc, lte: dayEndUtc } },
    });
    const ordersCreated = await prisma.lead.findMany({
      where: { status: 'ORDERED', updated_at: { gte: dayStartUtc, lte: dayEndUtc } },
    });

    // Aggregate Employee Breakdown
    interface EmployeeExportRow {
      name: string;
      sections: string;
      newLeads: number;
      confirmedOrders: number;
      sales: number;
      adSpend: number;
      followups: number;
      b2bInquiries: number;
      posts: number;
      score: number;
      status: string;
      mainIssue: string;
      nextPriorities: string;
    }

    const employeeRows: EmployeeExportRow[] = [];
    let totalScoreSum = 0;

    for (const emp of employees) {
      const assignedSectionIds = emp.assignments_as_employee.map((a: any) => a.section_id);
      const sectionNames = emp.assignments_as_employee.map((a: any) => a.section.name).join(', ');

      const empTargets = allTargets.filter((t) => assignedSectionIds.includes(t.section_id));
      const dailyTargets = calculateEffectiveTargetsForRange(empTargets, targetDate, targetDate);

      const empPostsCount = linkCompletions.filter((lc) => lc.employee_id === emp.id).length;
      const empEntries = allEntries.filter((e) => e.employee_id === emp.id);

      const metricMap: Record<string, number> = {
        POSTS_DONE: empPostsCount,
        SALES_AMOUNT: 0,
        PROFIT_AMOUNT: 0,
        NEW_CLIENTS: 0,
        B2B_ORDERS: 0,
        RETENTION_COUNT: 0,
        FOLLOWUPS_DONE: 0,
        CONFIRMED_ORDERS: 0,
        NEW_LEADS: 0,
        AD_SPEND: 0,
        B2B_INQUIRIES: 0,
      };

      for (const e of empEntries) {
        metricMap[e.metric_type] = Number(e.value);
      }

      const empLeadsCount = leadsCreated.filter((l) => l.owner_id === emp.id).length;
      const empOrdersCount = ordersCreated.filter((l) => l.owner_id === emp.id).length;

      const newLeadsVal = metricMap.NEW_LEADS || metricMap.NEW_CLIENTS || empLeadsCount;
      const confirmedOrdersVal = metricMap.CONFIRMED_ORDERS || empOrdersCount;
      const b2bInquiriesVal = metricMap.B2B_INQUIRIES || metricMap.B2B_ORDERS || 0;

      const scoringInput = {
        [MetricType.POSTS_DONE]: { target: dailyTargets.POSTS_DONE || null, achieved: metricMap.POSTS_DONE },
        [MetricType.SALES_AMOUNT]: { target: dailyTargets.SALES_AMOUNT || null, achieved: metricMap.SALES_AMOUNT },
        [MetricType.PROFIT_AMOUNT]: { target: dailyTargets.PROFIT_AMOUNT || null, achieved: metricMap.PROFIT_AMOUNT },
        [MetricType.NEW_CLIENTS]: { target: dailyTargets.NEW_CLIENTS || null, achieved: metricMap.NEW_CLIENTS },
        [MetricType.B2B_ORDERS]: { target: dailyTargets.B2B_ORDERS || null, achieved: metricMap.B2B_ORDERS },
        [MetricType.RETENTION_COUNT]: { target: dailyTargets.RETENTION_COUNT || null, achieved: metricMap.RETENTION_COUNT },
        [MetricType.FOLLOWUPS_DONE]: { target: dailyTargets.FOLLOWUPS_DONE || null, achieved: metricMap.FOLLOWUPS_DONE },
      };

      const scoreResult = calculateEmployeeScore(scoringInput, {
        achievementCap: cap,
        failingThreshold,
      });

      totalScoreSum += scoreResult.totalScore;

      const empText = dailyTexts.find((t) => t.employee_id === emp.id);

      employeeRows.push({
        name: emp.name,
        sections: sectionNames || L('কোনো সেকশন নেই'),
        newLeads: newLeadsVal,
        confirmedOrders: confirmedOrdersVal,
        sales: metricMap.SALES_AMOUNT,
        adSpend: metricMap.AD_SPEND,
        followups: metricMap.FOLLOWUPS_DONE,
        b2bInquiries: b2bInquiriesVal,
        posts: metricMap.POSTS_DONE,
        score: scoreResult.totalScore,
        status: scoreResult.isFailing ? L('উন্নতি প্রয়োজন (<৮০%)') : L('পাস (≥৮০%)'),
        mainIssue: empText?.main_issue || '-',
        nextPriorities: empText?.next_priorities || '-',
      });
    }

    // Required aggregate rows in Bengali order:
    // 1. নতুন লিড, 2. নিশ্চিত অর্ডার, 3. মোট বিক্রি, 4. বিজ্ঞাপনের খরচ, 5. ফলোআপ সম্পন্ন,
    // 6. বড় B2B অনুসন্ধান, 7. প্রধান সমস্যা, 8. আগামী দিনের অগ্রাধিকার
    // Plus: POSTS_DONE count, product breakdown table.
    const sumEntry = (metric: MetricType) =>
      allEntries.filter((e) => e.metric_type === metric).reduce((s, e) => s + Number(e.value), 0);

    const totalNewLeads = sumEntry(MetricType.NEW_LEADS) || sumEntry(MetricType.NEW_CLIENTS) || leadsCreated.length;
    const totalConfirmedOrders = sumEntry(MetricType.CONFIRMED_ORDERS) || ordersCreated.length;
    const totalSales = sumEntry(MetricType.SALES_AMOUNT) || productSales.reduce((s, p) => s + Number(p.amount), 0);
    const totalAdSpend = sumEntry(MetricType.AD_SPEND);
    const totalFollowups = sumEntry(MetricType.FOLLOWUPS_DONE);
    const totalB2bInquiries = sumEntry(MetricType.B2B_INQUIRIES) || sumEntry(MetricType.B2B_ORDERS);

    const mainIssuesList = dailyTexts
      .map((t) => t.main_issue?.trim())
      .filter((text): text is string => !!text && text.length > 0);
    const mainIssuesText = mainIssuesList.length > 0 ? mainIssuesList.join(' | ') : L('কোনো প্রধান সমস্যা বা বাধা নেই');

    const nextPrioritiesList = dailyTexts
      .map((t) => t.next_priorities?.trim())
      .filter((text): text is string => !!text && text.length > 0);
    const nextPrioritiesText = nextPrioritiesList.length > 0 ? nextPrioritiesList.join(' | ') : L('কোনো বিশেষ অগ্রাধিকার উল্লেখ নেই');

    const postsDoneCount = linkCompletions.length;

    // Product breakdown
    const productMap = new Map<string, {
      name_bn: string;
      name_en: string;
      unit: string;
      quantity: number;
      amount: number;
    }>();

    for (const ps of productSales) {
      const existing = productMap.get(ps.product_id) || {
        name_bn: ps.product.name_bn,
        name_en: ps.product.name_en,
        unit: ps.product.unit,
        quantity: 0,
        amount: 0,
      };
      existing.quantity += Number(ps.quantity);
      existing.amount += Number(ps.amount);
      productMap.set(ps.product_id, existing);
    }
    const productRows = Array.from(productMap.values()).sort((a, b) => b.amount - a.amount);
    const teamAvgScore = employees.length > 0 ? Number((totalScoreSum / employees.length).toFixed(2)) : 0;

    // Record audit log for export action
    await createAuditLog({
      actorId: session.id,
      action: AuditAction.EXPORT,
      entity: 'DailyReport',
      entityId: dateStr,
      payload: {
        date: dateStr,
        format: formatType,
      },
    });

    // 1. EXCEL EXPORT
    if (formatType === 'excel') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Marketing Management System';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Daily Report');

      // Title
      worksheet.mergeCells('A1:D1');
      worksheet.getCell('A1').value = L(`দৈনিক পারফরম্যান্স রিপোর্ট - ${dateStr}`);
      worksheet.getCell('A1').font = { size: 15, bold: true, color: { argb: 'FF0F172A' } };
      worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.addRow([]);

      // Section Header: Required Bengali Order
      const secHeaderRow = worksheet.addRow([L('দৈনিক মূল মেট্রিক'), L('মান / বিবরণ')]);
      secHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      secHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };

      worksheet.addRow([L('নতুন লিড'), totalNewLeads]);
      worksheet.addRow([L('নিশ্চিত অর্ডার'), totalConfirmedOrders]);
      worksheet.addRow([L('মোট বিক্রি'), L(`৳ ${totalSales.toLocaleString()}`)]);
      worksheet.addRow([L('বিজ্ঞাপনের খরচ'), L(`৳ ${totalAdSpend.toLocaleString()}`)]);
      worksheet.addRow([L('ফলোআপ সম্পন্ন'), totalFollowups]);
      worksheet.addRow([L('বড় B2B অনুসন্ধান'), totalB2bInquiries]);
      worksheet.addRow([L('প্রধান সমস্যা'), mainIssuesText]);
      worksheet.addRow([L('আগামী দিনের অগ্রাধিকার'), nextPrioritiesText]);
      worksheet.addRow(['POSTS_DONE count', postsDoneCount]);
      worksheet.addRow([L('টিম গড় স্কোর'), `${teamAvgScore}%`]);
      worksheet.addRow([]);

      // Product Breakdown Table
      const prodHeaderRow = worksheet.addRow([
        L('পণ্য বিক্রয়ের বিবরণ (Product Breakdown)'),
        L('ইংরেজি নাম'),
        L('একক'),
        L('পরিমাণ'),
        L('মোট বিক্রয় (৳)'),
      ]);
      prodHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      prodHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };

      if (productRows.length === 0) {
        worksheet.addRow([L('(আজ কোনো পণ্য বিক্রয় রেকর্ড করা হয়নি)'), '-', '-', 0, 0]);
      } else {
        for (const p of productRows) {
          worksheet.addRow([p.name_bn, p.name_en, p.unit, p.quantity, p.amount]);
        }
      }
      worksheet.addRow([]);

      // Employee Breakdown Table
      const empHeaderRow = worksheet.addRow([
        L('মার্কেটার নাম'),
        L('সেকশন'),
        L('নতুন লিড'),
        L('নিশ্চিত অর্ডার'),
        L('মোট বিক্রি (৳)'),
        L('বিজ্ঞাপনের খরচ (৳)'),
        L('ফলোআপ সম্পন্ন'),
        L('বড় B2B অনুসন্ধান'),
        L('পোস্ট সংখ্যা'),
        L('স্কোর (%)'),
        L('স্ট্যাটাস'),
        L('প্রধান সমস্যা'),
        L('আগামী দিনের অগ্রাধিকার'),
      ]);
      empHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      empHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };

      for (const r of employeeRows) {
        worksheet.addRow([
          r.name,
          r.sections,
          r.newLeads,
          r.confirmedOrders,
          r.sales,
          r.adSpend,
          r.followups,
          r.b2bInquiries,
          r.posts,
          r.score,
          r.status,
          r.mainIssue,
          r.nextPriorities,
        ]);
      }

      worksheet.columns.forEach((col) => {
        col.width = 22;
      });
      worksheet.getColumn(1).width = 26;
      worksheet.getColumn(2).width = 26;

      const buffer = await workbook.xlsx.writeBuffer();

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="daily-report-${dateStr}.xlsx"`,
        },
      });
    }

    // 2. PDF EXPORT
    if (formatType === 'pdf') {
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));

      // Header
      doc.fontSize(16).text(L('Daily Performance Report / দৈনিক পারফরম্যান্স রিপোর্ট'), { align: 'center' });
      doc.fontSize(10).text(`Date: ${dateStr} (Dhaka Time)`, { align: 'center' });
      doc.moveDown(1);

      // Section 1: Required Bengali Order
      doc.fontSize(12).text(L('1. Daily Key Metrics / দৈনিক মূল মেট্রিক (Required Order):'), { underline: true });
      doc.fontSize(10);
      doc.moveDown(0.4);

      doc.text(L(`• নতুন লিড (New Leads): ${totalNewLeads}`));
      doc.text(L(`• নিশ্চিত অর্ডার (Confirmed Orders): ${totalConfirmedOrders}`));
      doc.text(L(`• মোট বিক্রি (Total Sales): Tk. ${totalSales.toLocaleString()}`));
      doc.text(L(`• বিজ্ঞাপনের খরচ (Ad Spend): Tk. ${totalAdSpend.toLocaleString()}`));
      doc.text(L(`• ফলোআপ সম্পন্ন (Followups Completed): ${totalFollowups}`));
      doc.text(L(`• বড় B2B অনুসন্ধান (Major B2B Inquiries): ${totalB2bInquiries}`));
      doc.text(L(`• প্রধান সমস্যা (Main Issue): ${mainIssuesText}`));
      doc.text(L(`• আগামী দিনের অগ্রাধিকার (Next Day Priorities): ${nextPrioritiesText}`));
      doc.text(L(`• POSTS_DONE count (সম্পন্ন পোস্ট): ${postsDoneCount}`));
      doc.text(`• Team Average Score: ${teamAvgScore}%`);
      doc.moveDown(1);

      // Section 2: Product Breakdown Table
      doc.fontSize(12).text(L('2. Product Breakdown Table / পণ্য বিক্রয়ের বিবরণ:'), { underline: true });
      doc.moveDown(0.4);
      doc.fontSize(9);

      if (productRows.length === 0) {
        doc.text('No product sales recorded for this date.');
      } else {
        for (const p of productRows) {
          doc.text(`• ${p.name_en} (${p.name_bn}): ${p.quantity} ${p.unit} - Total: Tk. ${p.amount.toLocaleString()}`);
        }
      }
      doc.moveDown(1);

      // Section 3: Employee Breakdown
      doc.fontSize(12).text('3. Marketer Performance Breakdown:', { underline: true });
      doc.moveDown(0.4);
      doc.fontSize(9);

      for (const r of employeeRows) {
        doc.text(
          `• ${r.name} (${r.sections}) | Score: ${r.score}% [${r.status}] | Sales: Tk. ${r.sales.toLocaleString()} | Posts: ${r.posts} | Leads: ${r.newLeads} | Followups: ${r.followups}`
        );
        if (r.mainIssue !== '-' || r.nextPriorities !== '-') {
          doc.text(`    Issue: ${r.mainIssue} | Priorities: ${r.nextPriorities}`);
        }
        doc.moveDown(0.2);
      }

      doc.end();

      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
      });

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="daily-report-${dateStr}.pdf"`,
        },
      });
    }

    return NextResponse.json({ error: 'Unsupported format. Use excel or pdf.' }, { status: 400 });
  } catch (error) {
    console.error('Error exporting daily report:', error);
    return NextResponse.json({ error: 'Failed to export daily report' }, { status: 500 });
  }
}
