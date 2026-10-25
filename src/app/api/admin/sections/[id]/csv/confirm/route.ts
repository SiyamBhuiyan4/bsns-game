import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

const confirmSchema = z.object({
  fileName: z.string(),
  totalRows: z.number().int().min(0).max(10000),
  duplicateCount: z.number().int().min(0),
  invalidCount: z.number().int().min(0),
  validRows: z.array(
    z.object({
      url: z.string().url(),
      title: z.string().optional().nullable(),
    })
  ).max(10000),
});

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
    const body = await request.json();
    const parse = confirmSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: 'অবৈধ তথ্য' }, { status: 400 });
    }

    const { fileName, totalRows, duplicateCount, invalidCount, validRows } = parse.data;

    // Verify section exists
    const section = await prisma.groupSection.findUnique({
      where: { id: sectionId },
    });
    if (!section) {
      return NextResponse.json({ error: 'সেকশন পাওয়া যায়নি' }, { status: 404 });
    }

    // Execute save in single database transaction
    const { batch, insertedCount } = await prisma.$transaction(async (tx) => {
      // 1. Create upload batch record
      const batchRecord = await tx.csvUploadBatch.create({
        data: {
          section_id: sectionId,
          uploaded_by: session.userId,
          file_name: fileName,
          total_rows: totalRows,
          inserted: validRows.length,
          duplicates: duplicateCount,
          invalid: invalidCount,
        },
      });

      // 2. Insert valid rows in safe chunks
      let insertedCount = 0;
      if (validRows.length > 0) {
        const chunkSize = 1000;
        for (let i = 0; i < validRows.length; i += chunkSize) {
          const chunk = validRows.slice(i, i + chunkSize);
          const chunkResult = await tx.groupLink.createMany({
            data: chunk.map((r) => ({
              section_id: sectionId,
              url: r.url,
              title: r.title || null,
              uploaded_batch_id: batchRecord.id,
              is_active: true,
            })),
            skipDuplicates: true,
          });
          insertedCount += chunkResult.count;
        }

        // If some rows were skipped due to race condition duplicates, update batch
        if (insertedCount !== validRows.length) {
          await tx.csvUploadBatch.update({
            where: { id: batchRecord.id },
            data: {
              inserted: insertedCount,
              duplicates: duplicateCount + (validRows.length - insertedCount),
            },
          });
        }
      }

      return { batch: batchRecord, insertedCount };
    });

    // Audit log
    await createAuditLog({
      actorId: session.userId,
      action: 'UPLOAD',
      entity: 'CsvUploadBatch',
      entityId: batch.id,
      payload: {
        sectionId,
        fileName,
        inserted: insertedCount,
        duplicates: duplicateCount + (validRows.length - insertedCount),
        invalid: invalidCount,
      },
    });

    return NextResponse.json({
      success: true,
      batchId: batch.id,
      inserted: insertedCount,
      duplicates: duplicateCount + (validRows.length - insertedCount),
      invalid: invalidCount,
    });
  } catch (error) {
    console.error('CSV Confirm Error:', error);
    return NextResponse.json({ error: 'লিংক সংরক্ষণ ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
