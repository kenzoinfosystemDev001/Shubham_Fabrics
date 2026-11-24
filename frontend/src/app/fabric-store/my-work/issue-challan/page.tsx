'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { FabricStoreIssueChallanView } from '@/components/fabric-store/FabricStoreIssueChallanView';

function FabricStoreIssueChallanInner() {
  const searchParams = useSearchParams();
  const queryDest = searchParams?.get('dest')?.toUpperCase();
  const fixedTarget = queryDest === 'EMBROIDERY' ? 'EMBROIDERY' : queryDest === 'DYEING' ? 'DYEING' : undefined;

  return <FabricStoreIssueChallanView fixedTarget={fixedTarget} />;
}

export default function FabricStoreIssueChallanPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-brand-50 flex items-center justify-center text-xs text-neutral-500">
          Loading Fabric Store Issue Challan...
        </div>
      }
    >
      <FabricStoreIssueChallanInner />
    </Suspense>
  );
}
