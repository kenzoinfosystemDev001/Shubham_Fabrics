import React from 'react';
import './globals.css';
import { Navigation } from '@/components/Navigation';
import { ThemeProvider } from '@/components/ThemeContext';
import { DepartmentGuard } from '@/components/DepartmentGuard';

export const metadata = {
  title: 'Shubham Fabrics India Pvt. Ltd. | MES Enterprise',
  description: 'Enterprise Manufacturing Execution System - Shubham Fabrics India Pvt. Ltd.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col font-sans antialiased" suppressHydrationWarning>
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
