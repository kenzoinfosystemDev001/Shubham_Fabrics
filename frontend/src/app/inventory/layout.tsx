import React from 'react';
import { InventoryNavigation } from '@/components/InventoryNavigation';
import { ThemeProvider } from '@/components/ThemeContext';
import '../globals.css';

export const metadata = {
  title: 'Shubham Fabrics India Pvt. Ltd. | MES - Inventory Department',
  description: 'Finished garment receipt, inventory and packing.',
};

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <InventoryNavigation />
      <main className="min-h-screen flex-1 flex flex-col pl-0 md:pl-64">{children}</main>
    </ThemeProvider>
  );
}
