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

const GLOWS: Record<Tone, string> = {
  brand: 'from-brand-500/10',
  blue: 'from-sky-500/10',
  amber: 'from-amber-500/10',
  red: 'from-rose-500/10',
  violet: 'from-violet-500/10',
  gray: 'from-slate-500/10',
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
    <div className="card hover-lift group relative flex flex-col gap-3 overflow-hidden p-4">
      {/* A faint wash in the card's own tone, brought up on hover. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${GLOWS[tone]} to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {icon && (
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${TONES[tone]}`}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</div>
      {note && <div className="text-xs text-slate-500">{note}</div>}
    </div>
  );
}
