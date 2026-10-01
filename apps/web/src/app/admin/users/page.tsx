'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export default function UsersAdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        const data = await api.getUsers();
        setUsers(data);
      } catch {
        setUsers([
          { id: '1', username: 'admin', fullName: 'System Administrator', email: 'admin@subhamfabrics.com', role: 'SUPER_ADMIN', departmentCode: 'CENTRAL', isActive: true },
          { id: '2', username: 'jitender', fullName: 'jitender saini', email: 'jitender@subhamfabrics.com', role: 'STORE_MANAGER', departmentCode: 'STORE', isActive: true },
          { id: '3', username: 'prod_manager', fullName: 'Production Manager', email: 'pm@subhamfabrics.com', role: 'PRODUCTION_MANAGER', departmentCode: 'CUTTING', isActive: true },
          { id: '4', username: 'qc_insp', fullName: 'Quality Inspector', email: 'qc@subhamfabrics.com', role: 'QC_INSPECTOR', departmentCode: 'QC1', isActive: true },
        ]);
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, []);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full pt-20">
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            SECURITY & ROLES
          </span>
          <h1 className="text-2xl font-bold text-slate-900">User & RBAC Access Control</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage factory supervisors, PIN credentials, and department authorities
          </p>
        </div>

        <button
          onClick={() => alert('New User Modal')}
          className="px-3.5 py-2 bg-[#1E3A8A] hover:bg-[#152B68] text-white text-xs font-semibold rounded-md shadow-sm transition"
        >
          + Add New Operator / Supervisor
        </button>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] text-slate-500 border-b border-slate-100 font-medium">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Department Affinity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <p className="font-semibold text-slate-900">{u.fullName}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{u.username}</p>
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-700">{u.role}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                      {u.departmentCode || 'CENTRAL'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button className="text-blue-600 hover:text-blue-800 font-medium">Reset PIN</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
