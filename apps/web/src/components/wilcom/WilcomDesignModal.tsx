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
  const [customCategory, setCustomCategory] = useState(
    activeCategory === 'OTHER'
      ? defaultStyleName
      : !['TOP', 'BOTTOM', 'DUPATTA'].includes(activeCategory)
        ? activeCategory
        : ''
  );
  const [isCustomCategory, setIsCustomCategory] = useState(
    activeCategory === 'OTHER' || !['TOP', 'BOTTOM', 'DUPATTA'].includes(activeCategory)
  );
  const [styleName, setStyleName] = useState('');
  const [designNumber, setDesignNumber] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [remarks, setRemarks] = useState('');

  // Synchronize state when modal opens or active category changes
  React.useEffect(() => {
    if (isOpen && !editingId) {
      const isCustom = activeCategory === 'OTHER' || !['TOP', 'BOTTOM', 'DUPATTA'].includes(activeCategory);
      setIsCustomCategory(isCustom);
      setCategory(isCustom ? 'OTHER' : activeCategory);
      if (activeCategory === 'OTHER') {
        setCustomCategory(defaultStyleName);
      } else if (!['TOP', 'BOTTOM', 'DUPATTA', 'OTHER'].includes(activeCategory)) {
        setCustomCategory(activeCategory);
      } else {
        setCustomCategory('');
      }
      setStyleName('');
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
    setCustomCategory(
      activeCategory === 'OTHER'
        ? defaultStyleName
        : !['TOP', 'BOTTOM', 'DUPATTA'].includes(activeCategory)
          ? activeCategory
          : ''
    );
    setStyleName('');
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-white overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full h-full flex flex-col overflow-hidden animate-in fade-in duration-200">
        
        {/* MODAL HEADER */}
        <div className="px-7 py-4 border-b border-neutral-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-brand-600 shadow-2xs">
              <Sparkles className="w-7 h-7 text-brand-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
                Wilcom Sheet
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-4 py-2 bg-neutral-100 border border-neutral-200 rounded-full text-sm font-semibold text-neutral-700">
              {wilcomEntries.length} {wilcomEntries.length === 1 ? 'Design' : 'Designs'}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-neutral-500 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition cursor-pointer"
              title="Close modal"
            >
              <X className="w-7 h-7" />
            </button>
          </div>
        </div>

        {/* MODAL CONTENT */}
        <div className="px-7 py-8 overflow-y-auto space-y-8 flex-1 bg-neutral-50/50">
          
          {/* ENTRY FORM */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-7 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <h3 className="text-base font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-brand-600" />
                <span>{editingId ? 'Edit Design' : 'Add Design'}</span>
              </h3>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-sm font-semibold text-neutral-500 hover:text-neutral-900 underline cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-6 text-sm">
              {/* Category */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="block text-sm font-bold text-neutral-700 uppercase">
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
                      className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 underline cursor-pointer whitespace-nowrap"
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
                      setCustomCategory(defaultStyleName);
                    } else {
                      setIsCustomCategory(false);
                      setCategory(val as GarmentCategory);
                      setCustomCategory('');
                    }
                  }}
                  className="w-full h-12 px-4 rounded-xl border border-neutral-300 bg-white font-medium text-base text-neutral-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
                >
                  <option value="TOP">Top</option>
                  <option value="BOTTOM">Bottom</option>
                  <option value="DUPATTA">Dupatta</option>
                  <option value="OTHER">Other (Enter Custom Name)</option>
                </select>

                {isCustomCategory && (
                  <div className="mt-4 space-y-2 animate-in fade-in duration-150">
                    <label className="block text-sm font-bold text-neutral-700 uppercase">
                      Category Name *
                    </label>
                    <input
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="ENTER CATEGORY NAME (E.G. KOTI, JACKET, BELT, SLEEVE)"
                      className="w-full h-12 px-4 rounded-xl border border-neutral-300 bg-white font-medium text-base text-neutral-900 placeholder:text-neutral-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 shadow-2xs"
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* Style Name / Part */}
              <div>
                <label className="block text-sm font-bold text-neutral-700 uppercase mb-2">
                  Style Name / Part
                </label>
                <input
                  type="text"
                  value={styleName}
                  onChange={(e) => setStyleName(e.target.value)}
                  placeholder=""
                  className="w-full h-12 px-4 rounded-xl border border-neutral-300 bg-white text-base font-medium text-neutral-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
                />
              </div>

              {/* Wilcom Design Number */}
              <div>
                <label className="block text-sm font-bold text-neutral-700 uppercase mb-2">
                  Design Number
                </label>
                <input
                  type="text"
                  value={designNumber}
                  onChange={(e) => setDesignNumber(e.target.value)}
                  placeholder=""
                  className="w-full h-12 px-4 rounded-xl border border-neutral-300 bg-white font-mono font-bold text-base uppercase text-neutral-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
                />
              </div>

              {/* Artwork Photo Upload */}
              <div className="sm:col-span-3">
                <label className="block text-sm font-bold text-neutral-700 uppercase mb-2">
                  Artwork Photo
                </label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-3 px-5 py-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 cursor-pointer font-semibold text-base transition shadow-2xs">
                    <Upload className="w-5 h-5 text-neutral-600" />
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
                      className="text-sm font-semibold text-danger-600 hover:text-danger-800 underline cursor-pointer"
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
                      className="w-14 h-14 object-contain rounded-lg border border-neutral-200 bg-white shadow-2xs p-1"
                    />
                    <span className="text-xs text-accent-800 font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Photo Ready
                    </span>
                  </div>
                )}
              </div>

              {/* Remarks */}
              <div className="sm:col-span-3">
                <label className="block text-sm font-bold text-neutral-700 uppercase mb-2">
                  Notes / Instructions
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder=""
                  className="w-full h-12 px-4 rounded-xl border border-neutral-300 bg-white text-base text-neutral-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSaveCurrent}
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-base font-bold shadow-xs transition cursor-pointer"
              >
                <Check className="w-5 h-5" />
                <span>{editingId ? 'Update Design' : 'Add Design'}</span>
              </button>
            </div>
          </div>

          {/* LIST OF CURRENT ENTRIES */}
          <div className="space-y-4">
            <h3 className="text-base font-bold uppercase tracking-wider text-neutral-900">
              Attached Designs ({wilcomEntries.length})
            </h3>

            {wilcomEntries.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {wilcomEntries.map((entry, idx) => (
                  <div
                    key={entry.id || idx}
                    className="p-3.5 rounded-xl border border-neutral-200 bg-white flex items-start justify-between gap-3 shadow-2xs hover:border-neutral-300 transition"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-lg border border-neutral-200 bg-neutral-50 flex items-center justify-center shrink-0 overflow-hidden">
                        {entry.photoUrl ? (
                          <img
                            src={entry.photoUrl}
                            alt={entry.wilcomDesignNumber}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-neutral-500" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase text-neutral-900 ${
                            entry.category === 'TOP'
                              ? 'bg-brand-600'
                              : entry.category === 'BOTTOM'
                                ? 'bg-accent-500'
                                : entry.category === 'DUPATTA'
                                  ? 'bg-accent-500'
                                  : 'bg-neutral-200'
                          }`}>
                            {entry.category}
                          </span>
                          {entry.styleName && (
                            <span className="font-semibold text-neutral-900 truncate">
                              {entry.styleName}
                            </span>
                          )}
                        </div>
                        <div className="font-mono font-bold text-neutral-900 text-xs">
                          {entry.wilcomDesignNumber}
                        </div>
                        {entry.remarks && (
                          <p className="text-[11px] text-neutral-500 truncate">
                            {entry.remarks}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEdit(entry)}
                        className="p-1.5 text-neutral-500 hover:text-brand-600 hover:bg-neutral-100 rounded-lg cursor-pointer transition"
                        title="Edit design"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.id)}
                        className="p-1.5 text-neutral-500 hover:text-danger-600 hover:bg-danger-50 rounded-lg cursor-pointer transition"
                        title="Delete design"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center border border-dashed border-neutral-200 rounded-xl bg-white text-neutral-500 text-xs">
                No Wilcom designs added yet.
              </div>
            )}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="px-7 py-5 border-t border-neutral-200 bg-white flex items-center justify-between shrink-0">
          <div className="text-base font-medium text-neutral-500">
            {wilcomEntries.length} {wilcomEntries.length === 1 ? 'design' : 'designs'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-base font-bold transition shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
