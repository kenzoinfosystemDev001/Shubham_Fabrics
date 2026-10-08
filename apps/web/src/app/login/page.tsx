'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShubhamLogo } from '@/components/ShubhamLogo';
import { api } from '@/lib/api';
import { Shield, Cpu, Warehouse, Lock, ArrowRight, User, Droplet } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('admin');
  const [pin, setPin] = useState('1234');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick switch role preset
  const selectPreset = (u: string, p: string) => {
    setUsername(u);
    setPin(p);
    setError(null);
  };

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
        document.cookie = `subham_mes_token=${res.accessToken}; path=/; max-age=604800; SameSite=Lax`;
        document.cookie = `subham_mes_role=${res.user.role}; path=/; max-age=604800; SameSite=Lax`;
        document.cookie = `subham_mes_dept=${res.user.departmentCode}; path=/; max-age=604800; SameSite=Lax`;
      }

      // Role-based redirect
      const target =
        res.user.defaultRedirect ||
        (res.user.role === 'ADMIN'
          ? '/admin'
          : res.user.departmentCode === 'STORE' || res.user.role === 'FABRIC_STORE'
          ? '/fabric-store'
          : '/');

      router.push(target);
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
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#163767]/80 block mb-1">
              Enterprise MES Architecture
            </span>
            <p className="text-xs text-slate-600 leading-relaxed font-serif">
              Digital Production Program, Challan Management &amp; Shop-Floor Execution System
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT SIGN IN PANEL */}
      <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-6 lg:p-16 bg-[#F4F5F7]">
        <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-md border border-slate-200/90 p-8 sm:p-10">
          
          {/* Header */}
          <div className="mb-6">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#A66E22] block mb-1">
              SHUBHAM FABRICS INDIA PVT. LTD.
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Manufacturing Execution System
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Sign in with your authorized station credentials or PIN.
            </p>
          </div>

          {/* QUICK ROLE SELECTOR TABS */}
          <div className="mb-6">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Select Factory Station / Role
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => selectPreset('admin', '1234')}
                className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                  username === 'admin'
                    ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-bold shadow-xs'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <Shield className={`w-4 h-4 ${username === 'admin' ? 'text-indigo-600' : 'text-slate-500'}`} />
                <span className="text-xs leading-none">Admin</span>
                <span className="text-[9px] text-slate-400 font-mono">admin</span>
              </button>

              <button
                type="button"
                onClick={() => selectPreset('program', '1234')}
                className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                  username === 'program' || username === 'programmer'
                    ? 'border-blue-600 bg-blue-50/80 text-blue-950 font-bold shadow-xs'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <Cpu className={`w-4 h-4 ${username === 'program' || username === 'programmer' ? 'text-blue-600' : 'text-slate-500'}`} />
                <span className="text-xs leading-none">Programming</span>
                <span className="text-[9px] text-slate-400 font-mono">program</span>
              </button>

              <button
                type="button"
                onClick={() => selectPreset('store', '1234')}
                className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                  username === 'store'
                    ? 'border-teal-600 bg-teal-50/80 text-teal-950 font-bold shadow-xs'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <Warehouse className={`w-4 h-4 ${username === 'store' ? 'text-teal-600' : 'text-slate-500'}`} />
                <span className="text-xs leading-none">Fabric Store</span>
                <span className="text-[9px] text-slate-400 font-mono">store</span>
              </button>

              <button
                type="button"
                onClick={() => selectPreset('dyeing', '1234')}
                className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                  username === 'dyeing'
                    ? 'border-purple-600 bg-purple-50/80 text-purple-950 font-bold shadow-xs'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <Droplet className={`w-4 h-4 ${username === 'dyeing' ? 'text-purple-600' : 'text-slate-500'}`} />
                <span className="text-xs leading-none">Dyeing</span>
                <span className="text-[9px] text-slate-400 font-mono">dyeing</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <span className="font-bold">Error:</span> {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                Username / Station ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin, program, store..."
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#EFF4FA] border border-[#D5E1F0] rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#163767] focus:border-transparent transition"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                PIN / Station Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#EFF4FA] border border-[#D5E1F0] rounded-xl text-sm text-slate-900 placeholder-slate-400 tracking-widest focus:outline-none focus:ring-2 focus:ring-[#163767] focus:border-transparent transition"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-3 px-4 bg-[#163767] hover:bg-[#0F264A] text-white text-sm font-semibold rounded-xl shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Authenticating Station...</span>
                </>
              ) : (
                <>
                  <span>Sign In to MES</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick PIN Info */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              <span className="font-semibold text-slate-700">Station PIN: </span>
              <span className="font-mono text-slate-600 font-bold">1234</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Role-Based Access Control (RBAC)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
