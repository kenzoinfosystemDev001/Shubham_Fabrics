'use client';

import React, { Suspense } from 'react';
import { FabricStoreIssueChallanView } from '@/components/fabric-store/FabricStoreIssueChallanView';

export default function FabricStoreIssueChallanPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F0FAF9] flex items-center justify-center text-xs text-slate-500">Loading Challan Issue...</div>}>
      <FabricStoreIssueChallanView />
    </Suspense>
  );
}
