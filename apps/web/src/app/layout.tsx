import React from 'react';
import './globals.css';
import { Navigation } from '@/components/Navigation';

export const metadata = {
  title: 'Subham Fabrics MES | Garment Manufacturing Execution System',
  description: 'Enterprise production-grade shop-floor execution, traceability and challan system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 flex min-h-screen">
        <Navigation />
        <main className="flex-1 overflow-x-hidden min-h-screen bg-slate-950 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
