import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { MonthlyAutoData, computeMonthlyAutoData } from '@/lib/reports';
import { createAuditLog } from '@/lib/audit';
import { AuditAction } from '@prisma/client';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const formatType = (searchParams.get('type') || searchParams.get('format') || 'excel').toLowerCase();
    const month = searchParams.get('month');

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'Valid month (YYYY-MM) is required' }, { status: 400 });
    }

    const report = await prisma.monthlyReport.findUnique({
      where: { month },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    let autoData: MonthlyAutoData;
    if (!report) {
      autoData = await computeMonthlyAutoData(month);
    } else {
      autoData = report.auto_data as unknown as MonthlyAutoData;
    }

    const reportStatus = report?.status || 'DRAFT';
    const finalizedStr = report?.finalized_at ? report.finalized_at.toISOString().slice(0, 10) : 'N/A';

    // Record audit log for export action
    await createAuditLog({
      actorId: session.id,
      action: AuditAction.EXPORT,
      entity: 'MonthlyReport',
      entityId: month,
      payload: {
        reportId: report?.id,
        month,
        format: formatType,
      },
    });

    // 1. EXCEL EXPORT
    if (formatType === 'excel') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Marketing Management System';
      workbook.created = new Date();

      // Sheet 1: Executive Summary (Sections 1, 3, 7, 8)
      const sheet1 = workbook.addWorksheet('Executive Summary');
      sheet1.mergeCells('A1:E1');
      sheet1.getCell('A1').value = `মাসিক মূল্যায়ন ও অগ্রগতি প্রতিবেদন (মাস: ${month})`;
      sheet1.getCell('A1').font = { size: 15, bold: true, color: { argb: 'FF0F172A' } };
      sheet1.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };

      sheet1.addRow([]);
      sheet1.addRow(['স্ট্যাটাস', reportStatus, 'চূড়ান্ত অনুমোদনের তারিখ', finalizedStr]);
      sheet1.addRow([]);

      // Section 1: MoM Growth Table
      sheet1.addRow(['সেকশন ১: মাসভিত্তিক প্রবৃদ্ধি (Month-over-Month Growth)']);
      sheet1.getRow(5).font = { bold: true };
      sheet1.addRow(['মেট্রিক', 'চলতি মাস', 'পূর্ববর্তী মাস', 'পার্থক্য (Diff)', 'প্রবৃদ্ধি (Growth %)']);
      const momHeader = sheet1.getRow(6);
      momHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      momHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };

      sheet1.addRow([
        'বিক্রয় (Sales ৳)',
        autoData.mom_growth.current.sales,
        autoData.mom_growth.previous.sales,
        autoData.mom_growth.diff.sales,
        `${autoData.mom_growth.growth_pct.sales}%`,
      ]);
      sheet1.addRow([
        'মুনাফা (Profit ৳)',
        autoData.mom_growth.current.profit,
        autoData.mom_growth.previous.profit,
        autoData.mom_growth.diff.profit,
        `${autoData.mom_growth.growth_pct.profit}%`,
      ]);
      sheet1.addRow([
        'গ্রুপ পোস্ট (Posts)',
        autoData.mom_growth.current.posts,
        autoData.mom_growth.previous.posts,
        autoData.mom_growth.diff.posts,
        `${autoData.mom_growth.growth_pct.posts}%`,
      ]);
      sheet1.addRow([]);

      // Section 3: Budget Table
      sheet1.addRow(['সেকশন ৩: বাজেট ব্যবহার ও ব্যয় বিবরণী']);
      sheet1.getRow(11).font = { bold: true };
      sheet1.addRow(['বাজেট সারসংক্ষেপ', 'পরিমাণ (৳)']);
      const budHeader = sheet1.getRow(12);
      budHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      budHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };

      sheet1.addRow(['নির্ধারিত বাজেট', autoData.budget_summary.monthly_budget]);
      sheet1.addRow(['প্রকৃত খরচ (Spend)', autoData.budget_summary.actual_spend]);
      sheet1.addRow(['ব্যবহারের হার (% Used)', `${autoData.budget_summary.percentage_used}%`]);
      sheet1.addRow(['অবশিষ্ট বাজেট', autoData.budget_summary.remaining]);
      sheet1.addRow([]);

      // Section 7: Admin Text Summary
      sheet1.addRow(['সেকশন ৭: মাসিক কাজের সারসংক্ষেপ ও মূল্যায়ন']);
      sheet1.getRow(18).font = { bold: true };
      sheet1.addRow([report?.summary_text || '(কোনো মন্তব্য সংরক্ষিত নেই)']);
      sheet1.addRow([]);

      // Section 8: Admin Next Month Goals & Budget
      sheet1.addRow(['সেকশন ৮: পরবর্তী মাসের প্রধান লক্ষ্যসমূহ ও প্রস্তাবিত বাজেট']);
      sheet1.getRow(21).font = { bold: true };
      sheet1.addRow(['পরবর্তী মাসের লক্ষ্য', report?.next_month_goal || '(কোনো লক্ষ্য নির্ধারিত নেই)']);
      sheet1.addRow(['প্রস্তাবিত মার্কেটিং বাজেট (৳)', report?.next_month_budget ? Number(report.next_month_budget) : 'N/A']);

      sheet1.columns.forEach((c) => (c.width = 24));

      // Sheet 2: Section 2 - Marketer Performance & Rankings
      const sheet2 = workbook.addWorksheet('Marketer Rankings');
      sheet2.addRow(['সেকশন ২: মার্কেটারদের পারফরম্যান্স ও র‌্যাঙ্কিং']);
      sheet2.getRow(1).font = { bold: true };
      sheet2.addRow([]);
      sheet2.addRow(['র‌্যাংক', 'নাম', 'ইমেইল', 'পোস্ট সংখ্যা', 'বিক্রয় (৳)', 'মুনাফা (৳)', 'স্কোর (%)', 'সেরা পারফর্মার']);
      const empHeader = sheet2.getRow(3);
      empHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      empHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };

      for (const emp of autoData.employee_rankings || []) {
        sheet2.addRow([
          emp.rank,
          emp.employee_name,
          emp.email,
          emp.posts_done,
          emp.sales_amount,
          emp.profit_amount,
          `${emp.score}%`,
          emp.is_top_performer ? '🏆 হ্যাঁ' : 'না',
        ]);
      }
      sheet2.columns.forEach((c) => (c.width = 20));

      // Sheet 3: Section 4 - Section Target Achievements
      const sheet3 = workbook.addWorksheet('Section Achievements');
      sheet3.addRow(['সেকশন ৪: গ্রুপ সেকশন লক্ষ্যমাত্রা বনাম অর্জন']);
      sheet3.getRow(1).font = { bold: true };
      sheet3.addRow([]);
      sheet3.addRow(['সেকশন নাম', 'পোস্ট টার্গেট', 'প্রকৃত পোস্ট', 'পোস্ট অর্জন (%)', 'বিক্রয় টার্গেট (৳)', 'প্রকৃত বিক্রয় (৳)', 'বিক্রয় অর্জন (%)']);
      const secHeader = sheet3.getRow(3);
      secHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      secHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };

      for (const s of autoData.section_achievements || []) {
        sheet3.addRow([
          s.section_name,
          s.posts_target,
          s.posts_actual,
          `${s.posts_pct}%`,
          s.sales_target,
          s.sales_actual,
          `${s.sales_pct}%`,
        ]);
      }
      sheet3.columns.forEach((c) => (c.width = 20));

      // Sheet 4: Section 5 & 6 - Products & Channels Breakdown
      const sheet4 = workbook.addWorksheet('Products & Channels');
      sheet4.addRow(['সেকশন ৫: শীর্ষ বিক্রিত পণ্যসমূহ (Top Products by Revenue)']);
      sheet4.getRow(1).font = { bold: true };
      sheet4.addRow(['পণ্যের নাম (বাংলা)', 'ইংরেজি নাম', 'একক', 'বিক্রির পরিমাণ', 'মোট বিক্রয় (৳)', 'বিক্রয় অংশ (%)']);
      const pHeader = sheet4.getRow(2);
      pHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      pHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } };

      for (const p of autoData.top_products || []) {
        sheet4.addRow([p.product_name_bn, p.product_name_en, p.unit, p.quantity, p.revenue, `${p.revenue_share_pct}%`]);
      }

      sheet4.addRow([]);
      sheet4.addRow(['সেকশন ৬: চ্যানেল ও প্রচারণা বিশ্লেষণ (Channels & Campaigns)']);
      sheet4.getRow(sheet4.rowCount).font = { bold: true };
      sheet4.addRow(['চ্যানেল', 'লিড সংখ্যা', 'অর্ডার সংখ্যা', 'মোট বিক্রয় (৳)', 'কনভার্সন রেট (%)']);
      const chHeader = sheet4.getRow(sheet4.rowCount);
      chHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      chHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };

      for (const c of autoData.channel_breakdown || []) {
        sheet4.addRow([c.channel_bn, c.leads_count, c.orders_count, c.total_amount, `${c.conversion_rate}%`]);
      }
      sheet4.columns.forEach((c) => (c.width = 22));

      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="monthly-report-${month}.xlsx"`,
        },
      });
    }

    // 2. PDF EXPORT (All Sections 1 to 8)
    if (formatType === 'pdf') {
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));

      // Header
      doc.fontSize(16).text('Monthly Marketing Performance Report', { align: 'center' });
      doc.fontSize(10).text(`Month: ${month} (Dhaka Time)`, { align: 'center' });
      doc.fontSize(9).text(`Status: ${reportStatus} | Finalized: ${finalizedStr}`, { align: 'center' });
      doc.moveDown(1);

      // Section 1: MoM Growth
      doc.fontSize(12).fillColor('#0f766e').text('Section 1: Month-over-Month Growth (MoM)');
      doc.fontSize(9).fillColor('#334155');
      doc.moveDown(0.3);
      doc.text(`• Sales: Tk. ${autoData.mom_growth.current.sales.toLocaleString()} vs Prev Tk. ${autoData.mom_growth.previous.sales.toLocaleString()} (${autoData.mom_growth.growth_pct.sales >= 0 ? '+' : ''}${autoData.mom_growth.growth_pct.sales}%)`);
      doc.text(`• Profit: Tk. ${autoData.mom_growth.current.profit.toLocaleString()} vs Prev Tk. ${autoData.mom_growth.previous.profit.toLocaleString()} (${autoData.mom_growth.growth_pct.profit >= 0 ? '+' : ''}${autoData.mom_growth.growth_pct.profit}%)`);
      doc.text(`• Posts: ${autoData.mom_growth.current.posts} vs Prev ${autoData.mom_growth.previous.posts} (${autoData.mom_growth.growth_pct.posts >= 0 ? '+' : ''}${autoData.mom_growth.growth_pct.posts}%)`);
      doc.moveDown(0.8);

      // Section 2: Employee Performance & Rankings
      doc.fontSize(12).fillColor('#059669').text('Section 2: Employee Performance Rankings');
      doc.fontSize(9).fillColor('#334155');
      doc.moveDown(0.3);
      if (autoData.employee_rankings.length === 0) {
        doc.text('No active employee entries.');
      } else {
        autoData.employee_rankings.forEach((emp) => {
          const badge = emp.is_top_performer ? ' [TOP PERFORMER]' : '';
          doc.text(`#${emp.rank} ${emp.employee_name}${badge} - Score: ${emp.score}%, Sales: Tk. ${emp.sales_amount.toLocaleString()}, Posts: ${emp.posts_done}`);
        });
      }
      doc.moveDown(0.8);

      // Section 3: Budget vs Actual Spend
      doc.fontSize(12).fillColor('#0284c7').text('Section 3: Budget Utilization & Spend');
      doc.fontSize(9).fillColor('#334155');
      doc.moveDown(0.3);
      doc.text(`• Monthly Budget: Tk. ${autoData.budget_summary.monthly_budget.toLocaleString()}`);
      doc.text(`• Actual Spend: Tk. ${autoData.budget_summary.actual_spend.toLocaleString()} (${autoData.budget_summary.percentage_used}% used)`);
      doc.text(`• Remaining Budget: Tk. ${autoData.budget_summary.remaining.toLocaleString()}`);
      doc.moveDown(0.8);

      // Section 4: Section Target Achievements
      doc.fontSize(12).fillColor('#4f46e5').text('Section 4: Section Targets vs Actuals');
      doc.fontSize(9).fillColor('#334155');
      doc.moveDown(0.3);
      if (autoData.section_achievements.length === 0) {
        doc.text('No sections found.');
      } else {
        autoData.section_achievements.forEach((s) => {
          doc.text(`• ${s.section_name}: Posts ${s.posts_actual}/${s.posts_target} (${s.posts_pct}%), Sales Tk. ${s.sales_actual.toLocaleString()}/${s.sales_target.toLocaleString()} (${s.sales_pct}%)`);
        });
      }
      doc.moveDown(0.8);

      // Section 5: Top Products by Revenue
      doc.fontSize(12).fillColor('#7c3aed').text('Section 5: Top Products by Revenue');
      doc.fontSize(9).fillColor('#334155');
      doc.moveDown(0.3);
      if (autoData.top_products.length === 0) {
        doc.text('No product sales recorded in this month.');
      } else {
        autoData.top_products.forEach((p) => {
          doc.text(`• ${p.product_name_en} (${p.product_name_bn}): ${p.quantity} ${p.unit} - Revenue: Tk. ${p.revenue.toLocaleString()} (${p.revenue_share_pct}% share)`);
        });
      }
      doc.moveDown(0.8);

      // Section 6: Channels & Campaigns Breakdown
      doc.fontSize(12).fillColor('#d97706').text('Section 6: Channel & Campaign Breakdown');
      doc.fontSize(9).fillColor('#334155');
      doc.moveDown(0.3);
      if (autoData.channel_breakdown.length === 0) {
        doc.text('No channel data available.');
      } else {
        autoData.channel_breakdown.forEach((ch) => {
          doc.text(`• ${ch.channel_bn}: ${ch.leads_count} Leads, ${ch.orders_count} Orders, Sales: Tk. ${ch.total_amount.toLocaleString()} (Conv: ${ch.conversion_rate}%)`);
        });
      }
      doc.moveDown(0.8);

      // Section 7: Monthly Summary Text
      doc.fontSize(12).fillColor('#0f172a').text('Section 7: Monthly Summary & Evaluation');
      doc.fontSize(9).fillColor('#334155');
      doc.moveDown(0.3);
      doc.text(report?.summary_text || 'No admin summary entered.');
      doc.moveDown(0.8);

      // Section 8: Next Month Priorities & Budget
      doc.fontSize(12).fillColor('#0f172a').text('Section 8: Next Month Priorities & Budget');
      doc.fontSize(9).fillColor('#334155');
      doc.moveDown(0.3);
      doc.text(`• Next Month Goals: ${report?.next_month_goal || 'No goals specified.'}`);
      doc.text(`• Proposed Next Month Budget: Tk. ${report?.next_month_budget ? Number(report.next_month_budget).toLocaleString() : 'N/A'}`);

      doc.end();

      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
      });

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="monthly-report-${month}.pdf"`,
        },
      });
    }

    return NextResponse.json({ error: 'Unsupported format. Use excel or pdf.' }, { status: 400 });
  } catch (error) {
    console.error('Error exporting monthly report:', error);
    return NextResponse.json({ error: 'Failed to export monthly report' }, { status: 500 });
  }
}
