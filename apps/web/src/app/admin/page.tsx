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
  UserPlus,
  Pencil,
  Image as ImageIcon,
  Palette
} from 'lucide-react';
import { api } from '@/lib/api';
import { getCurrentUser, isAdminUser } from '@/lib/rbac';
import { ShubhamLogo } from '@/components/ShubhamLogo';
import { AppearancePanel, SidebarImagePanel } from '@/components/admin/LoginAppearancePanel';
import { printProductionSheet } from '@/lib/download-production-sheet';

// Every department a user can belong to, with the role a new user there normally gets.
const DEPARTMENT_OPTIONS = [
  { code: 'ADMIN', label: 'Administration', defaultRole: 'ADMIN' },
  { code: 'PROGRAMMING', label: 'Programming', defaultRole: 'PROGRAMMING_INCHARGE' },
  { code: 'STORE', label: 'Fabric Store', defaultRole: 'FABRIC_STORE' },
  { code: 'DYEING', label: 'Dyeing', defaultRole: 'DYEING_INCHARGE' },
  { code: 'QC1', label: 'Dyeing QC (QC1)', defaultRole: 'QC1_INSPECTOR' },
  { code: 'EMBROIDERY', label: 'Embroidery', defaultRole: 'EMBROIDERY_INCHARGE' },
  { code: 'THREAD_CUTTING', label: 'Thread Cutting', defaultRole: 'THREAD_CUTTING_INCHARGE' },
  { code: 'QC2', label: 'Threadcut QC', defaultRole: 'QC2_INSPECTOR' },
  { code: 'WASHING', label: 'Washing', defaultRole: 'WASHING_INCHARGE' },
  { code: 'QC3', label: 'Washing QC', defaultRole: 'QC3_INSPECTOR' },
  { code: 'RECUTTING', label: 'Recutting', defaultRole: 'RECUTTING_SUPERVISOR' },
  { code: 'STITCHING', label: 'Stitching', defaultRole: 'STITCHING_SUPERVISOR' },
  { code: 'FINISHING', label: 'Finishing', defaultRole: 'FINISHING_SUPERVISOR' },
  { code: 'STEAM_PRESS', label: 'Steam Press', defaultRole: 'STEAM_PRESS_SUPERVISOR' },
  { code: 'FINAL_CHECK', label: 'Final QC', defaultRole: 'FINAL_CHECK_INSPECTOR' },
  { code: 'INVENTORY', label: 'Inventory', defaultRole: 'INVENTORY_SUPERVISOR' },
];

const ROLE_OPTIONS = Array.from(
  new Set([
    ...DEPARTMENT_OPTIONS.map((d) => d.defaultRole),
    'SUPER_ADMIN',
    'DYEING_OPERATOR',
    'EMBROIDERY_OPERATOR',
    'WASHING_OPERATOR',
    'RECUTTING_OPERATOR',
    'STITCHING_OPERATOR',
    'FINISHING_OPERATOR',
    'STEAM_PRESS_OPERATOR',
    'PACKING_OPERATOR',
  ])
);

const defaultRoleFor = (departmentCode: string) =>
  DEPARTMENT_OPTIONS.find((d) => d.code === departmentCode)?.defaultRole || 'USER';

interface EditableUser {
  id: string;
  username: string;
  fullName: string;
  departmentCode: string;
  roleCode: string;
  isActive: boolean;
  pin: string;
}

export default function AdminConsolePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'programs' | 'challans' | 'suppliers' | 'fabrics' | 'stocks' | 'sidebar-image' | 'login-appearance'>('users');
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
    pin: '',
    departmentCode: 'PROGRAMMING',
    roleCode: 'PROGRAMMING_INCHARGE',
    email: '',
  });
  const [editingUser, setEditingUser] = useState<EditableUser | null>(null);

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
  const [submittingModal, setSubmittingModal] = useState(false);

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
      setSubmittingModal(true);
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
        pin: '',
        departmentCode: 'PROGRAMMING',
        roleCode: 'PROGRAMMING_INCHARGE',
        email: '',
      });
      loadData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setSubmittingModal(false);
    }
  };

  // Edit User handler (name, department, role, status and optional new PIN)
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      setSubmittingModal(true);
      const { id, username, pin, ...changes } = editingUser;
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pin.trim() ? { ...changes, pin } : changes),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');

      showNotification(pin.trim() ? `User "${username}" updated and PIN changed.` : `User "${username}" updated.`);
      setEditingUser(null);
      loadData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setSubmittingModal(false);
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

  // Clear ALL Factory Data (Factory Reset)
  const handleClearAllFactoryData = async () => {
    const confirmation = prompt('CRITICAL WARNING: This will completely wipe ALL production sheets, challans, dyeing orders, inventory, defect logs, and audit logs from the database, resetting the system to a clean initial state.\n\nType "WIPE ALL DATA" to confirm:');
    if (confirmation !== 'WIPE ALL DATA') {
      if (confirmation !== null) alert('Action cancelled. Confirmation text did not match.');
      return;
    }
    try {
      setLoading(true);
      const res = await fetch('/api/admin/clear-all-data', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clear factory data');
      showNotification('All factory data successfully cleared. Database is in pristine initial state.');
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
      setSubmittingModal(true);
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
    } finally {
      setSubmittingModal(false);
    }
  };

  // Create Fabric handler
  const handleCreateFabric = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingModal(true);
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
    } finally {
      setSubmittingModal(false);
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
    router.replace('/login');
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col">
      {/* TOP HEADER */}
      <header className="bg-white text-neutral-900 border-b border-neutral-200 px-4 md:px-6 py-3.5 sticky top-0 z-40 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-white p-0.5 border border-brand-500/40 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
              <img src="/shubham-logo.jpg" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-[0.16em] text-neutral-900 uppercase">
                  SHUBHAM FABRICS INDIA PVT. LTD.
                </span>
                <span className="text-[10px] bg-brand-600 text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Admin Console
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 font-mono">
                Manufacturing Execution System · Full Factory Access
              </p>
            </div>
          </div>

          {/* Quick mobile action */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-danger-600 hover:bg-neutral-100 transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* WORKSPACE SWITCHER & CONTROLS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <Link
            href="/programming"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-accent-400/10 text-accent-700 border border-accent-500/30 hover:bg-accent-400/20 transition shrink-0"
            title="Open Programming Department"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Programming</span>
          </Link>

          <Link
            href="/fabric-store"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-500/10 text-brand-600 border border-brand-500/30 hover:bg-brand-500/20 transition shrink-0"
            title="Open Store Department"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Store</span>
          </Link>

          <Link
            href="/dyeing"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-500/10 text-brand-600 border border-brand-500/30 hover:bg-brand-500/20 transition shrink-0"
            title="Open Dyeing Department"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Dyeing</span>
          </Link>

          <Link
            href="/qc1"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-accent-400/10 text-accent-700 border border-accent-500/30 hover:bg-accent-400/20 transition shrink-0"
            title="Open Dyeing QC Department"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Dyeing QC</span>
          </Link>

          <Link
            href="/embroidery"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-500/10 text-brand-600 border border-brand-500/30 hover:bg-brand-500/20 transition shrink-0"
            title="Open Embroidery Department"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Embroidery</span>
          </Link>

          <Link
            href="/thread-cutting"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-500/10 text-brand-600 border border-brand-500/30 hover:bg-brand-500/20 transition shrink-0"
            title="Open Thread Cutting Department"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Thread Cutting</span>
          </Link>

          <Link
            href="/qc2"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-accent-400/10 text-accent-700 border border-accent-500/30 hover:bg-accent-400/20 transition shrink-0"
            title="Open Threadcut QC"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Threadcut QC</span>
          </Link>

          <button
            onClick={handleClearAllFactoryData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-danger-500/90 hover:bg-danger-700 text-neutral-900 shadow-xs transition shrink-0"
            title="Wipe all production sheets, challans, and operational data (Factory Reset)"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Wipe All Data</span>
          </button>

          <button
            onClick={handleSignOut}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 hover:bg-danger-50 text-neutral-700 hover:text-danger-800 border border-neutral-200 transition ml-1 shrink-0"
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
              ? 'bg-accent-50 text-accent-800 border-accent-300'
              : 'bg-danger-50 text-danger-800 border-danger-300'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-accent-700" />
          ) : (
            <AlertCircle className="w-4 h-4 text-danger-600" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* SUB-HEADER / KPI STRIP */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-brand-600" />
              Enterprise Administration &amp; Master Control
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Role-Based Architecture (RBAC), User Credentials, Program Sheets, Challans, Suppliers, Fabrics, and Inventory.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAddUserModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add User</span>
            </button>
            <Link
              href="/my-work/create-production-sheet"
              className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Program Sheet</span>
            </Link>
            <Link
              href="/my-work/issue-challan"
              className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Issue Challan</span>
            </Link>
          </div>
        </div>

        {/* TABS */}
        <div className="flex items-center gap-1 border-t border-neutral-100 mt-4 pt-3 overflow-x-auto">
          {[
            { id: 'users', label: 'Users & RBAC', icon: Users, count: users.length },
            { id: 'programs', label: 'Program Sheets', icon: FileText, count: programs.length },
            { id: 'challans', label: 'Challans', icon: Truck, count: challans.length },
            { id: 'suppliers', label: 'Suppliers', icon: Building, count: suppliers.length },
            { id: 'fabrics', label: 'Fabrics Master', icon: Layers, count: fabrics.length },
            { id: 'stocks', label: 'Stocks & Inventory', icon: Boxes, count: stocksData?.summary?.totalRolls },
            { id: 'sidebar-image', label: 'Sidebar Image', icon: ImageIcon, count: undefined },
            { id: 'login-appearance', label: 'Appearance', icon: Palette, count: undefined },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition shrink-0 ${
                  active
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-accent-700' : 'text-neutral-500'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      active ? 'bg-neutral-100 text-accent-700' : 'bg-neutral-200 text-neutral-700'
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
          <div className="p-12 flex flex-col items-center justify-center text-neutral-500">
            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-brand-600" />
            <p className="text-xs font-medium">Loading MES Administration Data...</p>
          </div>
        ) : (
          <>
            {/* DEPARTMENT SIDEBAR IMAGES */}
            {activeTab === 'sidebar-image' && <SidebarImagePanel onNotify={showNotification} />}
            {activeTab === 'login-appearance' && <AppearancePanel onNotify={showNotification} />}

            {/* TAB 1: USERS & RBAC */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                      Factory Users &amp; Role-Based Architecture (RBAC)
                    </h2>
                    <p className="text-xs text-neutral-500">
                      Manage usernames, PINs, departmental affinities, and station access.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddUserModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create User</span>
                  </button>
                </div>

                <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[640px]">
                    <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase tracking-wider text-[10px]">
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
                    <tbody className="divide-y divide-neutral-100">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-neutral-50/70 transition">
                          <td className="py-3 px-4 font-mono font-bold text-brand-900">
                            {u.username}
                          </td>
                          <td className="py-3 px-4 text-neutral-900 font-medium">{u.fullName}</td>
                          <td className="py-3 px-4">
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-700 border border-neutral-200">
                              {u.departmentCode || 'STORE'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                u.role.includes('ADMIN')
                                  ? 'bg-brand-100 text-brand-800'
                                  : u.departmentCode === 'PROGRAMMING'
                                  ? 'bg-brand-100 text-brand-800'
                                  : 'bg-brand-100 text-brand-800'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-neutral-500">
                            •••• (Encrypted PIN)
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                u.isActive
                                  ? 'bg-accent-100 text-accent-800'
                                  : 'bg-danger-100 text-danger-800'
                              }`}
                            >
                              {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() =>
                                  setEditingUser({
                                    id: u.id,
                                    username: u.username,
                                    fullName: u.fullName,
                                    departmentCode: u.departmentCode,
                                    roleCode: u.role,
                                    isActive: u.isActive,
                                    pin: '',
                                  })
                                }
                                className="p-1 text-brand-600 hover:text-brand-800 hover:bg-brand-50 rounded transition"
                                title="Edit user / change PIN"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {u.username !== 'admin' && u.id !== currentUser?.id ? (
                                <button
                                  onClick={() => handleDeleteUser(u.id, u.username)}
                                  className="p-1 text-danger-600 hover:text-danger-800 hover:bg-danger-50 rounded transition"
                                  title="Delete User"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <span className="text-[10px] text-neutral-500 font-mono px-1">Protected</span>
                              )}
                            </div>
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
                    <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                      Master Production Sheets
                    </h2>
                    <p className="text-xs text-neutral-500">
                      View, print traveler cards, and delete/remove production sheets.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDeleteAllPrograms}
                      disabled={programs.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-danger-600 hover:bg-danger-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold shadow-xs transition"
                      title="Permanently Delete All Production Sheets"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete All Sheets</span>
                    </button>
                    <Link
                      href="/my-work/create-production-sheet"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Production Sheet</span>
                    </Link>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[720px]">
                    <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase tracking-wider text-[10px]">
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
                    <tbody className="divide-y divide-neutral-100">
                      {programs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-neutral-500">
                            No production sheets found. Click "+ Add Production Sheet" to create one.
                          </td>
                        </tr>
                      ) : (
                        programs.map((p) => (
                          <tr key={p.id} className="hover:bg-neutral-50/70 transition">
                            <td className="py-3 px-4 font-mono font-bold text-brand-600">
                              {p.programSerialNo || p.programNumber}
                            </td>
                            <td className="py-3 px-4 text-neutral-900 font-medium">
                              {p.clientName || p.buyerName || '—'}
                            </td>
                            <td className="py-3 px-4 text-neutral-700">
                              {p.mainStyle || p.styleCode} {p.designNumber ? `· ${p.designNumber}` : ''}
                            </td>
                            <td className="py-3 px-4 text-neutral-600">
                              {p.fabricName || 'Standard Pique'} {p.fabricColor ? `(${p.fabricColor})` : ''}
                            </td>
                            <td className="py-3 px-4 font-mono font-semibold text-neutral-900">
                              {p.colorQuantity || p.targetQuantity} {p.quantityMeasurement || 'PCS'}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-brand-100 text-brand-800">
                                {p.status || 'DRAFT'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => printProductionSheet(p)}
                                  className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded"
                                  title="Print Traveler Sheet"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteProgram(p.id, p.programSerialNo || p.programNumber)}
                                  className="p-1 text-danger-600 hover:text-danger-800 hover:bg-danger-50 rounded"
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
                    <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                      Factory Challans &amp; Material Movement
                    </h2>
                    <p className="text-xs text-neutral-500">
                      Track inter-department dispatches and station handoffs.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDeleteAllChallans}
                      disabled={challans.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-danger-600 hover:bg-danger-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold shadow-xs transition"
                      title="Permanently Delete All Factory Challans"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete All Challans</span>
                    </button>
                    <Link
                      href="/my-work/issue-challan"
                      className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                    >
                      + Programming Challan
                    </Link>
                    <Link
                      href="/fabric-store/my-work/issue-challan"
                      className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                    >
                      + Fabric Store Challan
                    </Link>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[720px]">
                    <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase tracking-wider text-[10px]">
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
                    <tbody className="divide-y divide-neutral-100">
                      {challans.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-neutral-500">
                            No challans recorded yet.
                          </td>
                        </tr>
                      ) : (
                        challans.map((c) => (
                          <tr key={c.id} className="hover:bg-neutral-50/70 transition">
                            <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                              {c.challanNumber}
                            </td>
                            <td className="py-3 px-4 text-neutral-600 font-mono text-[11px]">
                              {new Date(c.createdAt || Date.now()).toLocaleDateString('en-IN')}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent-50 text-accent-800 border border-accent-200">
                                {c.fromDepartment || c.fromDeptRel?.code || 'PROGRAMMING'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-50 text-brand-900 border border-brand-200">
                                {c.toDepartment || c.toDeptRel?.code || 'STORE'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-neutral-700">
                              {c.program?.programSerialNo || c.program?.programNumber || '—'}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-accent-100 text-accent-800">
                                {c.status || 'ISSUED'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Link
                                  href={`/challans/${c.id}`}
                                  className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded"
                                  title="View / Print Slip"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </Link>
                                <button
                                  onClick={() => handleDeleteChallan(c.id, c.challanNumber)}
                                  className="p-1 text-danger-600 hover:text-danger-800 hover:bg-danger-50 rounded"
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
                    <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                      Supplier Master Directory
                    </h2>
                    <p className="text-xs text-neutral-500">
                      Approved mills, yarn suppliers, and fabric vendors.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddSupplierModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Supplier</span>
                  </button>
                </div>

                <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[640px]">
                    <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4 font-bold">Code</th>
                        <th className="py-3 px-4 font-bold">Supplier Name</th>
                        <th className="py-3 px-4 font-bold">Contact Person</th>
                        <th className="py-3 px-4 font-bold">Phone</th>
                        <th className="py-3 px-4 font-bold">Email</th>
                        <th className="py-3 px-4 font-bold">GSTIN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {suppliers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-neutral-500">
                            No suppliers registered yet.
                          </td>
                        </tr>
                      ) : (
                        suppliers.map((s) => (
                          <tr key={s.id} className="hover:bg-neutral-50/70 transition">
                            <td className="py-3 px-4 font-mono font-bold text-brand-900">{s.code}</td>
                            <td className="py-3 px-4 font-semibold text-neutral-900">{s.name}</td>
                            <td className="py-3 px-4 text-neutral-600">{s.contactPerson || '—'}</td>
                            <td className="py-3 px-4 font-mono text-neutral-600">{s.phone || '—'}</td>
                            <td className="py-3 px-4 text-neutral-600">{s.email || '—'}</td>
                            <td className="py-3 px-4 font-mono text-neutral-600">{s.taxNumber || '—'}</td>
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
                    <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                      Fabric Specifications Catalog
                    </h2>
                    <p className="text-xs text-neutral-500">
                      Standard mill specs, compositions, weave types, and GSM weights.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddFabricModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Fabric Spec</span>
                  </button>
                </div>

                <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[640px]">
                    <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase tracking-wider text-[10px]">
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
                    <tbody className="divide-y divide-neutral-100">
                      {fabrics.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-neutral-500">
                            No fabric specs registered yet.
                          </td>
                        </tr>
                      ) : (
                        fabrics.map((f) => (
                          <tr key={f.id} className="hover:bg-neutral-50/70 transition">
                            <td className="py-3 px-4 font-mono font-bold text-neutral-900">{f.code}</td>
                            <td className="py-3 px-4 font-semibold text-neutral-900">{f.name}</td>
                            <td className="py-3 px-4 font-mono text-[11px] text-neutral-600">{f.fabricType}</td>
                            <td className="py-3 px-4 text-neutral-700">{f.composition}</td>
                            <td className="py-3 px-4 font-mono text-neutral-900">{f.gsm} gsm</td>
                            <td className="py-3 px-4 font-mono text-neutral-900">{f.widthInInches}&quot;</td>
                            <td className="py-3 px-4 text-neutral-600">{f.supplier?.name || '—'}</td>
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
                    <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">
                      Factory Stocks &amp; Inventory Telemetry
                    </h2>
                    <p className="text-xs text-neutral-500">
                      Live fabric rolls, batches, and stock distribution.
                    </p>
                  </div>
                  <Link
                    href="/fabric-store/inventory/stock"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Fabric Store Inventory</span>
                  </Link>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">
                      Total Fabric Rolls
                    </span>
                    <div className="text-2xl font-bold font-mono text-neutral-900">
                      {stocksData?.summary?.totalRolls || 0}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">
                      Total Fabric Length
                    </span>
                    <div className="text-2xl font-bold font-mono text-brand-700">
                      {(stocksData?.summary?.totalMeters || 0).toLocaleString()} Mtr
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">
                      Total Net Weight
                    </span>
                    <div className="text-2xl font-bold font-mono text-brand-700">
                      {(stocksData?.summary?.totalWeightKg || 0).toLocaleString()} Kg
                    </div>
                  </div>
                </div>

                {/* Rolls Table */}
                <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-x-auto">
                  <div className="p-3 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-900">Rolls In Stock</span>
                  </div>
                  <table className="w-full text-left text-xs min-w-[640px]">
                    <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase tracking-wider text-[10px]">
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
                    <tbody className="divide-y divide-neutral-100">
                      {(stocksData?.rolls || []).slice(0, 20).map((r: any) => (
                        <tr key={r.id} className="hover:bg-neutral-50/70 transition">
                          <td className="py-2.5 px-4 font-mono font-bold text-neutral-900">{r.barcode}</td>
                          <td className="py-2.5 px-4 font-mono text-neutral-600">{r.batchNumber}</td>
                          <td className="py-2.5 px-4 text-neutral-900 font-medium">{r.fabricName}</td>
                          <td className="py-2.5 px-4 text-neutral-700">{r.color}</td>
                          <td className="py-2.5 px-4 font-mono font-semibold text-brand-700">{r.lengthMeters} M</td>
                          <td className="py-2.5 px-4 font-mono text-neutral-600">{r.netWeightKg} kg</td>
                          <td className="py-2.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-700">
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
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-neutral-200 p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-brand-600" />
              Add New Factory User (RBAC)
            </h3>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  placeholder=""
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder=""
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Station PIN *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder=""
                    value={newUser.pin}
                    onChange={(e) => setNewUser({ ...newUser, pin: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-mono tracking-widest focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Department *
                  </label>
                  <select
                    value={newUser.departmentCode}
                    onChange={(e) =>
                      setNewUser({ ...newUser, departmentCode: e.target.value, roleCode: defaultRoleFor(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  >
                    {DEPARTMENT_OPTIONS.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Security Role *
                </label>
                <select
                  value={newUser.roleCode}
                  onChange={(e) => setNewUser({ ...newUser, roleCode: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r === 'ADMIN' ? 'ADMIN (Full Access)' : r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingModal}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  {submittingModal ? 'Saving...' : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER / CHANGE PIN */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-neutral-200 p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-neutral-900 mb-1 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-brand-600" />
              Edit User
            </h3>
            <p className="text-xs text-neutral-500 mb-4 font-mono">{editingUser.username}</p>

            <form onSubmit={handleUpdateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editingUser.fullName}
                  onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Department *</label>
                  <select
                    value={editingUser.departmentCode}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        departmentCode: e.target.value,
                        roleCode: defaultRoleFor(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  >
                    {!DEPARTMENT_OPTIONS.some((d) => d.code === editingUser.departmentCode) && (
                      <option value={editingUser.departmentCode}>{editingUser.departmentCode}</option>
                    )}
                    {DEPARTMENT_OPTIONS.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Security Role *</label>
                  <select
                    value={editingUser.roleCode}
                    onChange={(e) => setEditingUser({ ...editingUser, roleCode: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  >
                    {!ROLE_OPTIONS.includes(editingUser.roleCode) && (
                      <option value={editingUser.roleCode}>{editingUser.roleCode}</option>
                    )}
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r === 'ADMIN' ? 'ADMIN (Full Access)' : r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">New PIN</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Leave blank to keep the current PIN"
                  value={editingUser.pin}
                  onChange={(e) => setEditingUser({ ...editingUser, pin: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-mono tracking-widest focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-neutral-500">
                  At least 4 characters. Simple PINs like 1234 or 0000 are not accepted.
                </p>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
                <input
                  type="checkbox"
                  checked={editingUser.isActive}
                  disabled={editingUser.id === currentUser?.id}
                  onChange={(e) => setEditingUser({ ...editingUser, isActive: e.target.checked })}
                  className="rounded border-neutral-300"
                />
                Account active (inactive users cannot sign in)
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingModal}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  {submittingModal ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD SUPPLIER */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-neutral-200 p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <Building className="w-5 h-5 text-brand-600" />
              Add Approved Supplier
            </h3>

            <form onSubmit={handleCreateSupplier} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder=""
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Supplier Code
                  </label>
                  <input
                    type="text"
                    placeholder=""
                    value={newSupplier.code}
                    onChange={(e) => setNewSupplier({ ...newSupplier, code: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder=""
                    value={newSupplier.contactPerson}
                    onChange={(e) => setNewSupplier({ ...newSupplier, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    placeholder=""
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    placeholder=""
                    value={newSupplier.taxNumber}
                    onChange={(e) => setNewSupplier({ ...newSupplier, taxNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-mono uppercase focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingModal}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  {submittingModal ? 'Saving...' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD FABRIC */}
      {showAddFabricModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-neutral-200 p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-brand-600" />
              Add Fabric Specification
            </h3>

            <form onSubmit={handleCreateFabric} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Fabric Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder=""
                  value={newFabric.name}
                  onChange={(e) => setNewFabric({ ...newFabric, name: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Composition
                  </label>
                  <input
                    type="text"
                    placeholder=""
                    value={newFabric.composition}
                    onChange={(e) => setNewFabric({ ...newFabric, composition: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Fabric Type
                  </label>
                  <select
                    value={newFabric.fabricType}
                    onChange={(e) => setNewFabric({ ...newFabric, fabricType: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
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
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    GSM (Weight)
                  </label>
                  <input
                    type="number"
                    placeholder=""
                    value={newFabric.gsm}
                    onChange={(e) => setNewFabric({ ...newFabric, gsm: parseFloat(e.target.value) || 220 })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Width (Inches)
                  </label>
                  <input
                    type="number"
                    placeholder=""
                    value={newFabric.widthInInches}
                    onChange={(e) => setNewFabric({ ...newFabric, widthInInches: parseFloat(e.target.value) || 60 })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowAddFabricModal(false)}
                  className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingModal}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  {submittingModal ? 'Saving...' : 'Save Fabric'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
