import React from 'react';
import { WashingQCNavigation } from '@/components/WashingQCNavigation';
import { ThemeProvider } from '@/components/ThemeContext';
import '../globals.css';

export const metadata = {
  title: 'Shubham Fabrics India Pvt. Ltd. | MES - Washing QC Department',
  description: 'Enterprise Manufacturing Execution System - Washing Quality Check (Washing QC) Inspection Workspace',
};

export default function WashingQCLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <WashingQCNavigation />
      <main className="flex-1 min-h-screen flex flex-col pl-0 md:pl-64">
        {children}
      </main>
    </ThemeProvider>
  );
}
