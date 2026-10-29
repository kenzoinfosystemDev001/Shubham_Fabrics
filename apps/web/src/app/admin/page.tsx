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
import { AdminDepartmentMenu } from '@/components/admin/AdminDepartmentMenu';
import { departmentName } from '@/lib/workflow-views';
import { printProductionSheet } from '@/lib/download-production-sheet';

// Every department a user can belong to, with the role a new user there normally gets.
const DEPARTMENT_OPTIONS = [
  { code: 'ADMIN', label: 'Administration', defaultRole: 'ADMIN' },
  { code: 'PROGRAMMING', label: 'Programming', defaultRole: 'PROGRAMMING_INCHARGE' },
  { code: 'STORE', label: 'Fabric Store', defaultRole: 'FABRIC_STORE' },
  { code: 'DYEING', label: 'Dyeing', defaultRole: 'DYEING_INCHARGE' },
  { code: 'QC1', label: 'Dyeing QC', defaultRole: 'QC1_INSPECTOR' },
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

// Display names for the QC department and role codes (the codes themselves stay as stored).
const QC_DEPARTMENT_LABELS: Record<string, string> = {
  QC1: 'Dyeing QC',
  QC2: 'Threadcut QC',
  QC3: 'Washing QC',
};
const QC_ROLE_LABELS: Record<string, string> = {
  QC1_INSPECTOR: 'Dyeing QC Inspector',
  QC2_INSPECTOR: 'Threadcut QC Inspector',
  QC3_INSPECTOR: 'Washing QC Inspector',
};
const departmentDisplay = (code: string) => QC_DEPARTMENT_LABELS[code] || code;
/** The generic QC_INSPECTOR role is named after the user's QC department when there is one. */
const roleDisplay = (code: string, departmentCode?: string | null) => {
  if (code === 'ADMIN') return 'ADMIN (Full Access)';
  if (code === 'QC_INSPECTOR' && departmentCode && QC_DEPARTMENT_LABELS[departmentCode]) {
    return `${QC_DEPARTMENT_LABELS[departmentCode]} Inspector`;
  }
  return QC_ROLE_LABELS[code] || code;
};

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
  const [userSearch, setUserSearch] = useState('');
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

      // Retired duplicate station accounts ("<name>-old", switched off) exist only so old records keep
      // their author; they are not listed, so each department shows its one account.
      setUsers(
        (Array.isArray(usersRes) ? usersRes : []).filter(
          (u: any) => !(u.isActive === false && /-old(-[a-z0-9]+)?$/i.test(String(u.username || '')))
        )
      );
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
    const confirmation = prompt('DANGER: This will permanently delete ALL production sheets with their challans, dyeing orders and production records. Fabric Store stock is kept.\n\nType "DELETE ALL" to confirm:');
    if (confirmation !== 'DELETE ALL') {
      if (confirmation !== null) alert('Action cancelled. Deletion code did not match.');
      return;
    }
    try {
      setLoading(true);
      const res = await fetch('/api/admin/programs/delete-all', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: confirmation }),
      });
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
      const res = await fetch('/api/admin/challans/delete-all', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: confirmation }),
      });
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
      <header className="bg-white/95 backdrop-blur border-b border-neutral-200/80 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white p-1 ring-1 ring-neutral-200 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
              <img src="/shubham-logo.jpg" alt="Shubham Fabrics" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900 truncate">Shubham Fabrics India Pvt. Ltd.</p>
              <p className="text-[11px] font-medium text-brand-700 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Admin Console
              </p>
            </div>
          </div>

          {/* No sideways scrolling here: it would clip the department menu. */}
          <div className="flex items-center gap-2">
            <AdminDepartmentMenu />
            <span className="hidden md:block w-px h-6 bg-neutral-200 mx-1" aria-hidden="true" />
            <button
              onClick={handleClearAllFactoryData}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-danger-700 border border-danger-200 bg-white hover:bg-danger-50 transition shrink-0"
              title="Wipe all production sheets, challans, and operational data (Factory Reset)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Wipe All Data</span>
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
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

      {/* PAGE HEADING & TABS */}
      <div className="bg-white border-b border-neutral-200/80">
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">
              Enterprise Administration &amp; Master Control
            </h1>
            <Link
              href="/my-work/create-production-sheet"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-neutral-50 text-neutral-900 rounded-lg text-xs font-semibold ring-1 ring-neutral-300 shadow-xs transition self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Program Sheet</span>
            </Link>
          </div>

        {/* TABS */}
        <div className="flex items-center gap-6 mt-5 overflow-x-auto -mb-px">
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
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 pb-3 pt-1 border-b-2 text-[13px] font-medium transition shrink-0 ${
                  active
                    ? 'border-brand-600 text-neutral-900'
                    : 'border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-brand-600' : 'text-neutral-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[11px] min-w-5 px-1.5 rounded-full tabular-nums text-center ${
                      active ? 'bg-brand-50 text-brand-700' : 'bg-neutral-100 text-neutral-500'
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
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 px-4 md:px-8 py-8 max-w-7xl w-full mx-auto">
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
            {activeTab === 'users' && (() => {
              const q = userSearch.trim().toLowerCase();
              const shownUsers = q
                ? users.filter((u) =>
                    [u.username, u.fullName, u.departmentCode ? departmentName(u.departmentCode) : '']
                      .some((text) => String(text || '').toLowerCase().includes(q))
                  )
                : users;
              const activeCount = users.filter((u) => u.isActive).length;
              return (
              <section className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-neutral-900">Users &amp; Roles</h2>
                    <p className="text-xs text-neutral-500 mt-0.5 tabular-nums">
                      {users.length} accounts · {activeCount} active
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="relative">
                      <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        aria-label="Search users"
                        className="w-48 sm:w-60 pl-8 pr-3 py-2 text-xs bg-white rounded-lg ring-1 ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </label>
                    <button
                      onClick={() => setShowAddUserModal(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Create User</span>
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-2xl ring-1 ring-neutral-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[720px]">
                    <thead className="bg-neutral-50/80 border-b border-neutral-200 text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                      <tr>
                        <th className="py-3 pl-6 pr-4 font-medium">User</th>
                        <th className="py-3 px-4 font-medium">Department</th>
                        <th className="py-3 px-4 font-medium">Role</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                        <th className="py-3 pl-4 pr-6 font-medium text-right">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {shownUsers.map((u) => {
                        const isAdminRow = u.role.includes('ADMIN');
                        const initials = String(u.fullName || u.username || '?')
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((w: string) => w[0])
                          .join('')
                          .toUpperCase();
                        return (
                        <tr key={u.id} className="group hover:bg-neutral-50/70 transition">
                          <td className="py-3.5 pl-6 pr-4">
                            <div className="flex items-center gap-3">
                              <span
                                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                                  isAdminRow ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700 ring-1 ring-brand-100'
                                }`}
                                aria-hidden="true"
                              >
                                {initials}
                              </span>
                              <div className="min-w-0">
                                <p className="font-medium text-neutral-900 truncate">{u.fullName}</p>
                                <p className="text-xs font-mono text-neutral-500 truncate">{u.username}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-neutral-700 whitespace-nowrap">
                            {u.departmentCode ? departmentName(u.departmentCode) : '—'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ${
                                isAdminRow ? 'bg-brand-600 text-white' : 'bg-neutral-100 text-neutral-700'
                              }`}
                            >
                              {isAdminRow
                                ? 'Administrator'
                                : u.departmentCode
                                  ? `${departmentName(u.departmentCode)} Inspector`
                                  : roleDisplay(u.role, u.departmentCode)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.isActive ? 'text-accent-800' : 'text-neutral-500'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-accent-600' : 'bg-neutral-400'}`} />
                              {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3.5 pl-4 pr-6 text-right">
                            <div className="inline-flex items-center gap-0.5">
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
                                className="p-2 text-neutral-400 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition"
                                title="Edit user / change PIN"
                                aria-label={`Edit ${u.username}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              {u.username !== 'admin' && u.id !== currentUser?.id ? (
                                <button
                                  onClick={() => handleDeleteUser(u.id, u.username)}
                                  className="p-2 text-neutral-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition"
                                  title="Delete user"
                                  aria-label={`Delete ${u.username}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <span className="p-2 text-neutral-300" title="Protected account">
                                  <KeyRound className="w-4 h-4" />
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                      {shownUsers.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-sm text-neutral-500">
                            {q ? 'No users match this search.' : 'No users yet.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
              </section>
              );
            })()}

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
                      {(stocksData?.summary?.totalMeters || 0).toLocaleString()} Mtr{stocksData?.summary?.totalPcs ? ` / ${stocksData.summary.totalPcs.toLocaleString()} Pcs` : ''}
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
                          <td className="py-2.5 px-4 font-mono font-semibold text-brand-700">{r.lengthMeters} {r.unit === 'PCS' ? 'PCS' : 'M'}</td>
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
                        {roleDisplay(r)}
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
