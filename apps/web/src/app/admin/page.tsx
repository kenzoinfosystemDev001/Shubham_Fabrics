'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Users,
  FileText,
  Truck,
  Building,
  Layers,
  Boxes,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Building2,
  LogOut,
  ExternalLink,
  Printer,
  Search,
  RefreshCw,
  KeyRound,
  UserPlus
} from 'lucide-react';
import { api } from '@/lib/api';
import { getCurrentUser, isAdminUser } from '@/lib/rbac';
import { ShubhamLogo } from '@/components/ShubhamLogo';
import { printProductionSheet } from '@/lib/download-production-sheet';

export default function AdminConsolePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'programs' | 'challans' | 'suppliers' | 'fabrics' | 'stocks'>('users');
  const [loading, setLoading] = useState(true);

  // Data states
  const [users, setUsers] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [challans, setChallans] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [fabrics, setFabrics] = useState<any[]>([]);
  const [stocksData, setStocksData] = useState<any>(null);

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Modals & form states
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    fullName: '',
    pin: '1234',
    departmentCode: 'PROGRAMMING',
    roleCode: 'PROGRAMMING_INCHARGE',
    email: '',
  });

  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    code: '',
    contactPerson: '',
    phone: '',
    email: '',
    taxNumber: '',
  });

  const [showAddFabricModal, setShowAddFabricModal] = useState(false);
  const [newFabric, setNewFabric] = useState({
    name: '',
    code: '',
    fabricType: 'KNIT_PIQUE',
    composition: '100% Cotton',
    widthInInches: 60,
    gsm: 220,
    weaveType: 'Single Jersey',
  });

  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Load all admin data
  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, programsRes, challansRes, suppliersRes, fabricsRes, stocksRes] = await Promise.all([
        fetch('/api/admin/users').then((r) => r.json()).catch(() => []),
        fetch('/api/programs').then((r) => r.json()).catch(() => []),
        fetch('/api/challans').then((r) => r.json()).catch(() => []),
        fetch('/api/admin/suppliers').then((r) => r.json()).catch(() => []),
        fetch('/api/admin/fabrics').then((r) => r.json()).catch(() => []),
        fetch('/api/admin/stocks').then((r) => r.json()).catch(() => null),
      ]);

      setUsers(Array.isArray(usersRes) ? usersRes : []);
      setPrograms(Array.isArray(programsRes) ? programsRes : []);
      setChallans(Array.isArray(challansRes) ? challansRes : []);
      setSuppliers(Array.isArray(suppliersRes) ? suppliersRes : []);
      setFabrics(Array.isArray(fabricsRes) ? fabricsRes : []);
      setStocksData(stocksRes);
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.push('/login');
      return;
    }
    if (!isAdminUser(user)) {
      router.push(user.departmentCode === 'STORE' ? '/fabric-store' : '/');
      return;
    }
    setCurrentUser(user);
    loadData();
  }, [router]);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Add User handler
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');

      showNotification(`User "${newUser.username}" created successfully.`);
      setShowAddUserModal(false);
      setNewUser({
        username: '',
        fullName: '',
        pin: '1234',
        departmentCode: 'PROGRAMMING',
        roleCode: 'PROGRAMMING_INCHARGE',
        email: '',
      });
      loadData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  // Delete User handler
  const handleDeleteUser = async (id: string, username: string) => {
    if (!confirm(`Are you sure you want to delete / deactivate user "${username}"?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');
      showNotification(`User "${username}" removed successfully.`);
      loadData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  // Delete Program Sheet handler (Admin remove capability)
  const handleDeleteProgram = async (id: string, progNo: string) => {
    if (!confirm(`Are you sure you want to completely remove Production Sheet "${progNo}"? This action will permanently remove it and all linked records from the database.`)) return;
    try {
      const res = await fetch(`/api/programs/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete program');
      showNotification(`Production Sheet "${progNo}" permanently removed.`);
      loadData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  // Delete Challan handler (Admin remove capability)
  const handleDeleteChallan = async (id: string, challanNo: string) => {
    if (!confirm(`Are you sure you want to permanently delete Challan "${challanNo}"? This action will permanently remove it from the database.`)) return;
    try {
      const res = await fetch(`/api/challans/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete challan');
      showNotification(`Challan "${challanNo}" permanently deleted.`);
      loadData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  // Delete ALL Program Sheets (Admin only)
  const handleDeleteAllPrograms = async () => {
    const confirmation = prompt('DANGER: This will permanently delete ALL production sheets and all linked records from the database.\n\nType "DELETE ALL" to confirm:');
    if (confirmation !== 'DELETE ALL') {
      if (confirmation !== null) alert('Action cancelled. Deletion code did not match.');
      return;
    }
    try {
      setLoading(true);
      const res = await fetch('/api/admin/programs/delete-all', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete all programs');
      showNotification('All production sheets permanently deleted from database.');
      loadData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Delete ALL Challans (Admin only)
  const handleDeleteAllChallans = async () => {
    const confirmation = prompt('DANGER: This will permanently delete ALL factory challans and movement records from the database.\n\nType "DELETE ALL" to confirm:');
    if (confirmation !== 'DELETE ALL') {
      if (confirmation !== null) alert('Action cancelled. Deletion code did not match.');
      return;
    }
    try {
      setLoading(true);
      const res = await fetch('/api/admin/challans/delete-all', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete all challans');
      showNotification('All challans permanently deleted from database.');
      loadData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Create Supplier handler
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSupplier),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create supplier');
      showNotification(`Supplier "${newSupplier.name}" added successfully.`);
      setShowAddSupplierModal(false);
      setNewSupplier({ name: '', code: '', contactPerson: '', phone: '', email: '', taxNumber: '' });
      loadData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  // Create Fabric handler
  const handleCreateFabric = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/fabrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFabric),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add fabric');
      showNotification(`Fabric "${newFabric.name}" registered.`);
      setShowAddFabricModal(false);
      setNewFabric({
        name: '',
        code: '',
        fabricType: 'KNIT_PIQUE',
        composition: '100% Cotton',
        widthInInches: 60,
        gsm: 220,
        weaveType: 'Single Jersey',
      });
      loadData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleSignOut = () => {
    api.clearToken();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('subham_mes_token');
      localStorage.removeItem('subham_mes_user');
      document.cookie = 'subham_mes_token=; path=/; max-age=0';
      document.cookie = 'subham_mes_role=; path=/; max-age=0';
      document.cookie = 'subham_mes_dept=; path=/; max-age=0';
    }
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col">
      {/* TOP HEADER */}
      <header className="bg-[#0F172A] text-white border-b border-slate-800 px-6 py-3.5 sticky top-0 z-40 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-white p-0.5 border border-indigo-500/40 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
            <img src="/shubham-logo.jpg" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-[0.16em] text-white uppercase">
                SHUBHAM FABRICS INDIA PVT. LTD.
              </span>
              <span className="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Admin Console
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Manufacturing Execution System · Full Factory Access
            </p>
          </div>
        </div>

        {/* WORKSPACE SWITCHER & CONTROLS */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Programming</span>
          </Link>

          <Link
            href="/fabric-store"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/30 hover:bg-teal-500/20 transition"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Fabric Store</span>
          </Link>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-200 border border-slate-700 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* NOTIFICATION TOAST */}
      {actionMessage && (
        <div
          className={`fixed top-16 right-6 z-50 px-4 py-3 rounded-xl shadow-xl border flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-4 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* SUB-HEADER / KPI STRIP */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              Enterprise Administration &amp; Master Control
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Role-Based Architecture (RBAC), User Credentials, Program Sheets, Challans, Suppliers, Fabrics, and Inventory.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAddUserModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add User</span>
            </button>
            <Link
              href="/my-work/create-production-sheet"
              className="flex items-center gap-1.5 px-3 py-2 bg-[#163767] hover:bg-[#0F264A] text-white rounded-lg text-xs font-semibold shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Program Sheet</span>
            </Link>
            <Link
              href="/my-work/issue-challan"
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Issue Challan</span>
            </Link>
          </div>
        </div>

        {/* TABS */}
        <div className="flex items-center gap-1 border-t border-slate-100 mt-4 pt-3 overflow-x-auto">
          {[
            { id: 'users', label: 'Users & RBAC', icon: Users, count: users.length },
            { id: 'programs', label: 'Program Sheets', icon: FileText, count: programs.length },
            { id: 'challans', label: 'Challans', icon: Truck, count: challans.length },
            { id: 'suppliers', label: 'Suppliers', icon: Building, count: suppliers.length },
            { id: 'fabrics', label: 'Fabrics Master', icon: Layers, count: fabrics.length },
            { id: 'stocks', label: 'Stocks & Inventory', icon: Boxes, count: stocksData?.summary?.totalRolls },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition shrink-0 ${
                  active
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-amber-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      active ? 'bg-slate-800 text-amber-300' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-600" />
            <p className="text-xs font-medium">Loading MES Administration Data...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: USERS & RBAC */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Factory Users &amp; Role-Based Architecture (RBAC)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Manage usernames, PINs, departmental affinities, and station access.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddUserModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create User</span>
                  </button>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4 font-bold">Username</th>
                        <th className="py-3 px-4 font-bold">Full Name</th>
                        <th className="py-3 px-4 font-bold">Assigned Department</th>
                        <th className="py-3 px-4 font-bold">Security Role</th>
                        <th className="py-3 px-4 font-bold">Station PIN</th>
                        <th className="py-3 px-4 font-bold">Status</th>
                        <th className="py-3 px-4 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 font-mono font-bold text-indigo-950">
                            {u.username}
                          </td>
                          <td className="py-3 px-4 text-slate-800 font-medium">{u.fullName}</td>
                          <td className="py-3 px-4">
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                              {u.departmentCode || 'STORE'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                u.role.includes('ADMIN')
                                  ? 'bg-purple-100 text-purple-800'
                                  : u.departmentCode === 'PROGRAMMING'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-teal-100 text-teal-800'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500">
                            •••• (Encrypted PIN)
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                u.isActive
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {u.username !== 'admin' ? (
                              <button
                                onClick={() => handleDeleteUser(u.id, u.username)}
                                className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition"
                                title="Delete User"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">Protected</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: PRODUCTION SHEETS (ADD / REMOVE) */}
            {activeTab === 'programs' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Master Production Sheets
                    </h2>
                    <p className="text-xs text-slate-500">
                      View, print traveler cards, and delete/remove production sheets.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDeleteAllPrograms}
                      disabled={programs.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold shadow-xs transition"
                      title="Permanently Delete All Production Sheets"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete All Sheets</span>
                    </button>
                    <Link
                      href="/my-work/create-production-sheet"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#163767] hover:bg-[#0F264A] text-white rounded-lg text-xs font-semibold shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Production Sheet</span>
                    </Link>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4 font-bold">Sheet / Program #</th>
                        <th className="py-3 px-4 font-bold">Client / Buyer</th>
                        <th className="py-3 px-4 font-bold">Style Code / Design</th>
                        <th className="py-3 px-4 font-bold">Fabric Spec</th>
                        <th className="py-3 px-4 font-bold">Quantity</th>
                        <th className="py-3 px-4 font-bold">Status</th>
                        <th className="py-3 px-4 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {programs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            No production sheets found. Click "+ Add Production Sheet" to create one.
                          </td>
                        </tr>
                      ) : (
                        programs.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4 font-mono font-bold text-[#163767]">
                              {p.programSerialNo || p.programNumber}
                            </td>
                            <td className="py-3 px-4 text-slate-800 font-medium">
                              {p.clientName || p.buyerName || '—'}
                            </td>
                            <td className="py-3 px-4 text-slate-700">
                              {p.mainStyle || p.styleCode} {p.designNumber ? `· ${p.designNumber}` : ''}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {p.fabricName || 'Standard Pique'} {p.fabricColor ? `(${p.fabricColor})` : ''}
                            </td>
                            <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                              {p.colorQuantity || p.targetQuantity} {p.quantityMeasurement || 'PCS'}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800">
                                {p.status || 'DRAFT'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => printProductionSheet(p)}
                                  className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                                  title="Print Traveler Sheet"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteProgram(p.id, p.programSerialNo || p.programNumber)}
                                  className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded"
                                  title="Delete / Remove Production Sheet"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: CHALLANS */}
            {activeTab === 'challans' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Factory Challans &amp; Material Movement
                    </h2>
                    <p className="text-xs text-slate-500">
                      Track inter-department dispatches and station handoffs.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDeleteAllChallans}
                      disabled={challans.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold shadow-xs transition"
                      title="Permanently Delete All Factory Challans"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete All Challans</span>
                    </button>
                    <Link
                      href="/my-work/issue-challan"
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                    >
                      + Programming Challan
                    </Link>
                    <Link
                      href="/fabric-store/my-work/issue-challan"
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                    >
                      + Fabric Store Challan
                    </Link>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4 font-bold">Challan Number</th>
                        <th className="py-3 px-4 font-bold">Date</th>
                        <th className="py-3 px-4 font-bold">Source Dept</th>
                        <th className="py-3 px-4 font-bold">Destination Dept</th>
                        <th className="py-3 px-4 font-bold">Program #</th>
                        <th className="py-3 px-4 font-bold">Status</th>
                        <th className="py-3 px-4 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {challans.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            No challans recorded yet.
                          </td>
                        </tr>
                      ) : (
                        challans.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">
                              {c.challanNumber}
                            </td>
                            <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                              {new Date(c.createdAt || Date.now()).toLocaleDateString('en-IN')}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                {c.fromDepartment || c.fromDeptRel?.code || 'PROGRAMMING'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-900 border border-teal-200">
                                {c.toDepartment || c.toDeptRel?.code || 'STORE'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-700">
                              {c.program?.programSerialNo || c.program?.programNumber || '—'}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                                {c.status || 'ISSUED'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Link
                                  href={`/challans/${c.id}`}
                                  className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                                  title="View / Print Slip"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </Link>
                                <button
                                  onClick={() => handleDeleteChallan(c.id, c.challanNumber)}
                                  className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded"
                                  title="Permanently Delete Challan"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: SUPPLIERS */}
            {activeTab === 'suppliers' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Supplier Master Directory
                    </h2>
                    <p className="text-xs text-slate-500">
                      Approved mills, yarn suppliers, and fabric vendors.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddSupplierModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Supplier</span>
                  </button>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4 font-bold">Code</th>
                        <th className="py-3 px-4 font-bold">Supplier Name</th>
                        <th className="py-3 px-4 font-bold">Contact Person</th>
                        <th className="py-3 px-4 font-bold">Phone</th>
                        <th className="py-3 px-4 font-bold">Email</th>
                        <th className="py-3 px-4 font-bold">GSTIN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {suppliers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            No suppliers registered yet.
                          </td>
                        </tr>
                      ) : (
                        suppliers.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4 font-mono font-bold text-indigo-950">{s.code}</td>
                            <td className="py-3 px-4 font-semibold text-slate-800">{s.name}</td>
                            <td className="py-3 px-4 text-slate-600">{s.contactPerson || '—'}</td>
                            <td className="py-3 px-4 font-mono text-slate-600">{s.phone || '—'}</td>
                            <td className="py-3 px-4 text-slate-600">{s.email || '—'}</td>
                            <td className="py-3 px-4 font-mono text-slate-600">{s.taxNumber || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 5: FABRICS MASTER */}
            {activeTab === 'fabrics' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Fabric Specifications Catalog
                    </h2>
                    <p className="text-xs text-slate-500">
                      Standard mill specs, compositions, weave types, and GSM weights.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddFabricModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Fabric Spec</span>
                  </button>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4 font-bold">Code</th>
                        <th className="py-3 px-4 font-bold">Fabric Name</th>
                        <th className="py-3 px-4 font-bold">Type</th>
                        <th className="py-3 px-4 font-bold">Composition</th>
                        <th className="py-3 px-4 font-bold">GSM</th>
                        <th className="py-3 px-4 font-bold">Width (Inches)</th>
                        <th className="py-3 px-4 font-bold">Supplier</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fabrics.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            No fabric specs registered yet.
                          </td>
                        </tr>
                      ) : (
                        fabrics.map((f) => (
                          <tr key={f.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">{f.code}</td>
                            <td className="py-3 px-4 font-semibold text-slate-800">{f.name}</td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-600">{f.fabricType}</td>
                            <td className="py-3 px-4 text-slate-700">{f.composition}</td>
                            <td className="py-3 px-4 font-mono text-slate-800">{f.gsm} gsm</td>
                            <td className="py-3 px-4 font-mono text-slate-800">{f.widthInInches}&quot;</td>
                            <td className="py-3 px-4 text-slate-600">{f.supplier?.name || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 6: STOCKS & INVENTORY */}
            {activeTab === 'stocks' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Factory Stocks &amp; Inventory Telemetry
                    </h2>
                    <p className="text-xs text-slate-500">
                      Live fabric rolls, batches, and stock distribution.
                    </p>
                  </div>
                  <Link
                    href="/fabric-store/inventory/stock"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Fabric Store Inventory</span>
                  </Link>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Total Fabric Rolls
                    </span>
                    <div className="text-2xl font-bold font-mono text-slate-900">
                      {stocksData?.summary?.totalRolls || 0}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Total Fabric Length
                    </span>
                    <div className="text-2xl font-bold font-mono text-teal-700">
                      {(stocksData?.summary?.totalMeters || 0).toLocaleString()} Mtr
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Total Net Weight
                    </span>
                    <div className="text-2xl font-bold font-mono text-indigo-700">
                      {(stocksData?.summary?.totalWeightKg || 0).toLocaleString()} Kg
                    </div>
                  </div>
                </div>

                {/* Rolls Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Rolls In Stock</span>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2.5 px-4 font-bold">Roll Barcode</th>
                        <th className="py-2.5 px-4 font-bold">Batch #</th>
                        <th className="py-2.5 px-4 font-bold">Fabric Name</th>
                        <th className="py-2.5 px-4 font-bold">Color</th>
                        <th className="py-2.5 px-4 font-bold">Length</th>
                        <th className="py-2.5 px-4 font-bold">Weight</th>
                        <th className="py-2.5 px-4 font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(stocksData?.rolls || []).slice(0, 20).map((r: any) => (
                        <tr key={r.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{r.barcode}</td>
                          <td className="py-2.5 px-4 font-mono text-slate-600">{r.batchNumber}</td>
                          <td className="py-2.5 px-4 text-slate-800 font-medium">{r.fabricName}</td>
                          <td className="py-2.5 px-4 text-slate-700">{r.color}</td>
                          <td className="py-2.5 px-4 font-mono font-semibold text-teal-700">{r.lengthMeters} M</td>
                          <td className="py-2.5 px-4 font-mono text-slate-600">{r.netWeightKg} kg</td>
                          <td className="py-2.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL: ADD USER */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-600" />
              Add New Factory User (RBAC)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Assign username, station PIN, department affinity, and security role.
            </p>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. cutting_op, dyeing_sup..."
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patel"
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Station PIN *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="1234"
                    value={newUser.pin}
                    onChange={(e) => setNewUser({ ...newUser, pin: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono tracking-widest focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department *
                  </label>
                  <select
                    value={newUser.departmentCode}
                    onChange={(e) => setNewUser({ ...newUser, departmentCode: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                  >
                    <option value="PROGRAMMING">PROGRAMMING</option>
                    <option value="STORE">FABRIC STORE</option>
                    <option value="DYEING">DYEING</option>
                    <option value="EMBROIDERY">EMBROIDERY</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Security Role *
                </label>
                <select
                  value={newUser.roleCode}
                  onChange={(e) => setNewUser({ ...newUser, roleCode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                >
                  <option value="PROGRAMMING_INCHARGE">PROGRAMMING_INCHARGE</option>
                  <option value="FABRIC_STORE">FABRIC_STORE</option>
                  <option value="ADMIN">ADMIN (Full Access)</option>
                  <option value="DYEING_OPERATOR">DYEING_OPERATOR</option>
                  <option value="EMBROIDERY_OPERATOR">EMBROIDERY_OPERATOR</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                >
                  Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD SUPPLIER */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Building className="w-5 h-5 text-indigo-600" />
              Add Approved Supplier
            </h3>
            <p className="text-xs text-slate-500 mb-4">Register a mill or raw material vendor.</p>

            <form onSubmit={handleCreateSupplier} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vardhman Textiles Ltd."
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Supplier Code
                  </label>
                  <input
                    type="text"
                    placeholder="SUP-001"
                    value={newSupplier.code}
                    onChange={(e) => setNewSupplier({ ...newSupplier, code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="Mr. Sharma"
                    value={newSupplier.contactPerson}
                    onChange={(e) => setNewSupplier({ ...newSupplier, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    placeholder="07AAAAA0000A1Z5"
                    value={newSupplier.taxNumber}
                    onChange={(e) => setNewSupplier({ ...newSupplier, taxNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono uppercase focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD FABRIC */}
      {showAddFabricModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              Add Fabric Specification
            </h3>
            <p className="text-xs text-slate-500 mb-4">Register new fabric type into catalog.</p>

            <form onSubmit={handleCreateFabric} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fabric Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 100% Cotton Bio-Washed Pique"
                  value={newFabric.name}
                  onChange={(e) => setNewFabric({ ...newFabric, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Composition
                  </label>
                  <input
                    type="text"
                    placeholder="100% Cotton"
                    value={newFabric.composition}
                    onChange={(e) => setNewFabric({ ...newFabric, composition: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fabric Type
                  </label>
                  <select
                    value={newFabric.fabricType}
                    onChange={(e) => setNewFabric({ ...newFabric, fabricType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                  >
                    <option value="KNIT_PIQUE">KNIT_PIQUE</option>
                    <option value="SINGLE_JERSEY">SINGLE_JERSEY</option>
                    <option value="FLEECE">FLEECE</option>
                    <option value="RIB">RIB</option>
                    <option value="WOVEN_TWILL">WOVEN_TWILL</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    GSM (Weight)
                  </label>
                  <input
                    type="number"
                    placeholder="220"
                    value={newFabric.gsm}
                    onChange={(e) => setNewFabric({ ...newFabric, gsm: parseFloat(e.target.value) || 220 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Width (Inches)
                  </label>
                  <input
                    type="number"
                    placeholder="60"
                    value={newFabric.widthInInches}
                    onChange={(e) => setNewFabric({ ...newFabric, widthInInches: parseFloat(e.target.value) || 60 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddFabricModal(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                >
                  Save Fabric
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
