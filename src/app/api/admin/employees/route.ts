import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { hashPassword } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import { maskPhone } from '@/lib/phone';
import { z } from 'zod';

const createEmployeeSchema = z.object({
  name: z.string().min(2, 'নাম কমপক্ষে ২ অক্ষরের হতে হবে'),
  email: z.string().email('সঠিক ইমেইল ঠিকানা দিন'),
  phone: z.string().regex(/^01[3-9]\d{8}$/, 'সঠিক ১১ ডিজিটের বাংলাদেশী মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)').optional().or(z.literal('')),
  password: z.string().min(6, 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে'),
  sectionIds: z.array(z.string()).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  try {
    const employees = await prisma.user.findMany({
      where: { role: 'EMPLOYEE' },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        is_active: true,
        created_at: true,
        assignments_as_employee: {
          select: {
            section: {
              select: { id: true, name: true },
            },
          },
        },
        _count: {
          select: {
            link_completions: {
              where: { undone_at: null },
            },
            leads: true,
          },
        },
      },
    });

    const formatted = employees.map((emp) => ({
      id: emp.id,
      name: emp.name,
      email: emp.email,
      phone: emp.phone,
      masked_phone: emp.phone ? maskPhone(emp.phone) : null,
      is_active: emp.is_active,
      created_at: emp.created_at,
      sections: emp.assignments_as_employee.map((a: any) => a.section),
      total_completed_links: emp._count.link_completions,
      total_leads: emp._count.leads,
    }));

    return NextResponse.json({ employees: formatted });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ error: 'কর্মী তালিকা লোড করা যায়নি' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'অনুমতি নেই / Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parse = createEmployeeSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.issues[0]?.message || 'অবৈধ তথ্য' }, { status: 400 });
    }

    const { name, email, phone, password, sectionIds } = parse.data;

    // Check unique email
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existing) {
      return NextResponse.json({ error: 'এই ইমেইল ইতিমধ্যে ব্যবহৃত হয়েছে (Email already exists)' }, { status: 400 });
    }

    const password_hash = await hashPassword(password);

    const employee = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          phone: phone ? phone.trim() : null,
          password_hash,
          role: 'EMPLOYEE',
          is_active: true,
        },
      });

      if (sectionIds && sectionIds.length > 0) {
        await tx.assignment.createMany({
          data: sectionIds.map((secId) => ({
            employee_id: user.id,
            section_id: secId,
            assigned_by: session.userId,
          })),
          skipDuplicates: true,
        });
      }

      return user;
    });

    await createAuditLog({
      actorId: session.userId,
      action: 'CREATE',
      entity: 'User',
      entityId: employee.id,
      payload: { name: employee.name, email: employee.email, role: 'EMPLOYEE' },
    });

    return NextResponse.json({ success: true, employee }, { status: 201 });
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json({ error: 'কর্মী অ্যাকাউন্ট তৈরি ব্যর্থ হয়েছে' }, { status: 500 });
  }
}
