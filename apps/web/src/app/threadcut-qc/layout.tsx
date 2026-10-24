import React from 'react';
import { ThreadcutQCNavigation } from '@/components/ThreadcutQCNavigation';
import { ThemeProvider } from '@/components/ThemeContext';
import '../globals.css';

export const metadata = {
  title: 'Shubham Fabrics India Pvt. Ltd. | MES - Threadcut QC Department',
  description: 'Enterprise Manufacturing Execution System - Threadcut QC Inspection Workspace',
};

export default function ThreadcutQCLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <ThreadcutQCNavigation />
      <main className="flex-1 min-h-screen flex flex-col pl-0 md:pl-64">
        {children}
      </main>
    </ThemeProvider>
  );
}
