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
      title: 'কর্মী যুক্ত করুন',
      detail: 'Create a login for each employee at /login',
      href: '/admin/employees',
      cta: 'Open Team',
    },
    {
      done: sections > 0 && links > 0,
      title: 'সেকশন ও লিংক যুক্ত করুন',
      detail: 'A section is a group of links. Upload a CSV or add by hand',
      href: '/admin/sections',
      cta: 'Open Sections',
    },
    {
      done: assignments > 0,
      title: 'কর্মীকে সেকশন বরাদ্দ দিন',
      detail: 'Employees see only their assigned sections',
      href: '/admin/employees',
      cta: 'Assign in Team',
    },
    {
      done: products > 0,
      title: 'পণ্য যুক্ত করুন (ঐচ্ছিক)',
      detail: 'Needed for daily sales and product reports',
      href: '/admin/products',
      cta: 'Open Products',
    },
    {
      done: targets > 0,
      title: 'মাসিক টার্গেট সেট করুন (ঐচ্ছিক)',
      detail: 'Used to calculate each employee’s score',
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
          <h2 className="text-base sm:text-lg font-bold text-slate-900">শুরুর ধাপ</h2>
          <p className="text-xs text-slate-600">{completed} of {steps.length} done</p>
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
