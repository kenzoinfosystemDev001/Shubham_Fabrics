import React from 'react';
import { QCWashingNavigation } from '@/components/QCWashingNavigation';
import { ThemeProvider } from '@/components/ThemeContext';
import '../globals.css';

export const metadata = {
  title: 'Shubham Fabrics India Pvt. Ltd. | MES - Washing QC',
  description: 'Enterprise Manufacturing Execution System - Washing QC Workspace',
};

export default function QCWashingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <QCWashingNavigation />
      <main className="flex-1 min-h-screen flex flex-col pl-0 md:pl-64">
        {children}
      </main>
    </ThemeProvider>
  );
}
