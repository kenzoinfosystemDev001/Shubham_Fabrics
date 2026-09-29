'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';

export function Navigation() {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<any>({
    fullName: 'Sujal Kumar',
    username: 'admin',
    role: 'SUPER_ADMIN',
    departmentCode: 'STORE',
  });
  const [systemHealth, setSystemHealth] = useState<'checking' | 'healthy' | 'offline'>('checking');

  useEffect(() => {
    // Attempt auto-login or health check
    const init = async () => {
      try {
        const health = await api.getHealth();
        setSystemHealth(health.status === 'ok' ? 'healthy' : 'offline');

        // Check if token exists or login default admin for seamless session
        if (!api.getToken()) {
          const authRes = await api.login({
            usernameOrEmail: 'admin',
            password: 'Admin@12345',
          });
          setCurrentUser(authRes.user);
        } else {
          try {
            const profile = await api.getProfile();
            setCurrentUser(profile);
          } catch {
            const authRes = await api.login({
              usernameOrEmail: 'admin',
              password: 'Admin@12345',
            });
            setCurrentUser(authRes.user);
          }
        }
      } catch (err) {
        console.error('API connection check failed:', err);
        setSystemHealth('offline');
      }
    };
    init();
  }, []);

  const handleRoleSwitch = async (username: string) => {
    try {
      const res = await api.login({
        usernameOrEmail: username,
        password: 'Admin@12345',
      });
      setCurrentUser(res.user);
      window.location.reload();
    } catch (err) {
      alert(`Role switch error: ${err}`);
    }
  };

  const navLinks = [
    { href: '/', label: 'Executive Dashboard', icon: '📊' },
    { href: '/programs', label: 'Program Files', icon: '📋' },
    { href: '/challans', label: 'Challan System', icon: '📜' },
    { href: '/shopfloor', label: 'Shop-Floor Stations', icon: '🏭' },
    { href: '/quality', label: 'Quality Gates (QC)', icon: '🔍' },
    { href: '/audit', label: 'Audit & Traceability', icon: '🛡️' },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between h-screen sticky top-0 shrink-0 no-print">
      <div>
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold tracking-wider text-slate-100 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              SUBHAM FABRICS
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Garment MES Enterprise v1.0</p>
          </div>
          <div className="text-right">
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                systemHealth === 'healthy'
                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                  : 'bg-rose-950/80 text-rose-400 border-rose-800'
              }`}
            >
              {systemHealth === 'healthy' ? 'API: ONLINE' : 'API: CONNECTING'}
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="text-base">{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Operator Session & Role Switcher */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Station Identity</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
            {currentUser?.departmentCode || 'CENTRAL'}
          </span>
        </div>
        <p className="text-xs font-semibold text-slate-100 truncate">{currentUser?.fullName}</p>
        <p className="text-[11px] text-emerald-400 font-mono mt-0.5">{currentUser?.role}</p>

        {/* Quick Role Switcher for RBAC verification */}
        <div className="mt-3">
          <label className="text-[10px] text-slate-400 block mb-1">Switch Operator Persona:</label>
          <select
            className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500"
            value={currentUser?.username}
            onChange={(e) => handleRoleSwitch(e.target.value)}
          >
            <option value="admin">Admin (Sujal Kumar - SUPER_ADMIN)</option>
            <option value="prod_manager">Rajesh Sharma (PRODUCTION_MANAGER)</option>
            <option value="store_sup">Mohan Verma (STORE_SUPERVISOR)</option>
            <option value="cut_sup">Arun Patel (CUTTING_SUPERVISOR)</option>
            <option value="stitch_sup">Suresh Nair (STITCHING_SUPERVISOR)</option>
            <option value="qc_insp">Vikram Singh (QC_INSPECTOR)</option>
            <option value="finish_sup">Dinesh Yadav (FINISHING_SUPERVISOR)</option>
            <option value="pack_sup">Manoj Gupta (PACKING_SUPERVISOR)</option>
            <option value="dispatch_mgr">Karan Mehta (DISPATCH_MANAGER)</option>
          </select>
        </div>
      </div>
    </aside>
  );
}
