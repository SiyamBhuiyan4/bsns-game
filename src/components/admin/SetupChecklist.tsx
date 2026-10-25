import Link from 'next/link';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import prisma from '@/lib/prisma';

/**
 * Step-by-step guide for a new admin. Each step checks the real data,
 * so the list updates itself as the admin completes things.
 */
export default async function SetupChecklist() {
  const [employees, sections, links, assignments, targets, products] = await Promise.all([
    prisma.user.count({ where: { role: 'EMPLOYEE', is_active: true } }),
    prisma.groupSection.count({ where: { is_active: true } }),
    prisma.groupLink.count({ where: { is_active: true } }),
    prisma.assignment.count({}),
    prisma.sectionTarget.count({}),
    prisma.product.count({ where: { is_active: true } }),
  ]);

  const steps = [
    {
      done: employees > 0,
      title: 'Add your team members',
      detail: 'Create a login for each employee. They sign in at /login.',
      href: '/admin/employees',
      cta: 'Open Team',
    },
    {
      done: sections > 0 && links > 0,
      title: 'Create a group section and add its links',
      detail: 'A section is a group of Facebook groups or links. Upload a CSV or add them by hand.',
      href: '/admin/sections',
      cta: 'Open Group Sections',
    },
    {
      done: assignments > 0,
      title: 'Assign each employee to a section',
      detail: 'Employees only see the links of the sections they are assigned to.',
      href: '/admin/employees',
      cta: 'Assign in Team',
    },
    {
      done: products > 0,
      title: 'Add your products (optional)',
      detail: 'Needed for daily sales entries and product reports.',
      href: '/admin/products',
      cta: 'Open Products',
    },
    {
      done: targets > 0,
      title: 'Set monthly targets (optional)',
      detail: 'Targets are used to calculate each employee’s score.',
      href: '/admin/targets',
      cta: 'Open Targets',
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const allRequiredDone = steps.slice(0, 3).every((s) => s.done);
  if (allRequiredDone && completed === steps.length) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 sm:p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">শুরু করার ধাপসমূহ · Getting started</h2>
          <p className="text-xs text-slate-600">
            Follow these steps in order. {completed} of {steps.length} done.
          </p>
        </div>
      </div>

      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border p-3.5 ${
              step.done ? 'border-emerald-200 bg-white' : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-start gap-3 flex-1">
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0 text-emerald-600" />
              ) : (
                <Circle className="h-5 w-5 mt-0.5 shrink-0 text-slate-400" />
              )}
              <div>
                <p className={`text-sm font-semibold ${step.done ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                  {index + 1}. {step.title}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">{step.detail}</p>
              </div>
            </div>
            {!step.done && (
              <Link
                href={step.href}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 shrink-0"
              >
                {step.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
