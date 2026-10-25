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

  const pct = Math.round((completed / steps.length) * 100);

  return (
    <div className="card">
      <div className="card-header">
        <div className="min-w-0">
          <h2 className="card-title">শুরুর ধাপ</h2>
          <p className="card-subtitle">Getting started</p>
        </div>
        <span className="text-xs font-medium text-slate-500 tabular-nums">
          {completed} / {steps.length} done
        </span>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Setup progress"
        >
          <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ol className="divide-y divide-slate-100">
        {steps.map((step) => (
          <li key={step.title} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-start gap-3">
              {step.done ? (
                <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-brand-600" />
              ) : (
                <Circle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-slate-300" />
              )}
              <div className="min-w-0">
                <p className={`text-sm font-medium ${step.done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                  {step.title}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{step.detail}</p>
              </div>
            </div>
            {!step.done && (
              <Link href={step.href} className="btn btn-secondary btn-sm shrink-0 self-start sm:self-auto">
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
