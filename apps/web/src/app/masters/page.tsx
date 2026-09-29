'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';

type MasterCategory = 'partners' | 'materials' | 'product' | 'factory' | 'process';

interface MasterConfig {
  resource: string;
  label: string;
  category: MasterCategory;
  columns: { key: string; label: string; format?: (val: any) => string }[];
  defaultPayload: Record<string, any>;
  fields: { name: string; label: string; type: 'text' | 'number' | 'select'; options?: string[] }[];
}

const MASTER_CONFIGS: Record<string, MasterConfig> = {
  suppliers: {
    resource: 'suppliers',
    label: 'Suppliers',
    category: 'partners',
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Supplier Name' },
      { key: 'contactPerson', label: 'Contact Person' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'rating', label: 'Rating', format: (v) => `${v || 5.0} ★` },
      { key: 'isActive', label: 'Status', format: (v) => (v ? 'ACTIVE' : 'INACTIVE') },
    ],
    defaultPayload: { code: '', name: '', contactPerson: '', email: '', phone: '', rating: 5.0 },
    fields: [
      { name: 'code', label: 'Code (e.g. SUP-TEX-01)', type: 'text' },
      { name: 'name', label: 'Company Name', type: 'text' },
      { name: 'contactPerson', label: 'Contact Person', type: 'text' },
      { name: 'email', label: 'Email', type: 'text' },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'rating', label: 'Rating (1-5)', type: 'number' },
    ],
  },
  customers: {
    resource: 'customers',
    label: 'Customers / Buyers',
    category: 'partners',
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Customer Name' },
      { key: 'contactPerson', label: 'Contact Person' },
      { key: 'buyerGroup', label: 'Buyer Group' },
      { key: 'currency', label: 'Currency' },
      { key: 'country', label: 'Country' },
      { key: 'isActive', label: 'Status', format: (v) => (v ? 'ACTIVE' : 'INACTIVE') },
    ],
    defaultPayload: { code: '', name: '', contactPerson: '', email: '', buyerGroup: 'GLOBAL', currency: 'INR' },
    fields: [
      { name: 'code', label: 'Customer Code', type: 'text' },
      { name: 'name', label: 'Buyer Name', type: 'text' },
      { name: 'contactPerson', label: 'Contact Person', type: 'text' },
      { name: 'buyerGroup', label: 'Buyer Group', type: 'text' },
      { name: 'currency', label: 'Currency', type: 'text' },
    ],
  },
  fabrics: {
    resource: 'fabrics',
    label: 'Fabric Library',
    category: 'materials',
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Fabric Name' },
      { key: 'fabricType', label: 'Type' },
      { key: 'composition', label: 'Composition' },
      { key: 'widthInInches', label: 'Width (in)' },
      { key: 'gsm', label: 'GSM' },
    ],
    defaultPayload: { code: '', name: '', fabricType: 'Knit', composition: '100% Cotton', widthInInches: 60, gsm: 180 },
    fields: [
      { name: 'code', label: 'Fabric Code', type: 'text' },
      { name: 'name', label: 'Fabric Name', type: 'text' },
      { name: 'fabricType', label: 'Fabric Type', type: 'text' },
      { name: 'composition', label: 'Composition', type: 'text' },
      { name: 'widthInInches', label: 'Width (inches)', type: 'number' },
      { name: 'gsm', label: 'GSM', type: 'number' },
    ],
  },
  trims: {
    resource: 'trims',
    label: 'Trims & Accessories',
    category: 'materials',
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Trim Name' },
      { key: 'trimCategory', label: 'Category' },
      { key: 'uom', label: 'UOM' },
    ],
    defaultPayload: { code: '', name: '', trimCategory: 'THREAD', uom: 'MTR' },
    fields: [
      { name: 'code', label: 'Trim Code', type: 'text' },
      { name: 'name', label: 'Trim Name', type: 'text' },
      { name: 'trimCategory', label: 'Category (BUTTON, ZIPPER, THREAD)', type: 'text' },
      { name: 'uom', label: 'Unit of Measure', type: 'text' },
    ],
  },
  designs: {
    resource: 'designs',
    label: 'Designs & Styles',
    category: 'product',
    columns: [
      { key: 'code', label: 'Design Code' },
      { key: 'name', label: 'Design Name' },
      { key: 'patternNumber', label: 'Pattern #' },
      { key: 'category', label: 'Category' },
      { key: 'designVersion', label: 'Version' },
    ],
    defaultPayload: { code: '', name: '', patternNumber: '', category: 'Apparel', designVersion: 'v1.0' },
    fields: [
      { name: 'code', label: 'Design Code', type: 'text' },
      { name: 'name', label: 'Design Name', type: 'text' },
      { name: 'patternNumber', label: 'Pattern Number', type: 'text' },
      { name: 'category', label: 'Category', type: 'text' },
    ],
  },
  colours: {
    resource: 'colours',
    label: 'Colour Shades',
    category: 'product',
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Colour Name' },
      { key: 'hexCode', label: 'Hex Code' },
      { key: 'pantoneCode', label: 'Pantone Reference' },
    ],
    defaultPayload: { code: '', name: '', hexCode: '#000000', pantoneCode: '' },
    fields: [
      { name: 'code', label: 'Colour Code', type: 'text' },
      { name: 'name', label: 'Colour Name', type: 'text' },
      { name: 'hexCode', label: 'Hex Code (e.g. #1E3A8A)', type: 'text' },
      { name: 'pantoneCode', label: 'Pantone Reference', type: 'text' },
    ],
  },
  sizes: {
    resource: 'sizes',
    label: 'Standard Sizes',
    category: 'product',
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Size Label' },
      { key: 'sizeGroup', label: 'Group' },
      { key: 'sortOrder', label: 'Sort Order' },
    ],
    defaultPayload: { code: '', name: '', sizeGroup: 'ADULT', sortOrder: 1 },
    fields: [
      { name: 'code', label: 'Size Code (S, M, L)', type: 'text' },
      { name: 'name', label: 'Size Label', type: 'text' },
      { name: 'sizeGroup', label: 'Size Group', type: 'text' },
      { name: 'sortOrder', label: 'Sort Sequence', type: 'number' },
    ],
  },
  departments: {
    resource: 'departments',
    label: 'Factory Departments',
    category: 'factory',
    columns: [
      { key: 'sequenceOrder', label: 'Seq' },
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Department Name' },
      { key: 'description', label: 'Description' },
    ],
    defaultPayload: { code: '', name: '', sequenceOrder: 1, description: '' },
    fields: [
      { name: 'code', label: 'Dept Code (e.g. CUTTING)', type: 'text' },
      { name: 'name', label: 'Dept Name', type: 'text' },
      { name: 'sequenceOrder', label: 'Sequence Order', type: 'number' },
      { name: 'description', label: 'Description', type: 'text' },
    ],
  },
  machines: {
    resource: 'machines',
    label: 'Machines & Assets',
    category: 'factory',
    columns: [
      { key: 'code', label: 'Machine Code' },
      { key: 'name', label: 'Name' },
      { key: 'machineType', label: 'Type' },
      { key: 'status', label: 'Status' },
      { key: 'serialNumber', label: 'Serial #' },
    ],
    defaultPayload: { code: '', name: '', machineType: 'SEWING', status: 'OPERATIONAL' },
    fields: [
      { name: 'code', label: 'Machine Code', type: 'text' },
      { name: 'name', label: 'Machine Name', type: 'text' },
      { name: 'machineType', label: 'Machine Type', type: 'text' },
      { name: 'serialNumber', label: 'Serial Number', type: 'text' },
    ],
  },
  shifts: {
    resource: 'shifts',
    label: 'Factory Shifts',
    category: 'factory',
    columns: [
      { key: 'code', label: 'Shift Code' },
      { key: 'name', label: 'Shift Name' },
      { key: 'startTime', label: 'Start Time' },
      { key: 'endTime', label: 'End Time' },
      { key: 'durationHours', label: 'Duration (hrs)' },
    ],
    defaultPayload: { code: '', name: '', startTime: '08:00', endTime: '16:30', durationHours: 8.5 },
    fields: [
      { name: 'code', label: 'Shift Code', type: 'text' },
      { name: 'name', label: 'Shift Name', type: 'text' },
      { name: 'startTime', label: 'Start Time (HH:MM)', type: 'text' },
      { name: 'endTime', label: 'End Time (HH:MM)', type: 'text' },
      { name: 'durationHours', label: 'Duration (Hours)', type: 'number' },
    ],
  },
  operations: {
    resource: 'operations',
    label: 'Standard Operations (SMV)',
    category: 'process',
    columns: [
      { key: 'code', label: 'Op Code' },
      { key: 'name', label: 'Operation Name' },
      { key: 'standardCycleTimeSeconds', label: 'Cycle Time (sec)' },
      { key: 'difficultyLevel', label: 'Difficulty' },
      { key: 'pieceRate', label: 'Piece Rate' },
    ],
    defaultPayload: { code: '', name: '', standardCycleTimeSeconds: 60, difficultyLevel: 'STANDARD', pieceRate: 0 },
    fields: [
      { name: 'code', label: 'Operation Code', type: 'text' },
      { name: 'name', label: 'Operation Name', type: 'text' },
      { name: 'standardCycleTimeSeconds', label: 'Standard Cycle Time (sec)', type: 'number' },
    ],
  },
  'defect-codes': {
    resource: 'defect-codes',
    label: 'Defect Classifications',
    category: 'process',
    columns: [
      { key: 'code', label: 'Defect Code' },
      { key: 'name', label: 'Defect Name' },
      { key: 'category', label: 'Category' },
      { key: 'severity', label: 'Severity' },
    ],
    defaultPayload: { code: '', name: '', category: 'STITCHING', severity: 'MAJOR' },
    fields: [
      { name: 'code', label: 'Defect Code', type: 'text' },
      { name: 'name', label: 'Defect Name', type: 'text' },
      { name: 'category', label: 'Category (STITCHING, FABRIC, FINISHING)', type: 'text' },
      { name: 'severity', label: 'Severity (MINOR, MAJOR, CRITICAL)', type: 'text' },
    ],
  },
};

export default function MastersPage() {
  const [selectedKey, setSelectedKey] = useState<string>('suppliers');
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeConfig = MASTER_CONFIGS[selectedKey];

  useEffect(() => {
    fetchRecords();
  }, [selectedKey]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await api.getMasters(activeConfig.resource, { search });
      setRecords(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load master records');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRecords();
  };

  const handleOpenCreateModal = () => {
    setFormData({ ...activeConfig.defaultPayload });
    setShowModal(true);
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await api.createMaster(activeConfig.resource, formData);
      setShowModal(false);
      await fetchRecords();
    } catch (err: any) {
      alert(`Validation error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🗄️</span>
            <h1 className="text-xl font-bold text-slate-100">Enterprise Master Data Management</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Governed PostgreSQL master registries with strict unique constraints and RBAC auditing.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded shadow-sm transition"
        >
          <span>➕</span>
          <span>Register New {activeConfig.label.slice(0, -1)}</span>
        </button>
      </div>

      {/* Master Categories Navigation Pills */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {Object.entries(MASTER_CONFIGS).map(([key, config]) => {
          const isSelected = selectedKey === key;
          return (
            <button
              key={key}
              onClick={() => {
                setSelectedKey(key);
                setSearch('');
              }}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                isSelected
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-0.5">
                {config.category}
              </div>
              <div className="text-xs font-bold truncate">{config.label}</div>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between gap-4 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
          <input
            type="text"
            placeholder={`Search ${activeConfig.label}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
          />
          <button
            type="submit"
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded transition"
          >
            Search
          </button>
        </form>

        <div className="text-xs text-slate-400 font-mono">
          Showing <span className="font-bold text-slate-200">{records.length}</span> active records
        </div>
      </div>

      {/* Master Data Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 font-mono">
            Loading {activeConfig.label} records from Neon PostgreSQL...
          </div>
        ) : errorMessage ? (
          <div className="p-8 text-center text-xs text-rose-400 font-mono bg-rose-950/20">
            {errorMessage}
          </div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 font-mono">
            No {activeConfig.label} records found. Click &quot;Register New&quot; to seed entries.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase">
                  {activeConfig.columns.map((col) => (
                    <th key={col.key} className="px-4 py-3">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {records.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-850/50 transition">
                    {activeConfig.columns.map((col) => {
                      const rawVal = row[col.key];
                      const formatted = col.format ? col.format(rawVal) : String(rawVal ?? '—');
                      const isCode = col.key === 'code' || col.key === 'sequenceOrder';

                      return (
                        <td key={col.key} className="px-4 py-3 text-slate-200">
                          {isCode ? (
                            <span className="font-bold text-blue-400">{formatted}</span>
                          ) : (
                            formatted
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right text-slate-500 text-[11px]">
                      {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : 'System'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-slate-100">
                Register New {activeConfig.label.slice(0, -1)}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="space-y-3">
              {activeConfig.fields.map((f) => (
                <div key={f.name}>
                  <label className="block text-[11px] font-mono text-slate-300 mb-1">
                    {f.label}
                  </label>
                  <input
                    type={f.type}
                    value={formData[f.name] ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        [f.name]: f.type === 'number' ? Number(e.target.value) : e.target.value,
                      })
                    }
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              ))}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800 mt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-4 py-2 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded shadow-sm"
                >
                  {isSubmitting ? 'Saving to Database...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
