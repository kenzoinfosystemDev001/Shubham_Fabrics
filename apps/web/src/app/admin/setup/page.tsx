'use client';

import React from 'react';
import Link from 'next/link';

export default function AdminSetupPage() {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full pt-20">
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            SYSTEM ADMINISTRATION
          </span>
          <h1 className="text-2xl font-bold text-slate-900">Factory Configuration & Setup</h1>
          <p className="text-xs text-slate-500 mt-1">
            Production tolerances, department sequences, and manufacturing parameters
          </p>
        </div>

        <Link
          href="/masters"
          className="px-3.5 py-2 bg-[#1E3A8A] hover:bg-[#152B68] text-white text-xs font-semibold rounded-md shadow-sm transition"
        >
          Manage Master Records →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Production Accounting Tolerances</h2>
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Max Fabric Cutting Wastage (%)</label>
              <input type="number" defaultValue={3.5} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md" />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">QC AQL Sampling Level</label>
              <select defaultValue="II" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md">
                <option value="I">General Level I (Reduced)</option>
                <option value="II">General Level II (Standard 2.5 AQL)</option>
                <option value="III">General Level III (Tightened)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Enforce Mandatory Sign-off on Rework</label>
              <input type="checkbox" defaultChecked className="mt-1" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Shift & Line Configuration</h2>
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Morning Shift (Shift A)</label>
              <input type="text" defaultValue="08:00 AM - 04:30 PM" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md" />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Evening Shift (Shift B)</label>
              <input type="text" defaultValue="04:30 PM - 01:00 AM" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md" />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Printer Barcode Standard</label>
              <select defaultValue="CODE128" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md">
                <option value="CODE128">Code 128 (High Density Serial)</option>
                <option value="QR">2D QR Code (Traveler Sheet)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
