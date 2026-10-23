'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getUserStationHome } from '@/lib/rbac';
import { DEPARTMENT_NAV_BG_IMAGE } from '@/lib/nav-bg';
import {
  Shield,
  Cpu,
  Warehouse,
  Lock,
  ArrowRight,
  User,
  Droplet,
  CheckCircle2,
  Scissors,
  Waves,
  Shirt,
  Sparkles,
  Wind,
  Package,
} from 'lucide-react';

interface StationOption {
  id: string;
  name: string;
  username: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  borderActive: string;
  bgActive: string;
}

const STATIONS: StationOption[] = [
  {
    id: 'admin',
    name: 'Admin',
    username: 'admin',
    icon: Shield,
    accentColor: 'text-indigo-400',
    borderActive: 'border-indigo-500/80 shadow-[0_0_15px_rgba(99,102,241,0.25)]',
    bgActive: 'bg-indigo-500/15 text-white',
  },
  {
    id: 'program',
    name: 'Programming',
    username: 'program',
    icon: Cpu,
    accentColor: 'text-amber-400',
    borderActive: 'border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.25)]',
    bgActive: 'bg-amber-500/15 text-white',
  },
  {
    id: 'store',
    name: 'Fabric Store',
    username: 'store',
    icon: Warehouse,
    accentColor: 'text-teal-400',
    borderActive: 'border-teal-500/80 shadow-[0_0_15px_rgba(20,184,166,0.25)]',
    bgActive: 'bg-teal-500/15 text-white',
  },
  {
    id: 'dyeing',
    name: 'Dyeing',
    username: 'dyeing',
    icon: Droplet,
    accentColor: 'text-purple-400',
    borderActive: 'border-purple-500/80 shadow-[0_0_15px_rgba(168,85,247,0.25)]',
    bgActive: 'bg-purple-500/15 text-white',
  },
  {
    id: 'qc1',
    name: 'Dyeing QC',
    username: 'qc1',
    icon: CheckCircle2,
    accentColor: 'text-emerald-400',
    borderActive: 'border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.25)]',
    bgActive: 'bg-emerald-500/15 text-white',
  },
  {
    id: 'embroidery',
    name: 'Embroidery',
    username: 'embroidery',
    icon: Scissors,
    accentColor: 'text-fuchsia-400',
    borderActive: 'border-fuchsia-500/80 shadow-[0_0_15px_rgba(217,70,239,0.25)]',
    bgActive: 'bg-fuchsia-500/15 text-white',
  },
  {
    id: 'cutting',
    name: 'Thread Cutting',
    username: 'cutting',
    icon: Scissors,
    accentColor: 'text-cyan-400',
    borderActive: 'border-cyan-500/80 shadow-[0_0_15px_rgba(6,182,212,0.25)]',
    bgActive: 'bg-cyan-500/15 text-white',
  },
  {
    id: 'qc2',
    name: 'QC2 Dept',
    username: 'qc2',
    icon: CheckCircle2,
    accentColor: 'text-emerald-400',
    borderActive: 'border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.25)]',
    bgActive: 'bg-emerald-500/15 text-white',
  },
  {
    id: 'washing',
    name: 'Washing',
    username: 'washing',
    icon: Waves,
    accentColor: 'text-sky-400',
    borderActive: 'border-sky-500/80 shadow-[0_0_15px_rgba(14,165,233,0.25)]',
    bgActive: 'bg-sky-500/15 text-white',
  },
  {
    id: 'qcwashing',
    name: 'QC Washing',
    username: 'qcwashing',
    icon: CheckCircle2,
    accentColor: 'text-teal-400',
    borderActive: 'border-teal-500/80 shadow-[0_0_15px_rgba(20,184,166,0.25)]',
    bgActive: 'bg-teal-500/15 text-white',
  },
  {
    id: 'recutting',
    name: 'Recutting',
    username: 'recutting',
    icon: Scissors,
    accentColor: 'text-rose-400',
    borderActive: 'border-rose-500/80 shadow-[0_0_15px_rgba(244,63,94,0.25)]',
    bgActive: 'bg-rose-500/15 text-white',
  },
  {
    id: 'stitching',
    name: 'Stitching',
    username: 'stitching',
    icon: Shirt,
    accentColor: 'text-indigo-400',
    borderActive: 'border-indigo-500/80 shadow-[0_0_15px_rgba(99,102,241,0.25)]',
    bgActive: 'bg-indigo-500/15 text-white',
  },
  {
    id: 'finishing',
    name: 'Finishing',
    username: 'finishing',
    icon: Sparkles,
    accentColor: 'text-teal-400',
    borderActive: 'border-teal-500/80 shadow-[0_0_15px_rgba(20,184,166,0.25)]',
    bgActive: 'bg-teal-500/15 text-white',
  },
  {
    id: 'steampress',
    name: 'Steam Press',
    username: 'steampress',
    icon: Wind,
    accentColor: 'text-cyan-400',
    borderActive: 'border-cyan-500/80 shadow-[0_0_15px_rgba(6,182,212,0.25)]',
    bgActive: 'bg-cyan-500/15 text-white',
  },
  {
    id: 'finalcheck',
    name: 'Final QC',
    username: 'finalcheck',
    icon: CheckCircle2,
    accentColor: 'text-emerald-400',
    borderActive: 'border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.25)]',
    bgActive: 'bg-emerald-500/15 text-white',
  },
  {
    id: 'packing',
    name: 'Packing & Inventory',
    username: 'packing',
    icon: Package,
    accentColor: 'text-amber-400',
    borderActive: 'border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.4)]',
    bgActive: 'bg-amber-500/15 text-white',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('admin');
  const [pin, setPin] = useState('1234');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectStation = (stationUsername: string) => {
    setUsername(stationUsername);
    setPin('1234');
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

      const target = res.user.defaultRedirect || getUserStationHome(res.user);
      router.replace(target);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please verify username and PIN.');
    } finally {
      setLoading(false);
    }
  };

  const activeStation = STATIONS.find(
    (s) =>
      s.username.toLowerCase() === username.trim().toLowerCase() ||
      (s.username === 'program' && username.trim().toLowerCase() === 'programmer') ||
      (s.username === 'qcwashing' && (username.trim().toLowerCase() === 'qc3' || username.trim().toLowerCase() === 'qc_washing')) ||
      (s.username === 'recutting' && (username.trim().toLowerCase() === 'recutting_incharge' || username.trim().toLowerCase() === 'recutting_supervisor'))
  );

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#090D16] overflow-hidden select-none font-sans">
      {/* BACKGROUND TEXTURE & AMBIENT GLOWS */}
      <div
        className="absolute inset-0 opacity-15 bg-center bg-cover pointer-events-none filter blur-xs"
        style={{
          backgroundImage: `url('${DEPARTMENT_NAV_BG_IMAGE}')`,
        }}
      />
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-[#090D16]/70 to-[#090D16] pointer-events-none" />

      {/* CENTERED PREMIUM GLASS CARD */}
      <div className="relative z-10 w-full max-w-[560px] bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/60">
        
        {/* BRANDING HEADER */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-white p-1.5 shadow-lg border border-amber-500/30 flex items-center justify-center mb-3 transition-transform hover:scale-105">
            <img
              src="/shubham-logo.jpg"
              alt="Shubham Fabrics"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-base sm:text-lg font-bold tracking-[0.18em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-amber-100">
            Shubham Fabrics
          </h1>
          <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-slate-400 mt-0.5">
            Enterprise Portal
          </span>
        </div>

        {/* REFINED STATION SELECTOR */}
        <div className="mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {STATIONS.map((station) => {
              const Icon = station.icon;
              const isSelected = activeStation?.id === station.id;
              return (
                <button
                  key={station.id}
                  type="button"
                  onClick={() => selectStation(station.username)}
                  className={`relative p-2 sm:p-2.5 rounded-xl border text-center transition-all duration-200 flex flex-col items-center justify-center gap-1 cursor-pointer min-h-[58px] ${
                    isSelected
                      ? `${station.borderActive} ${station.bgActive}`
                      : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800/70 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isSelected ? station.accentColor : 'text-slate-500'
                    }`}
                  />
                  <span className="text-[11px] sm:text-xs font-semibold tracking-tight text-center leading-tight">
                    {station.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ERROR MESSAGE */}
        {error && (
          <div className="mb-5 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0"></span>
            <span>{error}</span>
          </div>
        )}

        {/* SIGN IN FORM */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <div className="relative">
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Station ID"
                className="w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-700/60 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/40 transition"
              />
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            </div>
          </div>

          <div>
            <div className="relative">
              <input
                type="password"
                required
                autoComplete="current-password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Security PIN"
                className="w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-700/60 rounded-xl text-sm text-white placeholder-slate-500 tracking-wider focus:outline-none focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/40 transition"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:via-amber-500 hover:to-amber-600 text-slate-950 font-bold text-xs uppercase tracking-[0.14em] rounded-xl shadow-lg shadow-amber-500/20 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* MINIMAL FOOTER */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-col items-center justify-center gap-3">
          <span className="text-[11px] text-slate-500 tracking-wide">Protected Enterprise Session</span>
        </div>
      </div>
    </div>
  );
}
