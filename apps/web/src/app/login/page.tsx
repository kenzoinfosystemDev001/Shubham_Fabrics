'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShubhamLogo } from '@/components/ShubhamLogo';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('jitender');
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
      setError(err.message || 'Invalid username or PIN. Please check with your supervisor.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelect = (u: string, p = '1234') => {
    setUsername(u);
    setPin(p);
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#FAF8F5]">
      {/* LEFT BRANDING PANEL - Matching Image 1 exactly */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 lg:p-16 border-b md:border-b-0 md:border-r border-[#E5E0D8]/60 bg-[#FAF8F5]">
        <div className="w-full max-w-lg flex flex-col items-center justify-center animate-fade-in">
          <ShubhamLogo size="hero" showSubtitle={true} />
        </div>
      </div>

      {/* RIGHT SIGN IN PANEL - Matching Image 1 exactly */}
      <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-6 lg:p-16 bg-[#F4F5F7]">
        <div className="w-full max-w-[420px] bg-white rounded-xl shadow-sm border border-slate-200/80 p-8 sm:p-10">
          {/* Header Tag */}
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#A66E22] block mb-1">
            PRODUCTION & INVENTORY
          </span>

          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">
            Sign in
          </h2>

          <p className="text-xs text-slate-500 mb-6">
            Use the username and PIN your supervisor gave you.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Username
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. jitender"
                className="w-full px-3.5 py-2.5 bg-[#EFF4FA] border border-[#D5E1F0] rounded-md text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                PIN
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full px-3.5 py-2.5 bg-[#EFF4FA] border border-[#D5E1F0] rounded-md text-sm text-slate-900 placeholder-slate-400 tracking-widest focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] focus:border-transparent transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-[#1E3A8A] hover:bg-[#152B68] text-white text-sm font-semibold rounded-md shadow transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign in</span>
              )}
            </button>
          </form>

          <div className="mt-5 text-center">
            <span className="text-[11px] text-slate-500 hover:text-slate-700 cursor-pointer transition">
              Forgot your PIN? Ask an administrator to reset it.
            </span>
          </div>

          {/* Quick Persona Access for Testing Roles */}
          <div className="mt-8 pt-5 border-t border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2 text-center">
              Quick Role Switch (Demo)
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickSelect('jitender')}
                className="text-[11px] text-left p-2 rounded bg-slate-50 hover:bg-blue-50 hover:text-blue-900 border border-slate-200 text-slate-700 transition"
              >
                <span className="font-semibold block">jitender</span>
                <span className="text-[10px] text-slate-400">Store Incharge</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect('admin', 'Admin@12345')}
                className="text-[11px] text-left p-2 rounded bg-slate-50 hover:bg-blue-50 hover:text-blue-900 border border-slate-200 text-slate-700 transition"
              >
                <span className="font-semibold block">admin</span>
                <span className="text-[10px] text-slate-400">Super Administrator</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect('prod_manager', 'Admin@12345')}
                className="text-[11px] text-left p-2 rounded bg-slate-50 hover:bg-blue-50 hover:text-blue-900 border border-slate-200 text-slate-700 transition"
              >
                <span className="font-semibold block">prod_manager</span>
                <span className="text-[10px] text-slate-400">Production Planning</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect('qc_insp', 'Admin@12345')}
                className="text-[11px] text-left p-2 rounded bg-slate-50 hover:bg-blue-50 hover:text-blue-900 border border-slate-200 text-slate-700 transition"
              >
                <span className="font-semibold block">qc_insp</span>
                <span className="text-[10px] text-slate-400">Quality Inspector</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
