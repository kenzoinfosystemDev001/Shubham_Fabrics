import React from 'react';
import { QC1Navigation } from '@/components/QC1Navigation';
import { ThemeProvider } from '@/components/ThemeContext';
import '../globals.css';

export const metadata = {
  title: 'Shubham Fabrics India Pvt. Ltd. | MES - Dyeing QC',
  description: 'Enterprise Manufacturing Execution System - Dyeing QC Inspection Workspace',
};

export default function QC1Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <QC1Navigation />
      <main className="flex-1 min-h-screen flex flex-col pl-0 md:pl-64">
        {children}
      </main>
    </ThemeProvider>
  );
}
