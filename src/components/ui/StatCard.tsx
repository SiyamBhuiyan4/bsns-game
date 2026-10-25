import type { ReactNode } from 'react';

type Tone = 'brand' | 'blue' | 'amber' | 'red' | 'violet' | 'gray';

const TONES: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-700',
  blue: 'bg-sky-50 text-sky-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-rose-50 text-rose-700',
  violet: 'bg-violet-50 text-violet-700',
  gray: 'bg-slate-100 text-slate-600',
};

/** A single key number with a label, optional icon and a short note underneath. */
export default function StatCard({
  label,
  value,
  note,
  icon,
  tone = 'brand',
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {icon && <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${TONES[tone]}`}>{icon}</span>}
      </div>
      <div className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</div>
      {note && <div className="text-xs text-slate-500">{note}</div>}
    </div>
  );
}
