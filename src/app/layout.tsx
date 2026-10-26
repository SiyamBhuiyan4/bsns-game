import type { Metadata, Viewport } from 'next';
import { Hind_Siliguri, Noto_Sans_Bengali, Inter } from 'next/font/google';
import './globals.css';
import { LanguageProvider } from '@/components/LanguageContext';

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="bn"
      className={`${hindSiliguri.variable} ${notoSansBengali.variable} ${inter.variable} scroll-smooth`}
    >
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased overflow-x-hidden max-w-full font-bengali">
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
