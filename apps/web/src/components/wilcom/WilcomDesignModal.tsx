'use client';

import React, { useState } from 'react';
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  Upload, 
  Image as ImageIcon, 
  Edit3, 
  Check, 
  X 
} from 'lucide-react';
import { WilcomEntry, GarmentCategory } from '@/lib/download-wilcom';

interface WilcomDesignModalProps {
  isOpen: boolean;
  onClose: () => void;
  wilcomEntries: WilcomEntry[];
  onSaveEntries: (entries: WilcomEntry[]) => void;
  activeCategory?: GarmentCategory;
  defaultStyleName?: string;
}

export function WilcomDesignModal({
  isOpen,
  onClose,
  wilcomEntries,
  onSaveEntries,
  activeCategory = 'TOP',
  defaultStyleName = '',
}: WilcomDesignModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [category, setCategory] = useState<GarmentCategory>(activeCategory);
  const [styleName, setStyleName] = useState(defaultStyleName);
  const [designNumber, setDesignNumber] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [remarks, setRemarks] = useState('');

  if (!isOpen) return null;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      alert('Photo must be less than 8MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEdit = (entry: WilcomEntry) => {
    setEditingId(entry.id);
    setCategory(entry.category);
    setStyleName(entry.styleName);
    setDesignNumber(entry.wilcomDesignNumber);
    setPhotoUrl(entry.photoUrl || '');
    setRemarks(entry.remarks || '');
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to remove this Wilcom design entry?')) {
      const updated = wilcomEntries.filter((e) => e.id !== id);
      onSaveEntries(updated);
      if (editingId === id) {
        resetForm();
      }
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setStyleName(defaultStyleName);
    setDesignNumber('');
    setPhotoUrl('');
    setRemarks('');
  };

  const handleSaveCurrent = () => {
    if (!designNumber.trim()) {
      alert('Please enter a Wilcom Design Number');
      return;
    }

    if (editingId) {
      const updated = wilcomEntries.map((e) =>
        e.id === editingId
          ? {
              ...e,
              category,
              styleName: styleName.trim() || 'Garment Style',
              wilcomDesignNumber: designNumber.trim().toUpperCase(),
              photoUrl: photoUrl.trim() || undefined,
              remarks: remarks.trim() || undefined,
            }
          : e
      );
      onSaveEntries(updated);
    } else {
      const newEntry: WilcomEntry = {
        id: `wilcom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        category,
        styleName: styleName.trim() || 'Garment Style',
        wilcomDesignNumber: designNumber.trim().toUpperCase(),
        photoUrl: photoUrl.trim() || undefined,
        remarks: remarks.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      onSaveEntries([...wilcomEntries, newEntry]);
    }

    resetForm();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-purple-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="px-5 py-4 border-b border-purple-100 flex items-center justify-between bg-gradient-to-r from-purple-50 via-white to-purple-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 text-purple-800 rounded-xl shadow-2xs">
              <Sparkles className="w-5 h-5 text-purple-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-900 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">
                  STAGE 2 &middot; WILCOM FORM MANAGEMENT
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  {category} SHEET
                </span>
              </div>
              <h2 className="text-base font-black text-slate-900 mt-0.5">
                Wilcom Embroidery Design Specifications
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-[11px] text-slate-500 block">Total Designs</span>
              <span className="font-black text-purple-700 font-mono text-sm">{wilcomEntries.length}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL CONTENT */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          
          {/* ENTRY FORM */}
          <div className="bg-white border-2 border-purple-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-purple-600" />
                <span>{editingId ? 'Edit Wilcom Design Entry' : '+ Add Wilcom Design Entry'}</span>
              </h3>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {/* Category */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Component Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as GarmentCategory)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold focus:ring-2 focus:ring-purple-400 focus:outline-hidden"
                >
                  <option value="TOP">TOP Sheet</option>
                  <option value="BOTTOM">BOTTOM Sheet</option>
                  <option value="DUPATTA">DUPATTA Sheet</option>
                  <option value="OTHER">OTHER Sheet</option>
                </select>
              </div>

              {/* Style Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Style Name / Garment Part
                </label>
                <input
                  type="text"
                  value={styleName}
                  onChange={(e) => setStyleName(e.target.value)}
                  placeholder="e.g. Kurti Neck, Yoke, Bottom Border"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium focus:ring-2 focus:ring-purple-400 focus:outline-hidden"
                />
              </div>

              {/* Wilcom Design Number */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Wilcom Design Number *
                </label>
                <input
                  type="text"
                  value={designNumber}
                  onChange={(e) => setDesignNumber(e.target.value)}
                  placeholder="e.g. WLC-1049, EMB-22"
                  className="w-full px-3 py-2 rounded-lg border border-purple-300 font-mono font-bold text-purple-950 bg-purple-50/30 focus:ring-2 focus:ring-purple-400 focus:outline-hidden uppercase"
                />
              </div>

              {/* Artwork Photo Upload */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Embroidery Design Reference Artwork Photo
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-purple-400 bg-purple-50/50 hover:bg-purple-100/50 text-purple-900 cursor-pointer font-bold text-xs transition">
                    <Upload className="w-4 h-4 text-purple-700" />
                    <span>Upload Artwork Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="text-xs font-bold text-rose-600 hover:text-rose-800 underline cursor-pointer"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>

                {photoUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={photoUrl}
                      alt="Wilcom preview"
                      className="w-14 h-14 object-contain rounded border border-purple-300 bg-white shadow-2xs"
                    />
                    <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Artwork Photo Ready
                    </span>
                  </div>
                )}
              </div>

              {/* Remarks */}
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Wilcom / Embroidery Notes &amp; Special Instructions
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Stitches: 28,000, 3-thread cordon, gold zari highlight"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-purple-400 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSaveCurrent}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{editingId ? 'Update Wilcom Entry' : '+ Add Wilcom Design'}</span>
              </button>
            </div>
          </div>

          {/* LIST OF CURRENT ENTRIES */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Attached Wilcom Design Entries ({wilcomEntries.length})
              </h3>
            </div>

            {wilcomEntries.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {wilcomEntries.map((entry, idx) => (
                  <div
                    key={entry.id || idx}
                    className={`p-3 rounded-lg border bg-white flex items-start justify-between gap-3 shadow-2xs transition ${
                      entry.category === category ? 'border-purple-300 ring-1 ring-purple-200' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                        {entry.photoUrl ? (
                          <img
                            src={entry.photoUrl}
                            alt={entry.wilcomDesignNumber}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-slate-400" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-0.5 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase text-white ${
                            entry.category === 'TOP'
                              ? 'bg-blue-600'
                              : entry.category === 'BOTTOM'
                                ? 'bg-emerald-600'
                                : 'bg-purple-600'
                          }`}>
                            {entry.category}
                          </span>
                          <span className="font-bold text-slate-900 truncate">
                            {entry.styleName}
                          </span>
                        </div>
                        <div className="font-mono font-bold text-purple-950 text-xs">
                          {entry.wilcomDesignNumber}
                        </div>
                        {entry.remarks && (
                          <p className="text-[11px] text-slate-500 truncate">
                            {entry.remarks}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEdit(entry)}
                        className="p-1.5 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded cursor-pointer transition"
                        title="Edit entry"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer transition"
                        title="Delete entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
                No Wilcom designs added yet. Add at least one above for embroidery production.
              </div>
            )}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {wilcomEntries.length} {wilcomEntries.length === 1 ? 'entry' : 'entries'} currently attached
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
          >
            Done Managing Wilcom
          </button>
        </div>

      </div>
    </div>
  );
}
