import React from 'react';
import './globals.css';
import { Navigation } from '@/components/Navigation';
import { ThemeProvider } from '@/components/ThemeContext';

export const metadata = {
  title: 'Shubham Fabrics India Pvt. Ltd. | MES - Programming Department',
  description: 'Enterprise Manufacturing Execution System - Programming Department Workspace',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <Navigation />
          <main className="flex-1 min-h-screen flex flex-col">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
