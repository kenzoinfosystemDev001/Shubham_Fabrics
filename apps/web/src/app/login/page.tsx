'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { checkRouteAccess, getUserStationHome } from '@/lib/rbac';
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
    accentColor: 'text-brand-700',
    borderActive: 'border-brand-500 ring-1 ring-brand-500',
    bgActive: 'bg-brand-50 text-brand-800',
  },
  {
    id: 'program',
    name: 'Programming',
    username: 'program',
    icon: Cpu,
    accentColor: 'text-brand-700',
    borderActive: 'border-brand-500 ring-1 ring-brand-500',
    bgActive: 'bg-brand-50 text-brand-800',
  },
  {
    id: 'store',
    name: 'Fabric Store',
    username: 'store',
    icon: Warehouse,
    accentColor: 'text-brand-700',
    borderActive: 'border-brand-500 ring-1 ring-brand-500',
    bgActive: 'bg-brand-50 text-brand-800',
  },
  {
    id: 'dyeing',
    name: 'Dyeing',
    username: 'dyeing',
    icon: Droplet,
    accentColor: 'text-brand-700',
    borderActive: 'border-brand-500 ring-1 ring-brand-500',
    bgActive: 'bg-brand-50 text-brand-800',
  },
  {
    id: 'qc1',
    name: 'Dyeing QC',
    username: 'qc1',
    icon: CheckCircle2,
    accentColor: 'text-brand-700',
    borderActive: 'border-brand-500 ring-1 ring-brand-500',
    bgActive: 'bg-brand-50 text-brand-800',
  },
  {
    id: 'embroidery',
    name: 'Embroidery',
    username: 'embroidery',
    icon: Scissors,
    accentColor: 'text-brand-700',
    borderActive: 'border-brand-500 ring-1 ring-brand-500',
    bgActive: 'bg-brand-50 text-brand-800',
  },
  {
    id: 'cutting',
    name: 'Thread Cutting',
    username: 'cutting',
    icon: Scissors,
    accentColor: 'text-brand-700',
    borderActive: 'border-brand-500 ring-1 ring-brand-500',
    bgActive: 'bg-brand-50 text-brand-800',
  },
  {
    id: 'qc2',
    name: 'QC2 Dept',
    username: 'qc2',
    icon: CheckCircle2,
    accentColor: 'text-brand-700',
    borderActive: 'border-brand-500 ring-1 ring-brand-500',
    bgActive: 'bg-brand-50 text-brand-800',
  },
  {
    id: 'washing',
    name: 'Washing',
    username: 'washing',
    icon: Waves,
    accentColor: 'text-brand-700',
    borderActive: 'border-brand-500 ring-1 ring-brand-500',
    bgActive: 'bg-brand-50 text-brand-800',
  },
  {
    id: 'qcwashing',
    name: 'QC Washing',
    username: 'qcwashing',
    icon: CheckCircle2,
    accentColor: 'text-brand-700',
    borderActive: 'border-brand-500 ring-1 ring-brand-500',
    bgActive: 'bg-brand-50 text-brand-800',
  },
  {
    id: 'recutting',
    name: 'Recutting',
    username: 'recutting',
    icon: Scissors,
    accentColor: 'text-brand-700',
    borderActive: 'border-brand-500 ring-1 ring-brand-500',
    bgActive: 'bg-brand-50 text-brand-800',
  },
  {
    id: 'stitching',
    name: 'Stitching',
    username: 'stitching',
    icon: Shirt,
    accentColor: 'text-brand-700',
    borderActive: 'border-brand-500 ring-1 ring-brand-500',
    bgActive: 'bg-brand-50 text-brand-800',
  },
  {
    id: 'finishing',
    name: 'Finishing',
    username: 'finishing',
    icon: Sparkles,
    accentColor: 'text-brand-700',
    borderActive: 'border-brand-500 ring-1 ring-brand-500',
    bgActive: 'bg-brand-50 text-brand-800',
  },
  {
    id: 'steampress',
    name: 'Steam Press',
    username: 'steampress',
    icon: Wind,
    accentColor: 'text-brand-700',
    borderActive: 'border-brand-500 ring-1 ring-brand-500',
    bgActive: 'bg-brand-50 text-brand-800',
  },
  {
    id: 'finalcheck',
    name: 'Final QC',
    username: 'finalcheck',
    icon: CheckCircle2,
    accentColor: 'text-brand-700',
    borderActive: 'border-brand-500 ring-1 ring-brand-500',
    bgActive: 'bg-brand-50 text-brand-800',
  },
  {
    id: 'packing',
    name: 'Packing & Inventory',
    username: 'packing',
    icon: Package,
    accentColor: 'text-brand-700',
    borderActive: 'border-brand-500 ring-1 ring-brand-500',
    bgActive: 'bg-brand-50 text-brand-800',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectStation = (stationUsername: string) => {
    setUsername(stationUsername);
    setPin('');
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

      // The session cookie is set (httpOnly) by the server; only the display profile is cached here.
      localStorage.setItem('subham_mes_user', JSON.stringify(res.user));

      const requested = new URLSearchParams(window.location.search).get('next');
      const isSafeNext =
        !!requested &&
        requested.startsWith('/') &&
        !requested.startsWith('//') &&
        !requested.startsWith('/login') &&
        checkRouteAccess(requested.split('?')[0], res.user).allowed;
      const target = (isSafeNext && requested) || res.user.defaultRedirect || getUserStationHome(res.user);
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
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-canvas overflow-hidden select-none font-sans">

      {/* CENTERED PREMIUM GLASS CARD */}
      <div className="relative z-10 w-full max-w-[560px] bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        
        {/* BRANDING HEADER */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-white p-1.5 border border-neutral-200 flex items-center justify-center mb-3">
            <img
              src="/shubham-logo.jpg"
              alt="Shubham Fabrics"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-base sm:text-lg font-bold tracking-[0.18em] uppercase text-neutral-900">
            Shubham Fabrics
          </h1>
          <span className="mt-1 h-0.5 w-10 rounded-full bg-accent-400" aria-hidden="true" />
          <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-neutral-500 mt-1.5">
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
                      : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isSelected ? station.accentColor : 'text-neutral-500'
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
          <div className="mb-5 p-3 bg-danger-500/10 border border-danger-500/40 rounded-xl text-xs text-danger-700 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-danger-500 shrink-0"></span>
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
                className="w-full pl-10 pr-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40 transition"
              />
              <User className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5" />
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
                className="w-full pl-10 pr-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm text-neutral-900 placeholder-neutral-400 tracking-wider focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40 transition"
              />
              <Lock className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs uppercase tracking-[0.14em] rounded-xl shadow-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin"></div>
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
        <div className="mt-6 pt-4 border-t border-neutral-200 flex flex-col items-center justify-center gap-3">
          <span className="text-[11px] text-neutral-500 tracking-wide">Protected Enterprise Session</span>
        </div>
      </div>
    </div>
  );
}
