'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Plus, RefreshCw, Trash2, Edit2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function InventoryLocationsPage() {
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingLoc, setEditingLoc] = useState<any>(null);

  // Form states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('RACK');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/fabric-store/locations');
      const json = await res.json();
      setLocations(json.data || []);
    } catch (err: any) {
      console.error('Failed to load locations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingLoc(null);
    setCode('');
    setName('');
    setType('RACK');
    setError('');
    setShowModal(true);
  };

  const openEditModal = (loc: any) => {
    setEditingLoc(loc);
    setCode(loc.locationCode);
    setName(loc.locationName);
    setType(loc.locationType);
    setError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!code.trim() || !name.trim()) {
      setError('Code and Name are required.');
      return;
    }

    try {
      setSaving(true);
      const url = editingLoc
        ? `/api/fabric-store/locations/${editingLoc.id}`
        : '/api/fabric-store/locations';
      const method = editingLoc ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationCode: code.trim(),
          locationName: name.trim(),
          locationType: type,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save location');

      setShowModal(false);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, codeStr: string) => {
    if (!confirm(`Are you sure you want to deactivate location ${codeStr}?`)) return;
    try {
      const res = await fetch(`/api/fabric-store/locations/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await loadData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to deactivate location');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0FAF9] pb-16">
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-8 py-4 flex items-center justify-between shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700 block">
            FABRIC STORE · MASTER CONFIG
          </span>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-teal-600" />
            Storage Locations &amp; Bins
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-md shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Location</span>
          </button>
        </div>
      </header>

      <main className="p-8 max-w-5xl mx-auto space-y-6">
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Configured Storage Areas</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Physical racks, shelves, quarantine zones, and floor spaces for fabric rolls.
              </p>
            </div>
            <span className="text-xs text-slate-500">
              Active: <strong className="text-teal-900">{locations.length}</strong>
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading locations...</div>
          ) : locations.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <MapPin className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No active storage locations</p>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-teal-700 text-white text-xs font-semibold rounded-md shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Create Location</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Location Code</th>
                    <th className="py-3 px-4">Location Name</th>
                    <th className="py-3 px-4">Location Type</th>
                    <th className="py-3 px-4">Rolls Currently Stored</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {locations.map((loc) => (
                    <tr key={loc.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-teal-900">{loc.locationCode}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">{loc.locationName}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                          {loc.locationType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {loc._count?.rolls || 0}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(loc)}
                          className="p-1 text-slate-400 hover:text-teal-700 transition"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(loc.id, loc.locationCode)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition"
                          title="Deactivate"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-teal-600" />
                {editingLoc ? 'Edit Storage Location' : 'New Storage Location'}
              </h3>
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs">
                  {error}
                </div>
              )}
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Location Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RACK-A1, BIN-B3, Q-ZONE"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded px-3 py-2 uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Location Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rack A - Bay 1, Quarantine Staging"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Location Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded px-3 py-2"
                  >
                    <option value="RACK">RACK</option>
                    <option value="BIN">BIN</option>
                    <option value="FLOOR">FLOOR</option>
                    <option value="QUARANTINE">QUARANTINE</option>
                    <option value="DISPATCH">DISPATCH</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-3.5 py-1.5 border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-1.5 bg-teal-700 text-white rounded text-xs font-bold hover:bg-teal-800 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Location'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
