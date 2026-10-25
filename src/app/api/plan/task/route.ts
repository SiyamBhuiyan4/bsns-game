import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { calculateTaskDueDate, toDhakaDateString } from '@/lib/plan';
import { parseDateOnly } from '@/lib/date';
import { AuditAction, TaskStatus } from '@prisma/client';
import { z } from 'zod';

const addTaskSchema = z.object({
  phase_id: z.string().min(1, 'ফেজ আইডি প্রদান করুন'),
  title_bn: z.string().min(1, 'বাংলা শিরোনাম প্রদান করুন'),
  title_en: z.string().optional(),
  description: z.string().optional().nullable(),
  owner_id: z.string().optional().nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'সঠিক তারিখ দিন (YYYY-MM-DD)').optional().nullable(),
  status: z.nativeEnum(TaskStatus).optional().default(TaskStatus.NOT_STARTED),
  progress_percent: z.number().min(0).max(100).optional().default(0),
});

/**
 * POST: Admin only. Add a new task to a phase.
 * Writes AuditLog (PLAN_UPDATE).
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parse = addTaskSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.issues[0]?.message || 'অবৈধ তথ্য' },
        { status: 400 }
      );
    }

    const {
      phase_id,
      title_bn,
      title_en,
      description,
      owner_id,
      due_date,
      status,
      progress_percent,
    } = parse.data;

    // Validate phase
    const phase = await prisma.planPhase.findUnique({
      where: { id: phase_id },
      include: { plan: true },
    });

    if (!phase) {
      return NextResponse.json({ error: 'পর্যায় পাওয়া যায়নি / Phase not found' }, { status: 404 });
    }

    // Determine due date: explicit due date or calculated from phase day_end
    let finalDueDate: Date | null = null;
    if (due_date) {
      finalDueDate = parseDateOnly(due_date);
    } else if (phase.plan?.start_date) {
      finalDueDate = calculateTaskDueDate(phase.plan.start_date, phase.day_end);
    }

    // If owner_id provided, verify user exists
    if (owner_id) {
      const ownerExists = await prisma.user.findUnique({ where: { id: owner_id } });
      if (!ownerExists) {
        return NextResponse.json({ error: 'কর্মকর্তা পাওয়া যায়নি / Assigned owner not found' }, { status: 404 });
      }
    }

    const task = await prisma.planTask.create({
      data: {
        plan_id: phase.plan_id,
        phase_id,
        title_bn: title_bn.trim(),
        title_en: (title_en || title_bn).trim(),
        description: description?.trim() || null,
        owner_id: owner_id || null,
        due_date: finalDueDate,
        status: status ?? TaskStatus.NOT_STARTED,
        progress_percent: progress_percent ?? 0,
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
      entityId: task.id,
      payload: {
        action: 'ADD_TASK',
        phase_id,
        title_bn: task.title_bn,
        title_en: task.title_en,
        owner_id: task.owner_id,
        due_date: task.due_date ? toDhakaDateString(task.due_date) : null,
        status: task.status,
        progress_percent: task.progress_percent,
      },
    });

    return NextResponse.json({ success: true, task }, { status: 201 });
  } catch (error) {
    console.error('Error adding plan task:', error);
    return NextResponse.json({ error: 'টাস্ক তৈরি ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
