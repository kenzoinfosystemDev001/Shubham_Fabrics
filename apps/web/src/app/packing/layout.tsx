import React from 'react';
import { PackingNavigation } from '@/components/PackingNavigation';
import { ThemeProvider } from '@/components/ThemeContext';
import '../globals.css';

export const metadata = {
  title: 'Shubham Fabrics India Pvt. Ltd. | MES - Packing & Inventory',
  description: 'Final garment packaging, carton tracking, and finished goods inventory management.',
};

export default function PackingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <PackingNavigation />
      <main className="min-h-screen flex-1 flex flex-col pl-0 md:pl-64">
        {children}
      </main>
    </ThemeProvider>
  );
}
