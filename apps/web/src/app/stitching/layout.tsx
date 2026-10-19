import React from 'react';
import { StitchingNavigation } from '@/components/StitchingNavigation';
import { ThemeProvider } from '@/components/ThemeContext';
import '../globals.css';

export const metadata = {
  title: 'Shubham Fabrics India Pvt. Ltd. | MES - Stitching & Assembly Department',
  description: 'Enterprise Manufacturing Execution System - Garment Stitching, Seam Inspection & Assembly Section',
};

export default function StitchingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <StitchingNavigation />
      <main className="flex-1 min-h-screen flex flex-col pl-0 md:pl-64">
        {children}
      </main>
    </ThemeProvider>
  );
}
