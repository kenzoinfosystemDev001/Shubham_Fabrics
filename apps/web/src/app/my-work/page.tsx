'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FilePlus, Send, ArrowRight, FileText, CheckCircle2, Clock } from 'lucide-react';
import { api } from '@/lib/api';

export default function MyWorkRootPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [draftCount, setDraftCount] = useState(0);
  const [readyCount, setReadyCount] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('subham_mes_user');
      if (!saved) {
        router.push('/login');
        return;
      }
    }

    const loadStats = async () => {
      try {
        setLoading(true);
        const data = await api.getPrograms();
        const drafts = data.filter((p: any) => p.status === 'DRAFT').length;
        const ready = data.filter((p: any) => p.status === 'READY_FOR_ISSUE' || p.status === 'APPROVED').length;
        setDraftCount(drafts);
        setReadyCount(ready);
      } catch (err) {
        console.error('Failed to load stats:', err);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pl-0 md:pl-64">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-8 py-4 sm:py-5 shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A66E22] block">
            PROGRAMMING DEPARTMENT WORKSPACE
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            My Work
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Primary operational center for creating technical production specifications and issuing Challans.
          </p>
        </div>
      </header>

      {/* TWO PRIMARY OPTIONS ONLY */}
      <main className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* OPTION 1: CREATE PRODUCTION SHEET */}
          <div className="bg-white border-2 border-slate-200 hover:border-[#163767] rounded-xl p-8 shadow-xs hover:shadow-md transition flex flex-col justify-between group">
            <div>
              <div className="w-14 h-14 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#163767] mb-6 group-hover:scale-105 transition">
                <FilePlus className="w-7 h-7" />
              </div>

              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-800 block mb-1">
                OPTION 01 · SPECIFICATIONS
              </span>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                Create Production Sheet
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed font-serif mb-6">
                Author new Production Sheets with all 8 technical sections: Client info, Style, Wilcom Design, Fabric specs, Dyeing flags, Quantities, Target dates, and Rejection parameters.
              </p>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between text-xs text-slate-600 mb-6">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Drafts Pending:</span>
                </span>
                <span className="font-mono font-bold text-slate-900">{draftCount}</span>
              </div>
            </div>

            <Link
              href="/my-work/create-production-sheet"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#163767] hover:bg-[#0F264A] text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              <span>Open Production Sheet Form</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* OPTION 2: ISSUE CHALLAN */}
          <div className="bg-white border-2 border-slate-200 hover:border-emerald-600 rounded-xl p-8 shadow-xs hover:shadow-md transition flex flex-col justify-between group">
            <div>
              <div className="w-14 h-14 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 mb-6 group-hover:scale-105 transition">
                <Send className="w-7 h-7" />
              </div>

              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-800 block mb-1">
                OPTION 02 · MATERIAL &amp; WORK MOVEMENT
              </span>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                Issue Challan
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed font-serif mb-6">
                Issue official material and production transfer Challans against approved Production Sheets to initiate downstream plant routing with collision-safe <span className="font-mono font-bold">CH-PRG-YYYY-NNNNN</span> numbering.
              </p>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between text-xs text-slate-600 mb-6">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Ready for Issue:</span>
                </span>
                <span className="font-mono font-bold text-slate-900">{readyCount}</span>
              </div>
            </div>

            <Link
              href="/my-work/issue-challan"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              <span>Proceed to Issue Challan</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
}
