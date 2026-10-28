'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, KeyRound, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import AuthLayout, { AuthSwitchLink } from '@/components/admin/AuthLayout';
import { useLanguage } from '@/components/LanguageContext';

export default function AdminLoginPage() {
  const { L } = useLanguage();
  const router = useRouter();
  const { t } = useLanguage();
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || t('adminLogin.failed', 'লগইন ব্যর্থ। আবার চেষ্টা করুন।', 'Sign-in failed. Try again.'));
        return;
      }

      router.push(data.redirectUrl || '/admin/dashboard');
      router.refresh();
    } catch {
      setErrorMessage(t('adminLogin.network', 'নেটওয়ার্ক সমস্যা। ইন্টারনেট চেক করুন।', 'Network error. Check your connection.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={<ShieldCheck className="h-5 w-5" />}
      title={t('adminLogin.title', 'অ্যাডমিন প্যানেল', 'Admin panel')}
      subtitle={t('adminLogin.subtitle', 'পাসকোড দিয়ে প্রবেশ করুন', 'Enter your passcode')}
      footer={
        <>
          {L('কর্মী?', 'Employee?')}{' '}
          <AuthSwitchLink href="/login">{L('ইমেইল দিয়ে সাইন ইন', 'Sign in with email')}</AuthSwitchLink>
        </>
      }
    >
      {errorMessage && (
        <div className="alert alert-error mb-5" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{L(errorMessage)}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="admin-passcode" className="label">
            {t('adminLogin.passcode', 'পাসকোড', 'Passcode')}
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <KeyRound className="h-4 w-4" />
            </div>
            <input
              id="admin-passcode"
              type={showPasscode ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="current-password"
              autoFocus
              required
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="••••••"
              className="input h-11 px-10 text-center text-base tabular-nums tracking-[0.4em]"
            />
            <button
              type="button"
              onClick={() => setShowPasscode(!showPasscode)}
              className="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-3 text-slate-400 hover:text-slate-600"
              aria-label={showPasscode ? t('adminLogin.hide', 'পাসকোড লুকান', 'Hide passcode') : t('adminLogin.show', 'পাসকোড দেখুন', 'Show passcode')}
            >
              {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary h-10 w-full">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('adminLogin.checking', 'যাচাই করা হচ্ছে…', 'Checking…')}
            </>
          ) : (
            t('adminLogin.submit', 'প্রবেশ করুন', 'Enter')
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
