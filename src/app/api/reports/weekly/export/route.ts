import { NextRequest, NextResponse } from 'next/server';
import { makeTranslator } from '@/lib/i18n/translate';
import { readLangFromRequest } from '@/lib/i18n/request-lang';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { parseDateOnly } from '@/lib/date';
import { WeeklyAutoData, computeWeeklyAutoData, WEEKLY_FIXED_QUESTIONS } from '@/lib/reports';
import { calculateEffectiveTargetsForRange } from '@/lib/targets';
import { createAuditLog } from '@/lib/audit';
import { AuditAction } from '@prisma/client';
import { startOfWeek, endOfWeek, format } from 'date-fns';
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
    const id = searchParams.get('id');
    const weekStartParam = searchParams.get('weekStart') || searchParams.get('week_start');

    let report = null;
    let targetWeekStart: Date;
    let targetWeekEnd: Date;

    if (id) {
      report = await prisma.weeklyReport.findUnique({
        where: { id },
        include: { answers: { orderBy: { question_no: 'asc' } } },
      });
      if (report) {
        targetWeekStart = report.week_start;
        targetWeekEnd = report.week_end;
      } else {
        return NextResponse.json({ error: 'Weekly report not found' }, { status: 404 });
      }
    } else if (weekStartParam) {
      targetWeekStart = parseDateOnly(weekStartParam);
      targetWeekEnd = endOfWeek(targetWeekStart, { weekStartsOn: 0 });
      report = await prisma.weeklyReport.findUnique({
        where: { week_start: targetWeekStart },
        include: { answers: { orderBy: { question_no: 'asc' } } },
      });
    } else {
      // Find latest report or compute for current week
      report = await prisma.weeklyReport.findFirst({
        orderBy: { week_start: 'desc' },
        include: { answers: { orderBy: { question_no: 'asc' } } },
      });
      if (report) {
        targetWeekStart = report.week_start;
        targetWeekEnd = report.week_end;
      } else {
        const now = new Date();
        targetWeekStart = startOfWeek(now, { weekStartsOn: 0 });
        targetWeekEnd = endOfWeek(now, { weekStartsOn: 0 });
      }
    }

    const weekStartStr = format(targetWeekStart, 'yyyy-MM-dd');
    const weekEndStr = format(targetWeekEnd, 'yyyy-MM-dd');

    // 1. Auto Data
    let autoData: WeeklyAutoData;
    if (report && report.auto_data) {
      autoData = report.auto_data as unknown as WeeklyAutoData;
    } else {
      autoData = await computeWeeklyAutoData(targetWeekStart, targetWeekEnd);
    }

    // 2. Unfinished Orders (Leads with status NEW, CONTACTED, QUALIFIED)
    const unfinishedLeads = await prisma.lead.findMany({
      where: {
        status: { in: ['NEW', 'CONTACTED', 'QUALIFIED'] },
      },
      include: {
        owner: { select: { name: true } },
        product: { select: { name_bn: true, name_en: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    // 3. Target vs Actual for the week
    const allTargets = await prisma.sectionTarget.findMany();
    const effectiveTargets = calculateEffectiveTargetsForRange(allTargets, targetWeekStart, targetWeekEnd);

    const postsTarget = effectiveTargets.POSTS_DONE || 0;
    const postsActual = autoData.summary.total_posts;
    const postsPct = postsTarget > 0 ? Number(((postsActual / postsTarget) * 100).toFixed(1)) : 100;

    const salesTarget = effectiveTargets.SALES_AMOUNT || 0;
    const salesActual = autoData.summary.total_sales;
    const salesPct = salesTarget > 0 ? Number(((salesActual / salesTarget) * 100).toFixed(1)) : 100;

    const profitTarget = effectiveTargets.PROFIT_AMOUNT || 0;
    const profitActual = autoData.summary.total_profit;
    const profitPct = profitTarget > 0 ? Number(((profitActual / profitTarget) * 100).toFixed(1)) : 100;

    const newClientsTarget = effectiveTargets.NEW_CLIENTS || 0;
    const newClientsActual = autoData.summary.total_new_clients;
    const newClientsPct = newClientsTarget > 0 ? Number(((newClientsActual / newClientsTarget) * 100).toFixed(1)) : 100;

    // 4. Answers Map
    const answersMap = new Map<number, string>();
    const questionTextMap = new Map<number, string>();
    if (report?.answers) {
      for (const a of report.answers) {
        answersMap.set(a.question_no, a.answer_text);
        if (a.question_text) {
          questionTextMap.set(a.question_no, a.question_text);
        }
      }
    }

    const questionRows = WEEKLY_FIXED_QUESTIONS.map((q) => ({
      no: q.no,
      question: questionTextMap.get(q.no) || q.text,
      answer: answersMap.get(q.no) || L('(কোনো উত্তর দেওয়া হয়নি)'),
    }));

    // Record audit log
    await createAuditLog({
      actorId: session.id,
      action: AuditAction.EXPORT,
      entity: 'WeeklyReport',
      entityId: report?.id || weekStartStr,
      payload: {
        weekStart: weekStartStr,
        format: formatType,
      },
    });

    // 1. EXCEL EXPORT
    if (formatType === 'excel') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Marketing Management System';
      workbook.created = new Date();

      // Sheet 1: Summary & Target vs Actual & 5 Questions
      const sheet1 = workbook.addWorksheet('Weekly Evaluation');
      sheet1.mergeCells('A1:E1');
      sheet1.getCell('A1').value = L(`সাপ্তাহিক মূল্যায়ন প্রতিবেদন (${weekStartStr} হতে ${weekEndStr})`);
      sheet1.getCell('A1').font = { size: 15, bold: true, color: { argb: 'FF0F172A' } };
      sheet1.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
      sheet1.addRow([]);

      // Section: Weekly Totals
      const totHeader = sheet1.addRow([L('মেট্রিক'), L('সাপ্তাহিক সর্বমোট ফলাফল')]);
      totHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      totHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };

      sheet1.addRow([L('মোট বিক্রয় (৳)'), autoData.summary.total_sales]);
      sheet1.addRow([L('মোট মুনাফা (৳)'), autoData.summary.total_profit]);
      sheet1.addRow([L('সম্পন্ন পোস্ট'), autoData.summary.total_posts]);
      sheet1.addRow([L('নতুন ক্রেতা'), autoData.summary.total_new_clients]);
      sheet1.addRow([L('B2B অর্ডার'), autoData.summary.total_b2b_orders]);
      sheet1.addRow([L('রিটেনশন'), autoData.summary.total_retention]);
      sheet1.addRow([L('ফলোআপ সম্পন্ন'), autoData.summary.total_followups]);
      sheet1.addRow([L('গড় টিম স্কোর'), `${autoData.summary.team_avg_score}%`]);
      sheet1.addRow([]);

      // Section: Target vs Actual
      const tvaHeader = sheet1.addRow([L('মেট্রিক'), L('সাপ্তাহিক লক্ষ্যমাত্রা (Target)'), L('প্রকৃত অর্জিত (Actual)'), L('অর্জন হার (%)')]);
      tvaHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      tvaHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };

      sheet1.addRow([L('গ্রুপ পোস্ট (Posts)'), postsTarget, postsActual, `${postsPct}%`]);
      sheet1.addRow([L('বিক্রয় (Sales ৳)'), salesTarget, salesActual, `${salesPct}%`]);
      sheet1.addRow([L('মুনাফা (Profit ৳)'), profitTarget, profitActual, `${profitPct}%`]);
      sheet1.addRow([L('নতুন ক্রেতা (New Clients)'), newClientsTarget, newClientsActual, `${newClientsPct}%`]);
      sheet1.addRow([]);

      // Section: 5 Strategic Questions & Answers
      const qHeader = sheet1.addRow(['#', L('কৌশলগত ও মূল্যায়নমূলক প্রশ্ন (৫টি প্রশ্ন)'), L('উত্তর')]);
      qHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      qHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };

      for (const q of questionRows) {
        sheet1.addRow([q.no, q.question, q.answer]);
      }
      sheet1.getColumn(1).width = 8;
      sheet1.getColumn(2).width = 46;
      sheet1.getColumn(3).width = 60;
      sheet1.getColumn(4).width = 20;

      // Sheet 2: Top Products by Sales
      const sheet2 = workbook.addWorksheet('Top Products');
      sheet2.addRow([L('পণ্যের নাম (বাংলা)'), L('ইংরেজি নাম'), L('একক'), L('বিক্রিত পরিমাণ'), L('মোট বিক্রয় (৳)')]);
      sheet2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };

      for (const p of autoData.top_products || []) {
        sheet2.addRow([p.product_name_bn, p.product_name_en, p.unit, p.total_quantity, p.total_amount]);
      }
      sheet2.columns.forEach((c) => (c.width = 22));

      // Sheet 3: Source Quality (Channels)
      const sheet3 = workbook.addWorksheet('Source Quality');
      sheet3.addRow([L('সোর্স চ্যানেল'), L('মোট লিড সংখ্যা'), L('অর্ডার সংখ্যা'), L('মোট বিক্রয় (৳)'), L('কনভার্সন হার (%)')]);
      sheet3.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet3.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } };

      for (const ch of autoData.channel_breakdown || []) {
        const convRate = ch.leads_count > 0 ? Number(((ch.orders_count / ch.leads_count) * 100).toFixed(1)) : 0;
        sheet3.addRow([ch.channel_bn, ch.leads_count, ch.orders_count, ch.total_amount, `${convRate}%`]);
      }
      sheet3.columns.forEach((c) => (c.width = 24));

      // Sheet 4: Unfinished Orders
      const sheet4 = workbook.addWorksheet('Unfinished Orders');
      sheet4.addRow([
        L('ক্রেতার নাম'),
        L('মোবাইল নম্বর'),
        L('চ্যানেল'),
        L('দায়িত্বপ্রাপ্ত মার্কেটার'),
        L('স্ট্যাটাস'),
        L('সম্ভাব্য মূল্য (৳)'),
        L('তৈরির তারিখ'),
      ]);
      sheet4.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet4.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } };

      if (unfinishedLeads.length === 0) {
        sheet4.addRow([L('(কোনো অসম্পূর্ণ বা বকেয়া অর্ডার নেই)'), '-', '-', '-', '-', 0, '-']);
      } else {
        for (const ul of unfinishedLeads) {
          sheet4.addRow([
            ul.name,
            ul.phone,
            ul.source_channel,
            ul.owner?.name || L('অ্যাসাইন হয়নি'),
            ul.status,
            ul.expected_value ? Number(ul.expected_value) : 0,
            ul.created_at.toISOString().slice(0, 10),
          ]);
        }
      }
      sheet4.columns.forEach((c) => (c.width = 22));

      const buffer = await workbook.xlsx.writeBuffer();

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="weekly-report-${weekStartStr}.xlsx"`,
        },
      });
    }

    // 2. PDF EXPORT
    if (formatType === 'pdf') {
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));

      // Header
      doc.fontSize(16).text(L('Weekly Evaluation Report / সাপ্তাহিক মূল্যায়ন প্রতিবেদন'), { align: 'center' });
      doc.fontSize(10).text(`Period: ${weekStartStr} to ${weekEndStr} (Dhaka Time)`, { align: 'center' });
      doc.fontSize(9).text(`Status: ${report?.status || 'DRAFT'}`, { align: 'center' });
      doc.moveDown(1);

      // Section 1: Weekly Totals
      doc.fontSize(12).text(L('1. Weekly Totals / সাপ্তাহিক মোট ফলাফল:'), { underline: true });
      doc.fontSize(9);
      doc.moveDown(0.4);
      doc.text(`• Total Sales: Tk. ${autoData.summary.total_sales.toLocaleString()}  |  Total Profit: Tk. ${autoData.summary.total_profit.toLocaleString()}`);
      doc.text(`• Total Posts: ${autoData.summary.total_posts}  |  Team Avg Score: ${autoData.summary.team_avg_score}%`);
      doc.text(`• New Clients: ${autoData.summary.total_new_clients}  |  B2B Orders: ${autoData.summary.total_b2b_orders}  |  Followups: ${autoData.summary.total_followups}`);
      doc.moveDown(1);

      // Section 2: Target vs Actual
      doc.fontSize(12).text(L('2. Target vs Actual / টার্গেট বনাম অর্জন:'), { underline: true });
      doc.fontSize(9);
      doc.moveDown(0.4);
      doc.text(`• Posts Target: ${postsTarget} vs Actual: ${postsActual} (${postsPct}%)`);
      doc.text(`• Sales Target: Tk. ${salesTarget.toLocaleString()} vs Actual: Tk. ${salesActual.toLocaleString()} (${salesPct}%)`);
      doc.text(`• Profit Target: Tk. ${profitTarget.toLocaleString()} vs Actual: Tk. ${profitActual.toLocaleString()} (${profitPct}%)`);
      doc.text(`• New Clients Target: ${newClientsTarget} vs Actual: ${newClientsActual} (${newClientsPct}%)`);
      doc.moveDown(1);

      // Section 3: 5 Question Answers
      doc.fontSize(12).text('3. Strategic Evaluation Questions (5 Fixed Questions):', { underline: true });
      doc.moveDown(0.4);
      doc.fontSize(9);

      for (const q of questionRows) {
        doc.font('Helvetica-Bold').text(`Q${q.no}: ${q.question}`);
        doc.font('Helvetica').text(`Answer: ${q.answer}`);
        doc.moveDown(0.4);
      }
      doc.moveDown(0.6);

      // Section 4: Top Products by Sales
      doc.fontSize(12).text(L('4. Top Products by Sales / শীর্ষ বিক্রিত পণ্য:'), { underline: true });
      doc.moveDown(0.4);
      doc.fontSize(9);

      for (const p of autoData.top_products || []) {
        doc.text(`• ${p.product_name_en} (${p.product_name_bn}): ${p.total_quantity} ${p.unit} - Total: Tk. ${p.total_amount.toLocaleString()}`);
      }
      doc.moveDown(1);

      // Section 5: Source Quality & Channels
      doc.fontSize(12).text('5. Source Quality & Channel Performance:', { underline: true });
      doc.moveDown(0.4);
      doc.fontSize(9);

      for (const ch of autoData.channel_breakdown || []) {
        const conv = ch.leads_count > 0 ? Number(((ch.orders_count / ch.leads_count) * 100).toFixed(1)) : 0;
        doc.text(`• ${ch.channel_bn}: ${ch.leads_count} Leads, ${ch.orders_count} Orders, Sales: Tk. ${ch.total_amount.toLocaleString()} (Conv: ${conv}%)`);
      }
      doc.moveDown(1);

      // Section 6: Unfinished Orders
      doc.fontSize(12).text(L('6. Unfinished Orders / অপেক্ষমাণ ও অসম্পূর্ণ অর্ডার:'), { underline: true });
      doc.moveDown(0.4);
      doc.fontSize(9);

      if (unfinishedLeads.length === 0) {
        doc.text('No unfinished or pending orders at this time.');
      } else {
        for (const ul of unfinishedLeads.slice(0, 10)) {
          doc.text(`• ${ul.name} (${ul.phone}) | Status: ${ul.status} | Marketer: ${ul.owner?.name || 'Unassigned'} | Expected: Tk. ${ul.expected_value ? Number(ul.expected_value).toLocaleString() : '0'}`);
        }
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
          'Content-Disposition': `attachment; filename="weekly-report-${weekStartStr}.pdf"`,
        },
      });
    }

    return NextResponse.json({ error: 'Unsupported format. Use excel or pdf.' }, { status: 400 });
  } catch (error) {
    console.error('Error exporting weekly report:', error);
    return NextResponse.json({ error: 'Failed to export weekly report' }, { status: 500 });
  }
}
