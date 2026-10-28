'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ShieldCheck, Sprout } from 'lucide-react';
import LanguageToggle from '@/components/LanguageToggle';
import { useLanguage } from '@/components/LanguageContext';

/**
 * Shared frame for the two sign-in screens: a quiet top bar with the product
 * wordmark and language switch, a centred card, and a small footer. The faint
 * dot grid behind the card is drawn from theme variables so it follows dark mode.
 */
export default function AuthLayout({
  icon,
  title,
  subtitle,
  children,
  footer,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Extra line under the card, e.g. a link to the other sign-in. */
  footer?: ReactNode;
}) {
  const { L } = useLanguage();

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-canvas">
      {/* Background: soft dot grid fading out towards the edges. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(var(--color-slate-300) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse 60% 55% at 50% 40%, #000 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 55% at 50% 40%, #000 30%, transparent 75%)',
          opacity: 0.55,
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Sprout className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-slate-900">
            {L('মার্কেটিং প্যানেল', 'Marketing Panel')}
          </span>
        </div>
        <LanguageToggle />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16 pt-4">
        <div className="animate-fade-up w-full max-w-[380px]">
          <div className="mb-6 text-center">
            {icon && (
              <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-[var(--shadow-card)]">
                {icon}
              </span>
            )}
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
          </div>

          <div className="card p-5 sm:p-7">{children}</div>

          {footer && <div className="mt-5 text-center text-sm text-slate-500">{footer}</div>}
        </div>
      </main>

      <footer className="relative z-10 flex items-center justify-center gap-1.5 px-4 pb-6 text-xs text-slate-400">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>{L('নিরাপদ সংযোগ · শুধু অনুমোদিত ব্যবহারকারী', 'Secure connection · Authorised users only')}</span>
      </footer>
    </div>
  );
}

/** Small inline link used in the sign-in footers. */
export function AuthSwitchLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-brand-700 hover:text-brand-800 hover:underline">
      {children}
    </Link>
  );
}
