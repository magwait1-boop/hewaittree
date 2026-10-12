import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Tajawal } from 'next/font/google';
import { FamilySessionProvider } from '@/contexts/FamilySessionContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { themeInitializationScript } from '@/lib/theme';
import '../styles/tailwind.css';

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'شجرة حويت — نسب عائلة ال حويت بكفر هلال',
  description: 'تطبيق تفاعلي لعرض وإدارة شجرة نسب عائلة ال حويت بكفر هلال — 2,214 شخصاً عبر 15 فرعاً عائلياً.',
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" data-theme="dark" className={`${tajawal.variable} dark`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body className={tajawal.className}>
        <ThemeProvider>
          <FamilySessionProvider>{children}</FamilySessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
