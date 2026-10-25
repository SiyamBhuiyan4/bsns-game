import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import {
  DEFAULT_SETTINGS,
  updateSettingsSchema,
} from '@/lib/settings';

function formatSettings<T extends { achievement_cap: unknown; failing_threshold: unknown }>(settings: T) {
  return {
    ...settings,
    achievement_cap: Number(settings.achievement_cap),
    failing_threshold: Number(settings.failing_threshold),
  };
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  try {
    let settings = await prisma.scoringSettings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await prisma.scoringSettings.create({
        data: DEFAULT_SETTINGS,
      });
    }

    return NextResponse.json({ settings: formatSettings(settings) });
  } catch (error) {
    console.error('Error fetching scoring settings:', error);
    return NextResponse.json({ error: 'সেটিংস লোড করা সম্ভব হয়নি' }, { status: 500 });
  }
}

async function handleUpdate(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parse = updateSettingsSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        {
          error: parse.error.issues[0]?.message || 'অবৈধ তথ্য (Invalid data)',
          issues: parse.error.issues,
        },
        { status: 400 }
      );
    }

    const data = parse.data;

    let current = await prisma.scoringSettings.findUnique({
      where: { id: 'default' },
    });

    if (!current) {
      current = await prisma.scoringSettings.create({
        data: DEFAULT_SETTINGS,
      });
    }

    const oldValues = {
      section_weights: current.section_weights,
      achievement_cap: Number(current.achievement_cap),
      failing_threshold: Number(current.failing_threshold),
      undo_enabled: current.undo_enabled,
      employee_edit_window_days: current.employee_edit_window_days,
      weekly_report_day: current.weekly_report_day,
      weekly_report_time: current.weekly_report_time,
      language_default: current.language_default,
      digit_style: current.digit_style,
    };

    const updated = await prisma.scoringSettings.update({
      where: { id: 'default' },
      data: {
        ...(data.section_weights !== undefined && { section_weights: data.section_weights }),
        ...(data.achievement_cap !== undefined && { achievement_cap: data.achievement_cap }),
        ...(data.failing_threshold !== undefined && { failing_threshold: data.failing_threshold }),
        ...(data.undo_enabled !== undefined && { undo_enabled: data.undo_enabled }),
        ...(data.employee_edit_window_days !== undefined && { employee_edit_window_days: data.employee_edit_window_days }),
        ...(data.weekly_report_day !== undefined && { weekly_report_day: data.weekly_report_day }),
        ...(data.weekly_report_time !== undefined && { weekly_report_time: data.weekly_report_time }),
        ...(data.language_default !== undefined && { language_default: data.language_default }),
        ...(data.digit_style !== undefined && { digit_style: data.digit_style }),
      },
    });

    const newValues = {
      section_weights: updated.section_weights,
      achievement_cap: Number(updated.achievement_cap),
      failing_threshold: Number(updated.failing_threshold),
      undo_enabled: updated.undo_enabled,
      employee_edit_window_days: updated.employee_edit_window_days,
      weekly_report_day: updated.weekly_report_day,
      weekly_report_time: updated.weekly_report_time,
      language_default: updated.language_default,
      digit_style: updated.digit_style,
    };

    await createAuditLog({
      actorId: session.id || session.userId || null,
      action: 'UPDATE',
      entity: 'ScoringSettings',
      entityId: updated.id,
      payload: {
        old: oldValues,
        new: newValues,
        old_values: oldValues,
        new_values: newValues,
      },
    });

    return NextResponse.json({
      settings: formatSettings(updated),
      message: 'সেটিংস সফলভাবে সংরক্ষিত হয়েছে',
    });
  } catch (error) {
    console.error('Error updating scoring settings:', error);
    return NextResponse.json({ error: 'সেটিংস সংরক্ষণ ব্যর্থ হয়েছে' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  return handleUpdate(req);
}

export async function PATCH(req: NextRequest) {
  return handleUpdate(req);
}
