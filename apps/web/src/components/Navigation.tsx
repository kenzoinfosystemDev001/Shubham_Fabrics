'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  requiredRole?: string[]; // RBAC restriction
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAVIGATION_TAXONOMY: NavGroup[] = [
  {
    title: 'OVERVIEW',
    items: [
      { id: 'overview', label: 'Overview', href: '/', icon: '📊' },
      { id: 'my-work', label: 'My work', href: '/my-work', icon: '📝' },
      { id: 'floor-board', label: 'Floor board', href: '/shopfloor', icon: '🖥️' },
      { id: 'floor-flow', label: 'Floor flow', href: '/floor-flow', icon: '🔀' },
      { id: 'designs', label: 'Designs', href: '/programs', icon: '🎨' },
    ],
  },
  {
    title: 'STORE',
    items: [
      { id: 'stock', label: 'Stock', href: '/store', icon: '📦' },
      { id: 'receive', label: 'Receive', href: '/store', icon: '📥' },
      { id: 'trims', label: 'Trims', href: '/store', icon: '🧵' },
      { id: 'issue-challan', label: 'Issue challan', href: '/challans', icon: '📄' },
      { id: 'defected-shelf', label: 'Defected shelf', href: '/store', icon: '⚠️' },
    ],
  },
  {
    title: 'INSIGHTS',
    items: [
      { id: 'reports', label: 'Reports', href: '/reports', icon: '📈' },
    ],
  },
  {
    title: 'ADMIN',
    items: [
      { id: 'setup', label: 'Setup', href: '/admin/setup', icon: '⚙️', requiredRole: ['SUPER_ADMIN', 'ADMIN'] },
      { id: 'users', label: 'Users', href: '/admin/users', icon: '👥', requiredRole: ['SUPER_ADMIN', 'ADMIN'] },
      { id: 'departments', label: 'Departments', href: '/masters', icon: '🏭', requiredRole: ['SUPER_ADMIN', 'ADMIN', 'PRODUCTION_MANAGER'] },
      { id: 'masters', label: 'Masters', href: '/masters', icon: '🗄️', requiredRole: ['SUPER_ADMIN', 'ADMIN', 'PRODUCTION_MANAGER'] },
      { id: 'what-changed', label: 'What changed', href: '/audit', icon: '🛡️' },
    ],
  },
];

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  // If on login page, hide navigation
  if (pathname === '/login') {
    return null;
  }

  const [currentUser, setCurrentUser] = useState<any>({
    fullName: 'jitender saini',
    username: 'jitender',
    role: 'STORE_MANAGER',
    departmentCode: 'STORE',
  });
  const [theme, setTheme] = useState<'Auto' | 'Light' | 'Dark'>('Light');
  const [searchQuery, setSearchQuery] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  useEffect(() => {
    // Check saved session
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('subham_mes_user');
      if (savedUser) {
        try {
          setCurrentUser(JSON.parse(savedUser));
        } catch {}
      }
    }

    const syncUser = async () => {
      try {
        if (api.getToken()) {
          const profile = await api.getProfile();
          setCurrentUser(profile);
          if (typeof window !== 'undefined') {
            localStorage.setItem('subham_mes_user', JSON.stringify(profile));
          }
        }
      } catch {
        // Fallback to demo default if offline
      }
    };
    syncUser();
  }, []);

  const handleRoleSwitch = async (username: string) => {
    try {
      const pin = username === 'admin' ? 'Admin@12345' : '1234';
      const res = await api.login({ usernameOrEmail: username, password: pin });
      setCurrentUser(res.user);
      if (typeof window !== 'undefined') {
        localStorage.setItem('subham_mes_token', res.accessToken);
        localStorage.setItem('subham_mes_user', JSON.stringify(res.user));
      }
      setUserDropdownOpen(false);
      window.location.reload();
    } catch (err: any) {
      alert(`Role switch error: ${err.message || err}`);
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('subham_mes_token');
      localStorage.removeItem('subham_mes_user');
    }
    router.push('/login');
  };

  const userInitials = (currentUser?.fullName || 'JS')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const isUserAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN';

  return (
    <>
      {/* ========================================================= */}
      {/* TOP HEADER BAR - Matching Image 2 exactly */}
      {/* ========================================================= */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-[#142340] border-b border-[#1E3258] z-40 flex items-center justify-between px-4 text-white">
        {/* Left Brand Identifier */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            {/* SF Badge */}
            <div className="w-8 h-8 rounded bg-[#1E3A8A] border border-[#2D4E96] flex items-center justify-center font-serif font-black text-amber-300 text-sm shadow-sm group-hover:scale-105 transition-transform">
              SF
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs tracking-wide text-white font-sans leading-none">
                Shubham Fabrics
              </span>
              <span className="text-[9px] font-mono uppercase tracking-wider text-blue-300/80 leading-tight mt-0.5">
                PRODUCTION · MES
              </span>
            </div>
          </Link>

          {/* Active Breadcrumb */}
          <div className="hidden sm:flex items-center text-xs font-medium text-slate-300 pl-4 border-l border-slate-700/60">
            <span>Overview</span>
          </div>
        </div>

        {/* Center Search Pill - Matching Image 2 */}
        <div className="flex-1 max-w-md mx-4 hidden md:block">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
                }
              }}
              placeholder="Find a lot or design"
              className="w-full bg-[#1C2F52] border border-[#2B4370] text-xs text-white placeholder-slate-400 rounded-md pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 font-sans"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
              🔍
            </span>
          </div>
        </div>

        {/* Right Section: Theme Toggle + User Badge */}
        <div className="flex items-center gap-3">
          {/* Theme Segmented Switch: Auto | Light | Dark */}
          <div className="hidden lg:flex items-center bg-[#1A2C4D] border border-[#263E69] rounded p-0.5 text-[11px] font-medium">
            {(['Auto', 'Light', 'Dark'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-2.5 py-0.5 rounded transition ${
                  theme === t
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* User Profile Avatar & Badge - Matching Image 2 */}
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2.5 py-1 px-2 rounded hover:bg-[#1D325A] transition"
            >
              {/* Circular Avatar */}
              <div className="w-7 h-7 rounded-full bg-[#B88746] text-[#142340] font-bold text-xs flex items-center justify-center shadow-xs">
                {userInitials}
              </div>
              <div className="text-left hidden sm:block">
                <span className="text-xs font-semibold text-white block leading-none">
                  {currentUser?.fullName || 'jitender saini'}
                </span>
                <span className="text-[10px] text-slate-300 block capitalize leading-tight mt-0.5">
                  {currentUser?.departmentCode ? currentUser.departmentCode.toLowerCase() : 'Store'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400">▾</span>
            </button>

            {/* User Dropdown Menu */}
            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white text-slate-800 rounded-lg shadow-xl border border-slate-200 py-2 z-50 animate-fade-in text-xs">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="font-semibold text-slate-900">{currentUser?.fullName}</p>
                  <p className="text-[11px] text-slate-500 font-mono">{currentUser?.role}</p>
                  <p className="text-[10px] text-blue-600 font-mono mt-0.5">
                    Affinity: {currentUser?.departmentCode || 'CENTRAL'}
                  </p>
                </div>

                <div className="py-1">
                  <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Switch Persona
                  </span>
                  <button
                    onClick={() => handleRoleSwitch('jitender')}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>jitender saini</span>
                    <span className="text-[10px] text-slate-400">Store</span>
                  </button>
                  <button
                    onClick={() => handleRoleSwitch('admin')}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>Sujal Kumar</span>
                    <span className="text-[10px] text-slate-400">Super Admin</span>
                  </button>
                  <button
                    onClick={() => handleRoleSwitch('prod_manager')}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>Rajesh Sharma</span>
                    <span className="text-[10px] text-slate-400">Planning</span>
                  </button>
                  <button
                    onClick={() => handleRoleSwitch('qc_insp')}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>Vikram Singh</span>
                    <span className="text-[10px] text-slate-400">QC Inspector</span>
                  </button>
                </div>

                <div className="border-t border-slate-100 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-1.5 text-rose-600 hover:bg-rose-50 flex items-center gap-1.5"
                  >
                    <span>🚪</span> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* LEFT SIDEBAR - Matching Image 2 exactly (Deep Navy #142340) */}
      {/* ========================================================= */}
      <aside className="w-56 bg-[#142340] border-r border-[#1E3258] flex flex-col justify-between fixed top-14 bottom-0 left-0 z-30 select-none overflow-y-auto no-scrollbar">
        <div className="py-4 px-3 space-y-6">
          {NAVIGATION_TAXONOMY.map((group) => (
            <div key={group.title} className="space-y-1">
              {/* Category Header */}
              <span className="px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 block mb-1">
                {group.title}
              </span>

              {/* Navigation Items */}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    (item.href === '/' && pathname === '/') ||
                    (item.href !== '/' && pathname.startsWith(item.href));

                  // Role check for RBAC
                  const isRestricted =
                    item.requiredRole &&
                    !isUserAdmin &&
                    !item.requiredRole.includes(currentUser?.role);

                  if (isRestricted) {
                    return (
                      <div
                        key={item.id}
                        title={`Restricted: Requires ${item.requiredRole?.join(' or ')} permission`}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-slate-500 opacity-60 cursor-not-allowed"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-sm">{item.icon}</span>
                          <span>{item.label}</span>
                        </span>
                        <span className="text-[10px]">🔒</span>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition ${
                        isActive
                          ? 'bg-[#1E3A8A] text-white font-semibold shadow-xs'
                          : 'text-slate-300 hover:bg-[#1A2C4D] hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-sm">{item.icon}</span>
                        <span>{item.label}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Station Status Pill */}
        <div className="p-3 border-t border-[#1E3258] bg-[#111D36]/80 text-[10px] font-mono text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>LEDGER SYNCED</span>
          </div>
          <span className="text-blue-300 uppercase">{currentUser?.departmentCode || 'STN-01'}</span>
        </div>
      </aside>
    </>
  );
}
