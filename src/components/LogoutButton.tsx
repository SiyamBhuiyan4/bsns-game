'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Loader2 } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  const logoutText = t('common.logout', 'লগআউট', 'Logout');

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
      title={logoutText}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
      ) : (
        <LogOut className="h-3.5 w-3.5" />
      )}
      <span>{logoutText}</span>
    </button>
  );
}
