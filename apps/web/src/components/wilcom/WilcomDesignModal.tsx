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
import { WilcomEntry, GarmentCategory, compressImageForUpload } from '@/lib/download-wilcom';

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
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(
    activeCategory === 'OTHER' || !['TOP', 'BOTTOM', 'DUPATTA'].includes(activeCategory)
  );
  const [styleName, setStyleName] = useState(defaultStyleName || '');
  const [designNumber, setDesignNumber] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [remarks, setRemarks] = useState('');

  // Synchronize state when modal opens or active category changes
  React.useEffect(() => {
    if (isOpen && !editingId) {
      const isCustom = activeCategory === 'OTHER' || !['TOP', 'BOTTOM', 'DUPATTA'].includes(activeCategory);
      setIsCustomCategory(isCustom);
      setCategory(isCustom ? 'OTHER' : activeCategory);
      if (!['TOP', 'BOTTOM', 'DUPATTA', 'OTHER'].includes(activeCategory)) {
        setCustomCategory(activeCategory);
      } else {
        setCustomCategory('');
      }
      if (defaultStyleName) {
        setStyleName(defaultStyleName);
      }
    }
  }, [isOpen, activeCategory, defaultStyleName, editingId]);

  if (!isOpen) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('Photo must be less than 15MB');
      return;
    }

    try {
      let uploadedPhoto: string;
      try {
        uploadedPhoto = await compressImageForUpload(file);
        if (!uploadedPhoto) throw new Error('Could not process image');
      } catch {
        uploadedPhoto = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('Failed to read image file'));
          reader.onload = () => {
            if (typeof reader.result === 'string') resolve(reader.result);
            else reject(new Error('Failed to read image file'));
          };
          reader.readAsDataURL(file);
        });
      }

      setPhotoUrl(uploadedPhoto);
      const finalCategory = isCustomCategory
        ? customCategory.trim().toUpperCase() || 'OTHER'
        : category;
      const existingEntry = editingId
        ? wilcomEntries.find((entry) => entry.id === editingId)
        : undefined;
      const entry: WilcomEntry = {
        id: existingEntry?.id || `wilcom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        category: finalCategory,
        styleName: styleName.trim(),
        wilcomDesignNumber:
          designNumber.trim().toUpperCase() ||
          defaultStyleName?.trim().toUpperCase() ||
          'WLC-01',
        photoUrl: uploadedPhoto,
        remarks: remarks.trim() || undefined,
        createdAt: existingEntry?.createdAt || new Date().toISOString(),
      };
      const updatedEntries = existingEntry
        ? wilcomEntries.map((item) => (item.id === existingEntry.id ? entry : item))
        : [...wilcomEntries, entry];

      onSaveEntries(updatedEntries);
      setEditingId(entry.id);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to read image file');
    } finally {
      e.target.value = '';
    }
  };

  const handleEdit = (entry: WilcomEntry) => {
    setEditingId(entry.id);
    const isStandard = ['TOP', 'BOTTOM', 'DUPATTA'].includes(entry.category);
    if (isStandard) {
      setCategory(entry.category);
      setIsCustomCategory(false);
      setCustomCategory('');
    } else {
      setCategory('OTHER');
      setIsCustomCategory(true);
      setCustomCategory(entry.category === 'OTHER' ? '' : entry.category);
    }
    setStyleName(entry.styleName);
    setDesignNumber(entry.wilcomDesignNumber);
    setPhotoUrl(entry.photoUrl || '');
    setRemarks(entry.remarks || '');
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to remove this Wilcom design?')) {
      const updated = wilcomEntries.filter((e) => e.id !== id);
      onSaveEntries(updated);
      if (editingId === id) {
        resetForm();
      }
    }
  };

  const resetForm = () => {
    setEditingId(null);
    const isCustom = activeCategory === 'OTHER' || !['TOP', 'BOTTOM', 'DUPATTA'].includes(activeCategory);
    setIsCustomCategory(isCustom);
    setCategory(isCustom ? 'OTHER' : activeCategory);
    setCustomCategory(!['TOP', 'BOTTOM', 'DUPATTA', 'OTHER'].includes(activeCategory) ? activeCategory : '');
    setStyleName(defaultStyleName || '');
    setDesignNumber('');
    setPhotoUrl('');
    setRemarks('');
  };

  const handleSaveCurrent = () => {
    const finalDesignNumber = designNumber.trim().toUpperCase() || defaultStyleName?.trim().toUpperCase() || 'WLC-01';

    let finalCategory = category;
    if (isCustomCategory) {
      const trimmedCustom = customCategory.trim().toUpperCase();
      if (!trimmedCustom) {
        alert('Please enter a category name (e.g. Koti, Jacket, Belt, Sleeve)');
        return;
      }
      finalCategory = trimmedCustom;
    }

    if (editingId) {
      const existingEntry = wilcomEntries.find((entry) => entry.id === editingId);
      const updated = wilcomEntries.map((e) =>
        e.id === editingId
          ? {
              ...e,
              category: finalCategory,
              styleName: styleName.trim(),
              wilcomDesignNumber: finalDesignNumber,
              photoUrl: photoUrl.trim() || undefined,
              remarks: remarks.trim() || undefined,
              createdAt: existingEntry?.createdAt,
            }
          : e
      );
      onSaveEntries(updated);
    } else {
      const newEntry: WilcomEntry = {
        id: `wilcom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        category: finalCategory,
        styleName: styleName.trim(),
        wilcomDesignNumber: finalDesignNumber,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#163767] shadow-2xs">
              <Sparkles className="w-5 h-5 text-[#163767]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Wilcom {activeCategory ? `${activeCategory} ` : ''}Design Specifications
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-xs font-semibold text-slate-700">
              {wilcomEntries.length} {wilcomEntries.length === 1 ? 'Design' : 'Designs'}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL CONTENT */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/60">
          
          {/* ENTRY FORM */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-[#163767]" />
                <span>{editingId ? 'Edit Design' : 'Add Design'}</span>
              </h3>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {/* Category */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">
                    Category *
                  </label>
                  {isCustomCategory && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomCategory(false);
                        setCategory('TOP');
                        setCustomCategory('');
                      }}
                      className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                    >
                      Standard (Top/Bottom/Dupatta)
                    </button>
                  )}
                </div>
                <select
                  value={isCustomCategory ? 'OTHER' : category}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'OTHER') {
                      setIsCustomCategory(true);
                      setCategory('OTHER');
                    } else {
                      setIsCustomCategory(false);
                      setCategory(val as GarmentCategory);
                      setCustomCategory('');
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-xs text-slate-900 focus:border-[#163767] focus:ring-1 focus:ring-[#163767] focus:outline-none"
                >
                  <option value="TOP">Top</option>
                  <option value="BOTTOM">Bottom</option>
                  <option value="DUPATTA">Dupatta</option>
                  <option value="OTHER">Other (Enter Custom Name)</option>
                </select>

                {isCustomCategory && (
                  <div className="mt-2 space-y-1 animate-in fade-in duration-150">
                    <label className="block text-[10px] font-bold text-[#163767] uppercase">
                      Category Name *
                    </label>
                    <input
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="Enter Category Name (e.g. Koti, Jacket, Belt, Sleeve)..."
                      className="w-full px-3 py-2 rounded-lg border-2 border-[#163767] bg-white font-bold text-xs uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#163767]/30 shadow-2xs"
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* Style Name / Part */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Style Name / Part
                </label>
                <input
                  type="text"
                  value={styleName}
                  onChange={(e) => setStyleName(e.target.value)}
                  placeholder=""
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-900 focus:border-[#163767] focus:ring-1 focus:ring-[#163767] focus:outline-none"
                />
              </div>

              {/* Wilcom Design Number */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Design Number
                </label>
                <input
                  type="text"
                  value={designNumber}
                  onChange={(e) => setDesignNumber(e.target.value)}
                  placeholder=""
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono font-bold text-xs uppercase text-slate-900 focus:border-[#163767] focus:ring-1 focus:ring-[#163767] focus:outline-none"
                />
              </div>

              {/* Artwork Photo Upload */}
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Artwork Photo
                </label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer font-semibold text-xs transition shadow-2xs">
                    <Upload className="w-4 h-4 text-slate-600" />
                    <span>Upload Photo</span>
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
                      className="text-xs font-semibold text-rose-600 hover:text-rose-800 underline cursor-pointer"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>

                {photoUrl && (
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <img
                      src={photoUrl}
                      alt="Wilcom preview"
                      className="w-14 h-14 object-contain rounded-lg border border-slate-200 bg-white shadow-2xs p-1"
                    />
                    <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Photo Ready
                    </span>
                  </div>
                )}
              </div>

              {/* Remarks */}
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Notes / Instructions
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder=""
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:border-[#163767] focus:ring-1 focus:ring-[#163767] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSaveCurrent}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#163767] hover:bg-[#0F264A] text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{editingId ? 'Update Design' : 'Add Design'}</span>
              </button>
            </div>
          </div>

          {/* LIST OF CURRENT ENTRIES */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Attached Designs ({wilcomEntries.length})
            </h3>

            {wilcomEntries.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {wilcomEntries.map((entry, idx) => (
                  <div
                    key={entry.id || idx}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-start justify-between gap-3 shadow-2xs hover:border-slate-300 transition"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
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

                      <div className="min-w-0 flex-1 space-y-1 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase text-white ${
                            entry.category === 'TOP'
                              ? 'bg-[#163767]'
                              : entry.category === 'BOTTOM'
                                ? 'bg-emerald-700'
                                : entry.category === 'DUPATTA'
                                  ? 'bg-amber-700'
                                  : 'bg-slate-700'
                          }`}>
                            {entry.category}
                          </span>
                          {entry.styleName && (
                            <span className="font-semibold text-slate-900 truncate">
                              {entry.styleName}
                            </span>
                          )}
                        </div>
                        <div className="font-mono font-bold text-slate-900 text-xs">
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
                        className="p-1.5 text-slate-400 hover:text-[#163767] hover:bg-slate-100 rounded-lg cursor-pointer transition"
                        title="Edit design"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition"
                        title="Delete design"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl bg-white text-slate-400 text-xs">
                No Wilcom designs added yet.
              </div>
            )}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between">
          <div className="text-xs font-medium text-slate-500">
            {wilcomEntries.length} {wilcomEntries.length === 1 ? 'design' : 'designs'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#163767] hover:bg-[#0F264A] text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
