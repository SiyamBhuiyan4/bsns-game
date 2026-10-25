import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { parseAndValidateCsv } from '@/lib/csv';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  const { id: sectionId } = await params;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'কোনো CSV ফাইল পাওয়া যায়নি (No CSV file provided)' }, { status: 400 });
    }

    // Max 5 MB check
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'ফাইলের আকার ৫ মেগাবাইটের বেশি হতে পারবে না (File exceeds 5MB limit)' }, { status: 400 });
    }

    const csvText = await file.text();

    // Query existing URLs in this section
    const currentSectionLinks = await prisma.groupLink.findMany({
      where: { section_id: sectionId },
      select: { url: true },
    });
    const existingSectionUrls = new Set(currentSectionLinks.map((l) => l.url.toLowerCase()));

    // Query existing URLs in other sections
    const otherSectionLinks = await prisma.groupLink.findMany({
      where: { section_id: { not: sectionId } },
      select: { url: true },
    });
    const existingOtherSectionUrls = new Set(otherSectionLinks.map((l) => l.url.toLowerCase()));

    const result = parseAndValidateCsv(csvText, existingSectionUrls, existingOtherSectionUrls);

    // Empty file check
    if (result.totalRows === 0) {
      return NextResponse.json(
        { error: 'CSV ফাইলে কোনো ডাটা সারি পাওয়া যায়নি (CSV file is empty or contains no data rows)' },
        { status: 400 }
      );
    }

    // Max 10,000 rows limit
    if (result.totalRows > 10000) {
      return NextResponse.json(
        { error: `ফাইলে মোট ${result.totalRows} টি সারি রয়েছে। সর্বোচ্চ ১০,০০০ সারির ফাইল আপলোড করা যাবে।` },
        { status: 400 }
      );
    }

    // First 50 rows for preview screen
    const previewRows = result.rows.slice(0, 50);

    return NextResponse.json({
      success: true,
      fileName: file.name,
      totalRows: result.totalRows,
      validCount: result.validCount,
      duplicateCount: result.duplicateCount,
      invalidCount: result.invalidCount,
      warningCount: result.warningCount,
      previewRows,
      invalidRows: result.invalidRowsForDownload,
      validRowsToInsert: result.validRowsToInsert,
    });
  } catch (error) {
    console.error('CSV Preview Error:', error);
    return NextResponse.json({ error: 'CSV ফাইল প্রসেস করতে ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
