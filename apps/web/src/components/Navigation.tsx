'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';

interface NavGroup {
  title: string;
  icon: string;
  items: {
    label: string;
    href: string;
    isLive?: boolean;
  }[];
}

const NAVIGATION_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    icon: '📊',
    items: [
      { label: 'Executive Dashboard', href: '/', isLive: true },
    ],
  },
  {
    title: 'Production',
    icon: '📋',
    items: [
      { label: 'Program Files', href: '/programs', isLive: true },
      { label: 'Floor Board & WIP', href: '/shopfloor', isLive: true },
      { label: 'Cut Bundles & Pieces', href: '/bundles', isLive: true },
      { label: 'Challan System', href: '/challans', isLive: true },
      { label: 'FG & Dispatch Logistics', href: '/dispatch', isLive: true },
    ],
  },
  {
    title: 'Store',
    icon: '📦',
    items: [
      { label: 'Fabric Rolls & Stock', href: '/store', isLive: true },
      { label: 'Immutable Stock Ledger', href: '/store', isLive: true },
      { label: 'Receive Inward', href: '/challans', isLive: true },
      { label: 'Trims Catalog', href: '/masters', isLive: true },
      { label: 'Issue Challan', href: '/challans', isLive: true },
    ],
  },
  {
    title: 'Quality',
    icon: '🔍',
    items: [
      { label: 'QC Queue & Gates', href: '/quality', isLive: true },
      { label: 'Inspections', href: '/quality', isLive: true },
      { label: 'Defect Registry', href: '/masters', isLive: true },
      { label: 'Rework Queue', href: '/quality', isLive: true },
      { label: 'Rejections Log', href: '/quality', isLive: true },
    ],
  },
  {
    title: 'Insights',
    icon: '📈',
    items: [
      { label: 'Production Reports', href: '/future?module=Production+Reports&phase=Phase+3' },
      { label: 'Quality Analytics', href: '/future?module=Quality+Analytics&phase=Phase+3' },
      { label: 'Inventory Analytics', href: '/future?module=Inventory+Analytics&phase=Phase+3' },
      { label: 'Department Performance', href: '/future?module=Department+Performance&phase=Phase+3' },
    ],
  },
  {
    title: 'Administration',
    icon: '⚙️',
    items: [
      { label: 'Master Data Hub', href: '/masters', isLive: true },
      { label: 'Departments & Routes', href: '/masters', isLive: true },
      { label: 'Audit Trail & Traceability', href: '/audit', isLive: true },
      { label: 'Users & Roles', href: '/future?module=User+Directory&phase=Phase+1' },
      { label: 'System Configuration', href: '/future?module=MES+Settings&phase=Phase+1' },
    ],
  },
];

export function Navigation() {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<any>({
    fullName: 'Sujal Kumar',
    username: 'admin',
    role: 'SUPER_ADMIN',
    departmentCode: 'STORE',
  });
  const [systemHealth, setSystemHealth] = useState<'checking' | 'healthy' | 'offline'>('checking');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Overview: true,
    Production: true,
    Store: false,
    Quality: true,
    Insights: false,
    Administration: true,
  });

  useEffect(() => {
    const init = async () => {
      try {
        const health = await api.getHealth();
        setSystemHealth(health.status === 'ok' ? 'healthy' : 'offline');

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

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

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

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between h-screen sticky top-0 shrink-0 no-print overflow-hidden">
      <div className="flex flex-col h-full overflow-hidden">
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800 shrink-0 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold tracking-wider text-slate-100 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              SUBHAM FABRICS
            </h1>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">Garment MES Enterprise</p>
          </div>
          <div className="text-right">
            <span
              className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                systemHealth === 'healthy'
                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                  : 'bg-rose-950/80 text-rose-400 border-rose-800'
              }`}
            >
              {systemHealth === 'healthy' ? 'ONLINE' : 'CONNECTING'}
            </span>
          </div>
        </div>

        {/* Scrollable Navigation Groups */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
          {NAVIGATION_GROUPS.map((group) => {
            const isOpen = openSections[group.title] ?? true;
            return (
              <div key={group.title} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleSection(group.title)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-200 uppercase tracking-wider transition rounded hover:bg-slate-850"
                >
                  <span className="flex items-center gap-1.5">
                    <span>{group.icon}</span>
                    <span>{group.title}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">{isOpen ? '▾' : '▸'}</span>
                </button>

                {isOpen && (
                  <div className="pl-3 space-y-0.5 border-l border-slate-800 ml-2">
                    {group.items.map((item) => {
                      const isActive =
                        pathname === item.href ||
                        (item.href !== '/' && item.href.startsWith('/programs') && pathname.startsWith('/programs')) ||
                        (item.href !== '/' && item.href.startsWith('/challans') && pathname.startsWith('/challans')) ||
                        (item.href !== '/' && item.href.startsWith('/masters') && pathname.startsWith('/masters')) ||
                        (item.href !== '/' && item.href.startsWith('/quality') && pathname.startsWith('/quality')) ||
                        (item.href !== '/' && item.href.startsWith('/audit') && pathname.startsWith('/audit')) ||
                        (item.href !== '/' && item.href.startsWith('/shopfloor') && pathname.startsWith('/shopfloor'));

                      return (
                        <Link
                          key={item.label}
                          href={item.href}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-medium transition ${
                            isActive
                              ? 'bg-blue-600 text-white font-semibold shadow-sm'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <span className="truncate">{item.label}</span>
                          {item.isLive ? (
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                              LIVE
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono text-slate-500">
                              ROADMAP
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Operator Session & Role Switcher */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Persona Identity</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
              {currentUser?.departmentCode || 'CENTRAL'}
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-100 truncate">{currentUser?.fullName}</p>
          <p className="text-[10px] text-emerald-400 font-mono">{currentUser?.role}</p>

          <div className="mt-2">
            <select
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-blue-500 font-mono"
              value={currentUser?.username}
              onChange={(e) => handleRoleSwitch(e.target.value)}
            >
              <option value="admin">Sujal Kumar (SUPER_ADMIN)</option>
              <option value="prod_manager">Rajesh Sharma (PROD_MANAGER)</option>
              <option value="store_sup">Mohan Verma (STORE_SUP)</option>
              <option value="cut_sup">Arun Patel (CUTTING_SUP)</option>
              <option value="stitch_sup">Suresh Nair (STITCHING_SUP)</option>
              <option value="qc_insp">Vikram Singh (QC_INSPECTOR)</option>
              <option value="finish_sup">Dinesh Yadav (FINISHING_SUP)</option>
              <option value="pack_sup">Manoj Gupta (PACKING_SUP)</option>
              <option value="dispatch_mgr">Karan Mehta (DISPATCH_MGR)</option>
            </select>
          </div>
        </div>
      </div>
    </aside>
  );
}
