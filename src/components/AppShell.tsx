'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, type LucideIcon } from 'lucide-react';
import LogoutButton from '@/components/LogoutButton';
import LanguageToggle from '@/components/LanguageToggle';
import ThemeToggle from '@/components/ThemeToggle';
import { useLanguage } from '@/components/LanguageContext';

export type NavItem = { href: string; key: string; labelBn: string; labelEn: string; icon: LucideIcon };
export type NavGroup = { key: string; labelBn?: string; labelEn?: string; items: NavItem[] };

type Props = {
  brandBn: string;
  brandEn: string;
  brandIcon: LucideIcon;
  homeHref: string;
  roleLabel: string;
  groups: NavGroup[];
  session: { name: string; email: string };
  logoutRedirect: string;
  children: ReactNode;
};

/** Sidebar + top bar frame shared by the admin and employee panels. */
export default function AppShell({ brandBn, brandEn, brandIcon: BrandIcon, homeHref, roleLabel, groups, session, logoutRedirect, children }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { t, lang, L } = useLanguage();

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === homeHref ? pathname === href : pathname.startsWith(href));
  const current = groups.flatMap((g) => g.items).find((i) => isActive(i.href));
  const initials = session.name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const nav = (
    <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label={lang === 'bn' ? L('মেনু') : 'Menu'}>
      {groups.map((group) => (
        <div key={group.key} className="mb-5 last:mb-0">
          {group.labelBn && (
            <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {t(`admin_nav.group_${group.key}`, group.labelBn, group.labelEn ?? group.labelBn)}
            </div>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200 ${
                      active
                        ? 'bg-brand-50 font-semibold text-brand-800'
                        : 'font-medium text-slate-600 hover:translate-x-0.5 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {/* Rail on the active item, so the eye finds the current page at a glance. */}
                    <span
                      aria-hidden
                      className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-600 transition-all duration-200 ${
                        active ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                    <Icon
                      className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 ${
                        active ? 'text-brand-600' : 'text-slate-400 group-hover:scale-110 group-hover:text-slate-600'
                      }`}
                    />
                    <span className="truncate">{t(item.key, item.labelBn, item.labelEn)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <Link href={homeHref} className="press flex items-center gap-2.5 px-5 py-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm transition-transform duration-200 hover:rotate-3 hover:scale-105">
        <BrandIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-900">{lang === 'bn' ? brandBn : brandEn}</span>
        <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">
          {lang === 'bn'
            ? roleLabel.toLowerCase().includes('marketer')
              ? L('মার্কেটার')
              : roleLabel.toLowerCase().includes('admin')
              ? L('অ্যাডমিন')
              : roleLabel
            : roleLabel}
        </span>
      </span>
    </Link>
  );

  const userCard = (
    <div className="border-t border-slate-200 p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2 bg-slate-50/70 border border-slate-100">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {initials || 'A'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-900">{session.name}</span>
          <span className="block truncate text-xs text-slate-500">{session.email}</span>
        </span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        {brand}
        {nav}
        {userCard}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="animate-fade-in absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="animate-slide-in-left absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between pr-3">
              {brand}
              <button type="button" className="btn-icon" onClick={() => setOpen(false)} aria-label={lang === 'bn' ? L('মেনু বন্ধ করুন') : 'Close menu'}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
            {userCard}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur-md sm:px-6">
          <button type="button" className="btn-icon lg:hidden" onClick={() => setOpen(true)} aria-label={lang === 'bn' ? L('মেনু খুলুন') : 'Open menu'}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-slate-500">
            {current ? t(current.key, current.labelBn, current.labelEn) : ''}
          </div>
          <ThemeToggle />
          <LanguageToggle />
          <LogoutButton redirectTo={logoutRedirect} />
        </header>

        <main key={pathname} className="animate-fade-up mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
