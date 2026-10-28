import type { ReactNode } from 'react';

type Tone = 'brand' | 'blue' | 'amber' | 'red' | 'violet' | 'gray';

const TONES: Record<Tone, string> = {
  brand: 'bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-md shadow-emerald-500/30',
  blue: 'bg-gradient-to-br from-sky-400 to-indigo-500 text-white shadow-md shadow-sky-500/30',
  amber: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/30',
  red: 'bg-gradient-to-br from-rose-400 to-pink-600 text-white shadow-md shadow-rose-500/30',
  violet: 'bg-gradient-to-br from-violet-400 to-fuchsia-500 text-white shadow-md shadow-violet-500/30',
  gray: 'bg-gradient-to-br from-slate-400 to-slate-600 text-white shadow-md shadow-slate-500/20',
};

/** A thin colour band along the top edge, in the card's tone. */
const BARS: Record<Tone, string> = {
  brand: 'from-emerald-400 to-teal-500',
  blue: 'from-sky-400 to-indigo-500',
  amber: 'from-amber-400 to-orange-500',
  red: 'from-rose-400 to-pink-500',
  violet: 'from-violet-400 to-fuchsia-500',
  gray: 'from-slate-300 to-slate-400',
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
      <span aria-hidden className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${BARS[tone]}`} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {icon && (
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${TONES[tone]}`}
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
