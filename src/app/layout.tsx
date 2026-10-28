import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Hind_Siliguri, Noto_Sans_Bengali, Inter } from 'next/font/google';
import './globals.css';
import {
  LanguageProvider,
  type Language,
  type DigitStyle,
  type Theme,
} from '@/components/LanguageContext';
import { COOKIE_LANG_KEY, COOKIE_DIGIT_KEY, COOKIE_THEME_KEY } from '@/lib/i18n/cookies';

const hindSiliguri = Hind_Siliguri({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['bengali', 'latin'],
  variable: '--font-hind-siliguri',
  display: 'swap',
});

const notoSansBengali = Noto_Sans_Bengali({
  weight: ['400', '500', '600', '700'],
  subsets: ['bengali'],
  variable: '--font-noto-bengali',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: 'ডিজিটাল মার্কেটিং পারফরম্যান্স ও রিপোর্টিং সিস্টেম',
  description: 'Digital Marketing Performance & Reporting System for Agri & Food Business',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the preferences on the server so the first paint is already in the
  // right language and theme — no flash of Bangla before hydration.
  const cookieStore = await cookies();
  const lang: Language = cookieStore.get(COOKIE_LANG_KEY)?.value === 'en' ? 'en' : 'bn';
  const digitStyle: DigitStyle = cookieStore.get(COOKIE_DIGIT_KEY)?.value === 'en' ? 'en' : 'bn';
  const theme: Theme = cookieStore.get(COOKIE_THEME_KEY)?.value === 'dark' ? 'dark' : 'light';
  const fontCookie = cookieStore.get('app_font')?.value;
  const font = fontCookie === 'noto' || fontCookie === 'inter' ? fontCookie : 'hind';

  return (
    <html
      lang={lang}
      data-lang={lang}
      data-theme={theme}
      data-font={font}
      style={{ colorScheme: theme }}
      className={`${hindSiliguri.variable} ${notoSansBengali.variable} ${inter.variable} scroll-smooth`}
    >
      <body className="min-h-screen bg-canvas text-ink antialiased overflow-x-hidden max-w-full font-bengali">
        <LanguageProvider initialLang={lang} initialDigitStyle={digitStyle} initialTheme={theme}>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
