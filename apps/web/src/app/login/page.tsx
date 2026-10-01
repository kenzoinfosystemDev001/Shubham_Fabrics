'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShubhamLogo } from '@/components/ShubhamLogo';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('programmer');
  const [pin, setPin] = useState('1234');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login({
        usernameOrEmail: username.trim(),
        password: pin.trim(),
      });

      if (typeof window !== 'undefined') {
        localStorage.setItem('subham_mes_token', res.accessToken);
        localStorage.setItem('subham_mes_user', JSON.stringify(res.user));
      }

      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Invalid username or PIN. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#FAF8F5]">
      {/* LEFT BRANDING PANEL */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 lg:p-16 border-b md:border-b-0 md:border-r border-[#E5E0D8]/80 bg-[#FAF8F5]">
        <div className="w-full max-w-lg flex flex-col items-center justify-center">
          <ShubhamLogo size="hero" showSubtitle={true} />
          
          <div className="mt-8 text-center max-w-sm">
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#163767]/70 block mb-1">
              Enterprise MES Architecture
            </span>
            <p className="text-xs text-slate-600 leading-relaxed font-serif">
              Digital Production Program &amp; Challan Management System
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT SIGN IN PANEL - PROGRAMMING DEPARTMENT ONLY */}
      <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-6 lg:p-16 bg-[#F4F5F7]">
        <div className="w-full max-w-[420px] bg-white rounded-xl shadow-sm border border-slate-200/90 p-8 sm:p-10">
          
          {/* Visual Hierarchy */}
          <div className="mb-6">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#A66E22] block mb-1">
              SHUBHAM FABRICS INDIA PVT. LTD.
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Manufacturing Execution System
            </h2>
            <div className="mt-3.5 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200/80 rounded-md text-blue-900">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              <span className="text-xs font-bold uppercase tracking-wider">
                Department: PROGRAMMING
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Sign in to manage Production Sheets, Technical Specifications, and Issue Challans.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                Username
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. programmer"
                className="w-full px-3.5 py-2.5 bg-[#EFF4FA] border border-[#D5E1F0] rounded-md text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#163767] focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                PIN / Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full px-3.5 py-2.5 bg-[#EFF4FA] border border-[#D5E1F0] rounded-md text-sm text-slate-900 placeholder-slate-400 tracking-widest focus:outline-none focus:ring-2 focus:ring-[#163767] focus:border-transparent transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-3 px-4 bg-[#163767] hover:bg-[#0F264A] text-white text-sm font-semibold rounded-md shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In to Programming</span>
              )}
            </button>
          </form>

          {/* Quick Sign-in credentials indicator */}
          <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              <span className="font-semibold text-slate-700">Operator: </span>
              <span className="font-mono text-slate-600">programmer</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700">Default PIN: </span>
              <span className="font-mono text-slate-600">1234</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
