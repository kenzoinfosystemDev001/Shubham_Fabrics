'use client';

import React, { Suspense } from 'react';
import { FabricStoreIssueChallanView } from '@/components/fabric-store/FabricStoreIssueChallanView';

export default function ChallanToDyeingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ink-50 flex items-center justify-center text-xs text-slate-500">Loading Challan to Dyeing...</div>}>
      <FabricStoreIssueChallanView fixedTarget="DYEING" />
    </Suspense>
  );
}
