'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Palette, Sparkles, Square } from 'lucide-react';
import { AVATAR_PALETTE } from '@/components/ui/Avatar';

export type AvatarStyle = 'animated' | 'plain';
export type AvatarPrefs = { style: AvatarStyle; tone: number | null };

const STYLE_KEY = 'app_avatar_style';
const TONE_KEY = 'app_avatar_tone';

/** Reads the saved avatar choice. Null tone means "automatic, from the name". */
export function readAvatarPrefs(): AvatarPrefs {
  try {
    const style = document.cookie.match(/app_avatar_style=(animated|plain)/)?.[1] as AvatarStyle | undefined;
    const toneRaw = document.cookie.match(/app_avatar_tone=(\d+)/)?.[1];
    const tone = toneRaw !== undefined ? Number(toneRaw) : null;
    return { style: style ?? 'animated', tone: tone !== null && tone < AVATAR_PALETTE.length ? tone : null };
  } catch {
    return { style: 'animated', tone: null };
  }
}

function saveAvatarPrefs(p: AvatarPrefs) {
  const year = 'max-age=31536000; path=/; SameSite=Lax';
  document.cookie = `${STYLE_KEY}=${p.style}; ${year}`;
  document.cookie = p.tone === null ? `${TONE_KEY}=; max-age=0; path=/` : `${TONE_KEY}=${p.tone}; ${year}`;
}

/** Profile options: avatar style and colour. Opens from the profile card. */
export default function ProfileMenu({
  prefs,
  onChange,
  children,
}: {
  prefs: AvatarPrefs;
  onChange: (p: AvatarPrefs) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const update = (next: AvatarPrefs) => {
    saveAvatarPrefs(next);
    onChange(next);
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="block w-full text-left" aria-expanded={open}>
        {children}
      </button>
      {open && (
        <div className="animate-scale-in absolute bottom-full left-0 right-0 z-50 mb-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Profile</p>

          <div className="mb-4 grid grid-cols-2 gap-2">
            {([
              { v: 'animated', label: 'Animated', icon: Sparkles },
              { v: 'plain', label: 'Plain colour', icon: Square },
            ] as const).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => update({ ...prefs, style: o.v })}
                className={`press flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${
                  prefs.style === o.v ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <o.icon className="h-3.5 w-3.5" />
                {o.label}
              </button>
            ))}
          </div>

          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Palette className="h-3.5 w-3.5" /> Colour
          </p>
          <div className="grid grid-cols-9 gap-1.5">
            {AVATAR_PALETTE.map((t, i) => {
              const selected = prefs.tone === i;
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`Colour ${i + 1}`}
                  onClick={() => update({ ...prefs, tone: selected ? null : i })}
                  className="press relative flex h-6 w-6 items-center justify-center rounded-full ring-offset-2 transition-transform hover:scale-110"
                  style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})`, boxShadow: selected ? `0 0 0 2px #fff, 0 0 0 4px ${t.from}` : undefined }}
                >
                  {selected && <Check className="h-3 w-3 text-white" />}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            {prefs.tone === null ? 'Colour is chosen automatically from your name.' : 'Tap the selected colour again to go back to automatic.'}
          </p>
        </div>
      )}
    </div>
  );
}
