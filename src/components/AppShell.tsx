'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, type LucideIcon } from 'lucide-react';
import LogoutButton from '@/components/LogoutButton';
import LanguageToggle from '@/components/LanguageToggle';
import ThemeToggle from '@/components/ThemeToggle';
import Avatar from '@/components/ui/Avatar';
import FontPicker from '@/components/FontPicker';
import ProfileMenu, { readAvatarPrefs, type AvatarPrefs } from '@/components/ProfileMenu';
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
  /** Colourful profile card, animated avatar and font choice (employee panel). */
  vibrant?: boolean;
  children: ReactNode;
};

/** One colour per menu position: the icon wears it, and the active item becomes a gradient of it. */
const NAV_TINTS = [
  { icon: 'text-emerald-500', active: 'from-emerald-500 to-teal-500 shadow-emerald-500/25' },
  { icon: 'text-sky-500', active: 'from-sky-500 to-indigo-500 shadow-sky-500/25' },
  { icon: 'text-violet-500', active: 'from-violet-500 to-fuchsia-500 shadow-violet-500/25' },
  { icon: 'text-amber-500', active: 'from-amber-500 to-orange-500 shadow-amber-500/25' },
  { icon: 'text-rose-500', active: 'from-rose-500 to-pink-500 shadow-rose-500/25' },
  { icon: 'text-teal-500', active: 'from-teal-500 to-cyan-500 shadow-teal-500/25' },
  { icon: 'text-indigo-500', active: 'from-indigo-500 to-violet-500 shadow-indigo-500/25' },
  { icon: 'text-fuchsia-500', active: 'from-fuchsia-500 to-rose-500 shadow-fuchsia-500/25' },
];

/** Sidebar + top bar frame shared by the admin and employee panels. */
export default function AppShell({ brandBn, brandEn, brandIcon: BrandIcon, homeHref, roleLabel, groups, session, logoutRedirect, vibrant = false, children }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { t, lang, L } = useLanguage();
  const activeNavRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => setOpen(false), [pathname]);

  // Lock body scroll and handle Escape key when mobile drawer is open
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const isActive = (href: string) => (href === homeHref ? pathname === href : pathname.startsWith(href));

  // Automatically scroll active navigation item into view when navigating
  useEffect(() => {
    if (activeNavRef.current) {
      activeNavRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [pathname]);

  const current = groups.flatMap((g) => g.items).find((i) => isActive(i.href));
  const initials = session.name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const nav = (
    <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label={lang === 'bn' ? L('মেনু') : 'Menu'}>
      {groups.map((group) => (
        <div key={group.key} className="mb-3.5 last:mb-0">
          {group.labelBn && (
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t(`admin_nav.group_${group.key}`, group.labelBn, group.labelEn ?? group.labelBn)}
            </div>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item, index) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              const tint = NAV_TINTS[index % NAV_TINTS.length];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    ref={active ? activeNavRef : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-1.5 text-sm transition-all duration-200 ${
                      active
                        ? `bg-gradient-to-r ${tint.active} font-semibold text-white shadow-md`
                        : 'font-medium text-slate-600 hover:translate-x-0.5 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon
                      className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 ${
                        active ? 'text-white' : `${tint.icon} group-hover:scale-110`
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

  const [avatarPrefs, setAvatarPrefs] = useState<AvatarPrefs>({ style: 'animated', tone: null });
  useEffect(() => setAvatarPrefs(readAvatarPrefs()), []);

  const userCard = vibrant ? (
    <div className="border-t border-slate-200 p-3">
      <ProfileMenu prefs={avatarPrefs} onChange={setAvatarPrefs}>
        <div className="profile-card hover-lift flex items-center gap-3 rounded-2xl px-3 py-3 shadow-sm">
          <Avatar name={session.name} size={46} animated={avatarPrefs.style === 'animated'} tone={avatarPrefs.tone} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-900">{session.name}</span>
            <span className="block truncate text-xs text-slate-500">{session.email}</span>
          </span>
        </div>
      </ProfileMenu>
    </div>
  ) : (
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
        <div id="mobile-nav-drawer" className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={lang === 'bn' ? 'নেভিগেশন মেনু' : 'Navigation Menu'}>
          <div className="animate-fade-in absolute inset-0 overlay-dim backdrop-blur-sm" onClick={() => setOpen(false)} />
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
          <button
            type="button"
            className="btn-icon lg:hidden"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="mobile-nav-drawer"
            aria-label={lang === 'bn' ? L('মেনু খুলুন') : 'Open menu'}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-slate-500">
            {current ? t(current.key, current.labelBn, current.labelEn) : ''}
          </div>
          {vibrant && <FontPicker />}
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
