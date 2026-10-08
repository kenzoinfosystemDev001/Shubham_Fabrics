import React from 'react';
import { DyeingNavigation } from '@/components/DyeingNavigation';
import { ThemeProvider } from '@/components/ThemeContext';
import '../globals.css';

export const metadata = {
  title: 'Shubham Fabrics India Pvt. Ltd. | MES - Dyeing Department',
  description: 'Enterprise Manufacturing Execution System - Dyeing Department Workspace',
};

export default function DyeingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <DyeingNavigation />
      <main className="flex-1 min-h-screen flex flex-col pl-0 md:pl-64">
        {children}
      </main>
    </ThemeProvider>
  );
}
