'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, LogIn, Mail, AlertCircle, Loader2 } from 'lucide-react';
import AuthLayout from '@/components/admin/AuthLayout';
import { useLanguage } from '@/components/LanguageContext';

export default function LoginPage() {
  const { L } = useLanguage();
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || t('login.failed', 'লগইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।', 'Sign-in failed. Please try again.'));
        return;
      }

      // Success: redirect based on server response
      router.push(data.redirectUrl || '/');
      router.refresh();
    } catch {
      setErrorMessage(t('login.network', 'নেটওয়ার্ক সমস্যা। ইন্টারনেট চেক করুন।', 'Network error. Check your connection.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={<LogIn className="h-5 w-5" />}
      title={t('login.title', 'সাইন ইন করুন', 'Sign in')}
      subtitle={t('login.subtitle', 'কর্মী অ্যাকাউন্ট', 'Employee account')}
    >
      {errorMessage && (
        <div className="alert alert-error mb-5" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{L(errorMessage)}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="login-email" className="label">
            {t('login.email', 'ইমেইল', 'Email')}
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Mail className="h-4 w-4" />
            </div>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input h-10 pl-9"
            />
          </div>
        </div>

        <div>
          <label htmlFor="login-password" className="label">
            {t('login.password', 'পাসওয়ার্ড', 'Password')}
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Lock className="h-4 w-4" />
            </div>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input h-10 pl-9 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-3 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? t('login.hide', 'পাসওয়ার্ড লুকান', 'Hide password') : t('login.show', 'পাসওয়ার্ড দেখুন', 'Show password')}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary h-10 w-full">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('login.signingIn', 'যাচাই করা হচ্ছে…', 'Signing in…')}
            </>
          ) : (
            t('login.submit', 'লগইন', 'Sign in')
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
