import React from 'react';
import { FabricStoreNavigation } from '@/components/FabricStoreNavigation';
import { ThemeProvider } from '@/components/ThemeContext';
import '../globals.css';

export const metadata = {
  title: 'Shubham Fabrics India Pvt. Ltd. | MES - Fabric Store Department',
  description: 'Enterprise Manufacturing Execution System - Fabric Store Department Workspace',
};

export default function FabricStoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <FabricStoreNavigation />
      <main className="flex-1 min-h-screen flex flex-col pl-0 md:pl-64">
        {children}
      </main>
    </ThemeProvider>
  );
}
