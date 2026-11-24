import React from 'react';
import { RecuttingNavigation } from '@/components/RecuttingNavigation';
import { ThemeProvider } from '@/components/ThemeContext';
import '../globals.css';

export const metadata = {
  title: 'Shubham Fabrics India Pvt. Ltd. | MES - Recutting Department',
  description: 'Enterprise Manufacturing Execution System - Precision Embroidery Recutting & Separation Workspace',
};

export default function RecuttingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <RecuttingNavigation />
      <main className="flex-1 min-h-screen flex flex-col pl-0 md:pl-64">
        {children}
      </main>
    </ThemeProvider>
  );
}
