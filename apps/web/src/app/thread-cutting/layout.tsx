import React from 'react';
import { ThreadCuttingNavigation } from '@/components/ThreadCuttingNavigation';
import { ThemeProvider } from '@/components/ThemeContext';
import '../globals.css';

export const metadata = {
  title: 'Shubham Fabrics India Pvt. Ltd. | MES - Thread Cutting Department',
  description: 'Enterprise Manufacturing Execution System - Thread Cutting Department Workspace',
};

export default function ThreadCuttingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <ThreadCuttingNavigation />
      <main className="flex-1 min-h-screen flex flex-col pl-0 md:pl-64">
        {children}
      </main>
    </ThemeProvider>
  );
}
