import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { toDhakaDateString } from '@/lib/plan';
import { parseDateOnly } from '@/lib/date';
import { AuditAction, TaskStatus } from '@prisma/client';
import { z } from 'zod';

const updateTaskSchema = z.object({
  title_bn: z.string().min(1).optional(),
  title_en: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  owner_id: z.string().nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'সঠিক তারিখ দিন (YYYY-MM-DD)').nullable().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  progress_percent: z.number().min(0).max(100).optional(),
  outcome_note: z.string().nullable().optional(),
});

/**
 * PATCH: Admin only. Update task fields.
 * Writes AuditLog (PLAN_UPDATE).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parse = updateTaskSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.issues[0]?.message || 'অবৈধ তথ্য' },
        { status: 400 }
      );
    }

    const currentTask = await prisma.planTask.findUnique({ where: { id } });
    if (!currentTask) {
      return NextResponse.json({ error: 'টাস্ক পাওয়া যায়নি / Task not found' }, { status: 404 });
    }

    const {
      title_bn,
      title_en,
      description,
      owner_id,
      due_date,
      status,
      progress_percent,
      outcome_note,
    } = parse.data;

    // Verify owner if changed and not null
    if (owner_id) {
      const ownerExists = await prisma.user.findUnique({ where: { id: owner_id } });
      if (!ownerExists) {
        return NextResponse.json({ error: 'কর্মকর্তা পাওয়া যায়নি / Assigned owner not found' }, { status: 404 });
      }
    }

    // Auto-align status and progress_percent if helpful
    let finalStatus = status;
    let finalProgress = progress_percent;

    if (finalStatus === TaskStatus.DONE && finalProgress === undefined && currentTask.progress_percent < 100) {
      finalProgress = 100;
    } else if (finalProgress === 100 && finalStatus === undefined && currentTask.status !== TaskStatus.DONE) {
      finalStatus = TaskStatus.DONE;
    }

    const updatedTask = await prisma.planTask.update({
      where: { id },
      data: {
        ...(title_bn !== undefined ? { title_bn: title_bn.trim() } : {}),
        ...(title_en !== undefined ? { title_en: title_en.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(owner_id !== undefined ? { owner_id } : {}),
        ...(due_date !== undefined ? { due_date: due_date ? parseDateOnly(due_date) : null } : {}),
        ...(finalStatus !== undefined ? { status: finalStatus } : {}),
        ...(finalProgress !== undefined ? { progress_percent: finalProgress } : {}),
        ...(outcome_note !== undefined ? { outcome_note: outcome_note?.trim() || null } : {}),
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
          },
        },
        phase: true,
      },
    });

    // Write audit log
    await createAuditLog({
      actorId: session.userId,
      action: AuditAction.PLAN_UPDATE,
      entity: 'PlanTask',
      entityId: id,
      payload: {
        action: 'UPDATE_TASK',
        old: {
          title_bn: currentTask.title_bn,
          status: currentTask.status,
          owner_id: currentTask.owner_id,
          due_date: currentTask.due_date ? toDhakaDateString(currentTask.due_date) : null,
          progress_percent: currentTask.progress_percent,
        },
        new: {
          title_bn: updatedTask.title_bn,
          status: updatedTask.status,
          owner_id: updatedTask.owner_id,
          due_date: updatedTask.due_date ? toDhakaDateString(updatedTask.due_date) : null,
          progress_percent: updatedTask.progress_percent,
        },
      },
    });

    return NextResponse.json({ success: true, task: updatedTask });
  } catch (error) {
    console.error('Error updating plan task:', error);
    return NextResponse.json({ error: 'টাস্ক আপডেট ব্যর্থ হয়েছে' }, { status: 500 });
  }
}

/**
 * DELETE: Admin only. Delete task.
 * Writes AuditLog (PLAN_UPDATE).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const currentTask = await prisma.planTask.findUnique({ where: { id } });
    if (!currentTask) {
      return NextResponse.json({ error: 'টাস্ক পাওয়া যায়নি / Task not found' }, { status: 404 });
    }

    await prisma.planTask.delete({ where: { id } });

    // Write audit log
    await createAuditLog({
      actorId: session.userId,
      action: AuditAction.PLAN_UPDATE,
      entity: 'PlanTask',
      entityId: id,
      payload: {
        action: 'DELETE_TASK',
        title_bn: currentTask.title_bn,
        phase_id: currentTask.phase_id,
      },
    });

    return NextResponse.json({ success: true, message: 'টাস্ক সফলভাবে মুছে ফেলা হয়েছে' });
  } catch (error) {
    console.error('Error deleting plan task:', error);
    return NextResponse.json({ error: 'টাস্ক মুছে ফেলা সম্ভব হয়নি' }, { status: 500 });
  }
}

export const PUT = PATCH;
