'use client';

import React from 'react';
import { DepartmentDefectiveShelfWidget } from '@/components/DepartmentDefectiveShelfWidget';

export default function FinalQCDefectiveShelfPage() {
  return (
    <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
      <DepartmentDefectiveShelfWidget
        department="FINAL_QC"
        shelfCode="DEF-SHELF-FINAL-QC"
        accentColor="amber"
      />
    </div>
  );
}
