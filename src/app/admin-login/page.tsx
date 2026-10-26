'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, KeyRound, Sprout, AlertCircle, Loader2 } from 'lucide-react';
import LanguageToggle from '@/components/LanguageToggle';
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
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="absolute top-4 right-4 z-10">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
            <Sprout className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">
            {t('adminLogin.title', 'অ্যাডমিন প্যানেল', 'Admin panel')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('adminLogin.subtitle', 'পাসকোড দিয়ে প্রবেশ করুন', 'Enter your passcode')}
          </p>
        </div>

        <div className="card card-body sm:p-6">
          {errorMessage && (
            <div className="alert alert-error mb-4" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>{L(errorMessage)}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="input px-10 text-center text-base tracking-[0.4em]"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode(!showPasscode)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showPasscode ? t('adminLogin.hide', 'পাসকোড লুকান', 'Hide passcode') : t('adminLogin.show', 'পাসকোড দেখুন', 'Show passcode')}
                >
                  {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full">
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
        </div>
      </div>
    </div>
  );
}
