'use client';

import React from 'react';

/** 26 vivid tones; each person gets one, stable across visits. */
export const AVATAR_PALETTE: { from: string; to: string; glow: string }[] = [
  { from: '#f43f5e', to: '#fb7185', glow: 'rgba(244,63,94,0.55)' },
  { from: '#e11d48', to: '#f472b6', glow: 'rgba(225,29,72,0.55)' },
  { from: '#ec4899', to: '#f0abfc', glow: 'rgba(236,72,153,0.55)' },
  { from: '#d946ef', to: '#e879f9', glow: 'rgba(217,70,239,0.55)' },
  { from: '#c026d3', to: '#a855f7', glow: 'rgba(192,38,211,0.55)' },
  { from: '#a855f7', to: '#c084fc', glow: 'rgba(168,85,247,0.55)' },
  { from: '#8b5cf6', to: '#a78bfa', glow: 'rgba(139,92,246,0.55)' },
  { from: '#7c3aed', to: '#6d28d9', glow: 'rgba(124,58,237,0.55)' },
  { from: '#6366f1', to: '#818cf8', glow: 'rgba(99,102,241,0.55)' },
  { from: '#4f46e5', to: '#3b82f6', glow: 'rgba(79,70,229,0.55)' },
  { from: '#3b82f6', to: '#60a5fa', glow: 'rgba(59,130,246,0.55)' },
  { from: '#2563eb', to: '#38bdf8', glow: 'rgba(37,99,235,0.55)' },
  { from: '#0ea5e9', to: '#22d3ee', glow: 'rgba(14,165,233,0.55)' },
  { from: '#06b6d4', to: '#67e8f9', glow: 'rgba(6,182,212,0.55)' },
  { from: '#0891b2', to: '#2dd4bf', glow: 'rgba(8,145,178,0.55)' },
  { from: '#14b8a6', to: '#5eead4', glow: 'rgba(20,184,166,0.55)' },
  { from: '#0d9488', to: '#10b981', glow: 'rgba(13,148,136,0.55)' },
  { from: '#10b981', to: '#34d399', glow: 'rgba(16,185,129,0.55)' },
  { from: '#059669', to: '#84cc16', glow: 'rgba(5,150,105,0.55)' },
  { from: '#22c55e', to: '#a3e635', glow: 'rgba(34,197,94,0.55)' },
  { from: '#84cc16', to: '#bef264', glow: 'rgba(132,204,22,0.55)' },
  { from: '#eab308', to: '#facc15', glow: 'rgba(234,179,8,0.55)' },
  { from: '#f59e0b', to: '#fbbf24', glow: 'rgba(245,158,11,0.55)' },
  { from: '#f97316', to: '#fb923c', glow: 'rgba(249,115,22,0.55)' },
  { from: '#ea580c', to: '#f43f5e', glow: 'rgba(234,88,12,0.55)' },
  { from: '#dc2626', to: '#f97316', glow: 'rgba(220,38,38,0.55)' },
  { from: '#be185d', to: '#db2777', glow: 'rgba(190,24,93,0.55)' },
];

/** Stable colour index from the name, so the same person always gets the same tone. */
export function avatarIndex(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h % AVATAR_PALETTE.length;
}

/** First letter of the name, in its own script (Bangla names keep their letter). */
export function avatarInitial(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toUpperCase() : '?';
}

/** Animated profile picture: a slowly turning gradient ring with a breathing glow. */
export default function Avatar({
  name,
  size = 44,
  animated = true,
  tone: toneIndex = null,
}: {
  name: string;
  size?: number;
  animated?: boolean;
  /** Fixed palette index; null picks the tone from the name. */
  tone?: number | null;
}) {
  const tone = AVATAR_PALETTE[toneIndex ?? avatarIndex(name)];
  return (
    <span className="avatar-wrap relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <span
        aria-hidden
        className={`absolute inset-0 rounded-full ${animated ? 'avatar-ring' : ''}`}
        style={{
          background: animated
            ? `conic-gradient(from 0deg, ${tone.from}, ${tone.to}, ${tone.from})`
            : `linear-gradient(135deg, ${tone.from}, ${tone.to})`,
          ['--glow' as string]: tone.glow,
        }}
      />
      <span
        className="relative flex items-center justify-center rounded-full font-bold text-white"
        style={{
          width: size - 5,
          height: size - 5,
          background: `linear-gradient(135deg, ${tone.from}, ${tone.to})`,
          fontSize: size * 0.42,
          textShadow: '0 1px 2px rgba(0,0,0,0.25)',
        }}
      >
        {avatarInitial(name)}
      </span>
    </span>
  );
}
