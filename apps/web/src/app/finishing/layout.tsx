import React from 'react';
import { FinishingNavigation } from '@/components/FinishingNavigation';
import { ThemeProvider } from '@/components/ThemeContext';
import '../globals.css';

export const metadata = {
  title: 'Shubham Fabrics India Pvt. Ltd. | MES - Finishing & Trimming Department',
  description: 'Enterprise Manufacturing Execution System - Garment Finishing, Thread Trimming, Spot Cleaning & Handover Section',
};

export default function FinishingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <FinishingNavigation />
      <main className="flex-1 min-h-screen flex flex-col pl-0 md:pl-64">
        {children}
      </main>
    </ThemeProvider>
  );
}
