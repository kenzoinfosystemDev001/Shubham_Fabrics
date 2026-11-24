'use client';

import { ShrinkageRecords } from '@/components/shrinkage/ShrinkageRecords';

// The shrinkage Dyeing QC records, read-only for the Fabric Store.
export default function FabricStoreShrinkagePage() {
  return <ShrinkageRecords editable={false} departmentLabel="Fabric Store" />;
}
