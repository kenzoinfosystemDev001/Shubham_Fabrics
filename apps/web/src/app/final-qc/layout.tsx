import React from 'react';
import { FinalQCNavigation } from '@/components/FinalQCNavigation';
import { ThemeProvider } from '@/components/ThemeContext';
import '../globals.css';

export const metadata = {
  title: 'Shubham Fabrics India Pvt. Ltd. | MES - Final QC Department',
  description: 'Final garment inspection and quality verification workspace.',
};

export default function FinalQCLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <FinalQCNavigation />
      <main className="min-h-screen flex-1 flex flex-col pl-0 md:pl-64">
        {children}
      </main>
    </ThemeProvider>
  );
}
