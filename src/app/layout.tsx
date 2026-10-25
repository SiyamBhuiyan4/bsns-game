import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LanguageProvider } from '@/components/LanguageContext';

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
    <html lang="bn" className="scroll-smooth">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased overflow-x-hidden max-w-full">
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
