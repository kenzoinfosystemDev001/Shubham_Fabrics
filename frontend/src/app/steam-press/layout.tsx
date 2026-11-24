import React from 'react';
import { SteamPressNavigation } from '@/components/SteamPressNavigation';
import { ThemeProvider } from '@/components/ThemeContext';
import '../globals.css';

export const metadata = {
  title: 'Shubham Fabrics India Pvt. Ltd. | MES - Steam Press & Ironing Department',
  description: 'Enterprise Manufacturing Execution System - Steam Pressing, Crease Setting, Piece Reconciliation & Final QC Handover',
};

export default function SteamPressLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <SteamPressNavigation />
      <main className="flex-1 min-h-screen flex flex-col pl-0 md:pl-64">
        {children}
      </main>
    </ThemeProvider>
  );
}
