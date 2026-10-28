'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Palette, Sparkles, Square, Type } from 'lucide-react';
import { AVATAR_PALETTE } from '@/components/ui/Avatar';
import { FONT_OPTIONS, applyFont, readFont } from '@/components/FontPicker';
import { useLanguage } from '@/components/LanguageContext';

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

/** Profile options: avatar style, colour and font. Opens from the profile card. */
export default function ProfileMenu({
  prefs,
  onChange,
  children,
}: {
  prefs: AvatarPrefs;
  onChange: (p: AvatarPrefs) => void;
  children: React.ReactNode;
}) {
  const { L } = useLanguage();
  const [open, setOpen] = useState(false);
  const [font, setFont] = useState('hind');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setFont(readFont());
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const update = (next: AvatarPrefs) => {
    saveAvatarPrefs(next);
    onChange(next);
  };

  const changeFont = (value: string) => {
    setFont(value);
    applyFont(value);
  };

  const sectionLabel = 'mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="block w-full rounded-2xl text-left"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={L('প্রোফাইল সেটিংস', 'Profile settings')}
      >
        {children}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={L('প্রোফাইল সেটিংস', 'Profile settings')}
          className="animate-scale-in absolute bottom-full left-0 right-0 z-50 mb-2 max-h-[70dvh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-overlay)]"
        >
          <p className={sectionLabel}>{L('প্রোফাইল ছবি', 'Profile picture')}</p>
          <div className="segmented mb-4 grid w-full grid-cols-2">
            {([
              { v: 'animated', label: L('অ্যানিমেটেড', 'Animated'), icon: Sparkles },
              { v: 'plain', label: L('সাধারণ রং', 'Plain colour'), icon: Square },
            ] as const).map((o) => (
              <button
                key={o.v}
                type="button"
                data-active={prefs.style === o.v}
                aria-pressed={prefs.style === o.v}
                onClick={() => update({ ...prefs, style: o.v })}
                className="flex min-h-9 items-center justify-center gap-1.5"
              >
                <o.icon className="h-3.5 w-3.5" />
                {o.label}
              </button>
            ))}
          </div>

          <p className={sectionLabel}>
            <Palette className="h-3.5 w-3.5" /> {L('রং', 'Colour')}
          </p>
          <div className="grid grid-cols-6 gap-2">
            {AVATAR_PALETTE.map((t, i) => {
              const selected = prefs.tone === i;
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={L(`রং ${i + 1}`, `Colour ${i + 1}`)}
                  aria-pressed={selected}
                  onClick={() => update({ ...prefs, tone: selected ? null : i })}
                  className="press flex aspect-square w-full items-center justify-center rounded-full transition-transform hover:scale-110"
                  style={{
                    background: `linear-gradient(135deg, ${t.from}, ${t.to})`,
                    // Ring gap uses the surface colour, so it reads in dark mode too.
                    boxShadow: selected ? `0 0 0 2px var(--color-white), 0 0 0 4px ${t.from}` : undefined,
                  }}
                >
                  {selected && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">
            {prefs.tone === null
              ? L('আপনার নাম থেকে রং স্বয়ংক্রিয়ভাবে বাছাই হয়েছে।', 'Colour is chosen automatically from your name.')
              : L('স্বয়ংক্রিয় রঙে ফিরতে বাছাই করা রঙে আবার চাপুন।', 'Tap the selected colour again to go back to automatic.')}
          </p>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <label htmlFor="profile-font" className={sectionLabel}>
              <Type className="h-3.5 w-3.5" /> {L('ফন্ট', 'Font')}
            </label>
            <select
              id="profile-font"
              value={font}
              onChange={(e) => changeFont(e.target.value)}
              className="input min-h-10 text-sm"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
