import React from 'react';
import './globals.css';
import { Navigation } from '@/components/Navigation';

export const metadata = {
  title: 'Subham Fabrics MES | Garment Manufacturing Execution System',
  description: 'Enterprise production-grade shop-floor execution, traceability, and challan system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[#F8FAFC] text-slate-800 min-h-screen flex flex-col font-sans antialiased" suppressHydrationWarning>
        <Navigation />
        <main className="flex-1 min-h-screen flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
