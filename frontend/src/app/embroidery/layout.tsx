import React from 'react';
import { EmbroideryNavigation } from '@/components/EmbroideryNavigation';
import { ThemeProvider } from '@/components/ThemeContext';
import '../globals.css';

export const metadata = {
  title: 'Shubham Fabrics India Pvt. Ltd. | MES - Embroidery Department',
  description: 'Enterprise Manufacturing Execution System - Embroidery Department Workspace',
};

export default function EmbroideryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <EmbroideryNavigation />
      <main className="flex-1 min-h-screen flex flex-col pl-0 md:pl-64">
        {children}
      </main>
    </ThemeProvider>
  );
}
