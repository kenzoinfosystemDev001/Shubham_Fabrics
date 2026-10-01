'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('subham_mes_user');
    let role = 'STORE_MANAGER';
    try {
      role = JSON.parse(saved || '{}')?.role || 'STORE_MANAGER';
    } catch {}

    // Route to the role-scoped dashboard
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      router.replace('/admin/dashboard');
    } else if (role === 'STORE_MANAGER') {
      router.replace('/store/dashboard');
    } else if (role === 'PRODUCTION_MANAGER') {
      router.replace('/admin/dashboard');
    } else {
      router.replace('/shopfloor');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0B0F17] flex items-center justify-center">
      <div className="text-amber-300 font-mono text-sm animate-pulse">Routing to your dashboard…</div>
    </div>
  );
}