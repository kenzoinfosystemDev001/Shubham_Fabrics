'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { checkRouteAccess, getUserStationHome } from '@/lib/rbac';
import { MES_DEPARTMENTS, isStationUsername } from '@/lib/departments';
import { DEFAULT_LOGIN_BACKGROUND, loginBackgroundSrc } from '@/lib/branding';
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

type IconType = React.ComponentType<{ className?: string }>;

interface StationOption {
  id: string;
  name: string;
  username: string;
  aliases?: string[];
  icon: IconType;
}

// Icons per department code; names and sign-in usernames come from the shared department list.
const DEPARTMENT_ICONS: Record<string, IconType> = {
  PROGRAMMING: Cpu,
  STORE: Warehouse,
  DYEING: Droplet,
  QC1: CheckCircle2,
  EMBROIDERY: Scissors,
  THREAD_CUTTING: Scissors,
  QC2: CheckCircle2,
  WASHING: Waves,
  QC3: CheckCircle2,
  RECUTTING: Scissors,
  STITCHING: Shirt,
  FINISHING: Sparkles,
  STEAM_PRESS: Wind,
  FINAL_CHECK: CheckCircle2,
  INVENTORY: Package,
};

const STATIONS: StationOption[] = [
  { id: 'admin', name: 'Admin', username: 'admin', icon: Shield },
  ...MES_DEPARTMENTS.map((d) => ({
    id: d.code,
    name: d.shortName,
    username: d.stationId,
    aliases: d.stationAliases,
    icon: DEPARTMENT_ICONS[d.code] || CheckCircle2,
  })),
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

  // Reaching the login page ends any session still open (e.g. pressing Back out of a department), so
  // Back / Forward from here cannot reopen protected pages. Signing in waits for that sign-out first.
  const endingSession = useRef<Promise<void> | null>(null);
  useEffect(() => {
    if (!localStorage.getItem('subham_mes_user')) return;
    localStorage.removeItem('subham_mes_user');
    localStorage.removeItem('subham_mes_token');
    sessionStorage.removeItem('active_department');
    sessionStorage.removeItem('active_department_root');
    endingSession.current = fetch('/api/auth/logout', { method: 'POST' })
      .then(() => undefined)
      .catch(() => undefined);
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await endingSession.current;
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

  const activeStation = STATIONS.find((s) =>
    isStationUsername({ stationId: s.username, stationAliases: s.aliases }, username),
  );

  return (
    <div className="relative min-h-[100dvh] w-full flex items-center justify-center px-4 py-4 sm:px-8 sm:py-6 bg-canvas overflow-x-hidden select-none font-sans">
      {/* ADMIN-MANAGED BACKGROUND (Admin > Login Appearance); the default is layered underneath as fallback. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url("${loginBackgroundSrc()}"), url("${DEFAULT_LOGIN_BACKGROUND}")` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-white/40 to-brand-100/50" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_60%_at_50%_45%,rgba(255,255,255,0.6),transparent)]" />
      </div>

      <main className="relative z-10 w-full max-w-[680px] flex flex-col items-center gap-4 sm:gap-5">
        {/* BRANDING (directly on the background; a soft white glow keeps it legible on any image) */}
        <div className="flex flex-col items-center text-center">
          <img
            src="/shubham-logo-mark.png"
            alt="Shubham Fabrics India Pvt. Ltd."
            width={552}
            height={408}
            className="h-12 sm:h-14 w-auto object-contain mb-2 drop-shadow-[0_0_10px_rgba(255,255,255,0.9)]"
          />
          <h1 className="text-base sm:text-lg font-bold tracking-[0.18em] uppercase text-neutral-900 [text-shadow:0_0_12px_rgba(255,255,255,0.95)]">
            Shubham Fabrics
          </h1>
          <span className="mt-1.5 h-0.5 w-10 rounded-full bg-accent-400" aria-hidden="true" />
        </div>

        {/* STATION SELECTOR (glass tiles directly on the background, no panel behind them) */}
        <div role="group" aria-label="Select your station" className="w-full grid grid-cols-2 min-[420px]:grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-2.5">
          {STATIONS.map((station) => {
            const Icon = station.icon;
            const isSelected = activeStation?.id === station.id;
            return (
              <button
                key={station.id}
                type="button"
                onClick={() => selectStation(station.username)}
                aria-pressed={isSelected}
                className={`relative min-h-[58px] px-2 py-2 rounded-xl border backdrop-blur-md text-center transition-colors duration-200 flex flex-col items-center justify-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 ${
                  isSelected
                    ? 'border-brand-500 ring-1 ring-brand-500 bg-brand-50/90 text-brand-800 shadow-md shadow-brand-700/15'
                    : 'border-white/80 bg-white/65 text-neutral-800 shadow-sm shadow-neutral-900/5 hover:bg-white/85 hover:border-brand-300'
                }`}
              >
                {isSelected && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent-400 ring-1 ring-neutral-900/20" aria-hidden="true" />
                )}
                <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-brand-700' : 'text-neutral-600'}`} />
                <span className="text-[11px] sm:text-xs font-semibold leading-tight break-words">{station.name}</span>
              </button>
            );
          })}
        </div>

        {/* SIGN-IN (directly on the background; the inputs themselves are frosted for readability) */}
        <div className="w-full max-w-[420px]">
          {/* ERROR MESSAGE */}
          {error && (
            <div className="mb-3 p-3 bg-danger-50/95 backdrop-blur-md border border-danger-500/40 rounded-xl text-xs text-danger-700 shadow-sm flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-danger-500 shrink-0"></span>
              <span>{error}</span>
            </div>
          )}

          {/* SIGN IN FORM */}
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <div className="relative">
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Station ID"
                  className="w-full pl-10 pr-4 py-3 bg-white/85 backdrop-blur-md border border-white/80 shadow-sm shadow-neutral-900/5 rounded-xl text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40 transition"
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
                  className="w-full pl-10 pr-4 py-3 bg-white/85 backdrop-blur-md border border-white/80 shadow-sm shadow-neutral-900/5 rounded-xl text-sm text-neutral-900 placeholder-neutral-400 tracking-wider focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40 transition"
                />
                <Lock className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-1 py-3.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs uppercase tracking-[0.14em] rounded-xl shadow-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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

          <p className="mt-3 text-center text-[11px] text-neutral-700 tracking-wide [text-shadow:0_0_8px_rgba(255,255,255,0.95)]">Protected Enterprise Session</p>
        </div>
      </main>
    </div>
  );
}
