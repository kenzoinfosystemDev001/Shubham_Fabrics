'use client';

import React, { Suspense } from 'react';
import { FabricStoreIssueChallanView } from '@/components/fabric-store/FabricStoreIssueChallanView';

export default function ChallanToEmbroideryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-50 flex items-center justify-center text-xs text-neutral-500">Loading Challan to Embroidery...</div>}>
      <FabricStoreIssueChallanView fixedTarget="EMBROIDERY" />
    </Suspense>
  );
}
