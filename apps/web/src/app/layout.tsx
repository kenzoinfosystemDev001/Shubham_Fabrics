import React from 'react';
import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
// @ts-ignore -- Next.js resolves global CSS imports at build time.
import './globals.css';
import { Navigation } from '@/components/Navigation';
import { ThemeProvider } from '@/components/ThemeContext';
import { DepartmentGuard } from '@/components/DepartmentGuard';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Shubham Fabrics | MES',
  description: 'Enterprise Manufacturing Execution System - Shubham Fabrics India Pvt. Ltd.',
  icons: {
    icon: '/shubham-logo.jpg',
    shortcut: '/shubham-logo.jpg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={manrope.variable} suppressHydrationWarning>
      <body className={`${manrope.className} min-h-screen flex flex-col font-sans antialiased`} suppressHydrationWarning>
        <ThemeProvider>
          <Navigation />
          <DepartmentGuard>
            <main className="flex-1 min-h-screen flex flex-col">
              {children}
            </main>
          </DepartmentGuard>
        </ThemeProvider>
      </body>
    </html>
  );
}
