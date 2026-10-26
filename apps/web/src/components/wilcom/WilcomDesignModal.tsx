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
  const [dragging, setDragging] = useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);

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
    try {
      if (file) await processPhoto(file);
    } finally {
      e.target.value = '';
    }
  };

  /** Same handling for a picked or a dropped file. */
  const processPhoto = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file');
      return;
    }
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

  const categoryLabel = (c: string) => STANDARD_LABEL[c] || c;
  const counts = wilcomEntries.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + 1;
    return acc;
  }, {});
  const selectedChip = isCustomCategory ? 'OTHER' : category;
  const chooseCategory = (val: string) => {
    if (val === 'OTHER') {
      setIsCustomCategory(true);
      setCategory('OTHER');
      setCustomCategory(defaultStyleName);
    } else {
      setIsCustomCategory(false);
      setCategory(val as GarmentCategory);
      setCustomCategory('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas overflow-hidden" role="dialog" aria-modal="true" aria-label="Wilcom Sheet">
      {/* HEADER */}
      <header className="sticky top-0 z-10 px-4 sm:px-8 py-4 bg-white/90 backdrop-blur border-b border-neutral-200 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-brand-600" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-neutral-900 leading-tight">Wilcom Sheet</h2>
            <p className="text-xs text-neutral-500 truncate">Embroidery designs and artwork for this Production Sheet</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex px-3 py-1 rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700 tabular-nums">
            {wilcomEntries.length} {wilcomEntries.length === 1 ? 'design' : 'designs'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-500 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition cursor-pointer"
            aria-label="Close Wilcom Sheet"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* BODY: form on the left, attached designs on the right */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* DESIGN FORM */}
          <section className={`lg:col-span-5 lg:sticky lg:top-6 bg-white border rounded-2xl shadow-xs overflow-hidden ${editingId ? 'border-brand-300' : 'border-neutral-200'}`}>
            <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                {editingId ? <Edit3 className="w-4 h-4 text-brand-600" /> : <Plus className="w-4 h-4 text-brand-600" />}
                <span>{editingId ? 'Edit Design' : 'Add a Design'}</span>
              </h3>
              {editingId && (
                <button type="button" onClick={resetForm} className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 cursor-pointer">
                  Cancel edit
                </button>
              )}
            </div>

            <div className="p-5 space-y-5">
              {/* Category */}
              <div>
                <span className="block text-xs font-semibold text-neutral-600 mb-2">
                  Category <span className="text-danger-600">*</span>
                </span>
                <div role="radiogroup" aria-label="Category" className="grid grid-cols-4 gap-1.5 p-1 bg-neutral-100 rounded-xl">
                  {CATEGORY_CHIPS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      role="radio"
                      aria-checked={selectedChip === c.value}
                      onClick={() => chooseCategory(c.value)}
                      className={`py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        selectedChip === c.value ? 'bg-white text-brand-800 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                {isCustomCategory && (
                  <label className="block mt-3">
                    <span className="block text-xs font-semibold text-neutral-600 mb-1.5">
                      Category name <span className="text-danger-600">*</span>
                    </span>
                    <input
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="e.g. Koti, Jacket, Belt, Sleeve"
                      className={FIELD_CLASS}
                      autoFocus
                    />
                  </label>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-xs font-semibold text-neutral-600 mb-1.5">Style name / part</span>
                  <input type="text" value={styleName} onChange={(e) => setStyleName(e.target.value)} className={FIELD_CLASS} />
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold text-neutral-600 mb-1.5">Design number</span>
                  <input
                    type="text"
                    value={designNumber}
                    onChange={(e) => setDesignNumber(e.target.value)}
                    className={`${FIELD_CLASS} font-mono font-semibold uppercase`}
                  />
                </label>
              </div>

              {/* Artwork */}
              <div>
                <span className="block text-xs font-semibold text-neutral-600 mb-1.5">Artwork photo</span>
                <input ref={fileInput} type="file" accept="image/*" onChange={handlePhotoUpload} className="sr-only" aria-label="Artwork photo" />
                {photoUrl ? (
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 flex items-center gap-4">
                    <div className="w-28 h-28 rounded-lg bg-white border border-neutral-200 flex items-center justify-center overflow-hidden shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoUrl} alt="Artwork preview" className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-800">
                        <Check className="w-3.5 h-3.5" />
                        Photo attached
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => fileInput.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-lg text-xs font-semibold text-neutral-700 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Replace
                        </button>
                        <button
                          type="button"
                          onClick={() => setPhotoUrl('')}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-danger-700 hover:bg-danger-50 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) void processPhoto(file);
                    }}
                    className={`w-full rounded-xl border-2 border-dashed px-4 py-7 flex flex-col items-center gap-2 text-center transition cursor-pointer ${
                      dragging ? 'border-brand-500 bg-brand-50' : 'border-neutral-300 bg-neutral-50 hover:border-brand-300 hover:bg-brand-50/40'
                    }`}
                  >
                    <span className="w-10 h-10 rounded-full bg-white border border-neutral-200 flex items-center justify-center">
                      <Upload className="w-4 h-4 text-brand-600" />
                    </span>
                    <span className="text-sm font-semibold text-neutral-800">Upload artwork</span>
                    <span className="text-xs text-neutral-500">Click or drop an image here (up to 15 MB)</span>
                  </button>
                )}
              </div>

              <label className="block">
                <span className="block text-xs font-semibold text-neutral-600 mb-1.5">Notes / instructions</span>
                <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} className={`${FIELD_CLASS} h-auto py-2.5 resize-y`} />
              </label>

              <button
                type="button"
                onClick={handleSaveCurrent}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-xs transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{editingId ? 'Update Design' : 'Add Design'}</span>
              </button>
            </div>
          </section>

          {/* ATTACHED DESIGNS */}
          <section className="lg:col-span-7 space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              Attached Designs
              <span className="text-[11px] font-semibold tabular-nums bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{wilcomEntries.length}</span>
            </h3>

            {wilcomEntries.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {wilcomEntries.map((entry, idx) => {
                  const editing = editingId === entry.id;
                  return (
                    <article
                      key={entry.id || idx}
                      className={`bg-white border rounded-2xl overflow-hidden shadow-xs transition ${
                        editing ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-neutral-200 hover:border-brand-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="aspect-[4/3] bg-neutral-50 border-b border-neutral-200 flex items-center justify-center overflow-hidden">
                        {entry.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={entry.photoUrl} alt={`Artwork ${entry.wilcomDesignNumber}`} className="max-w-full max-h-full object-contain p-2" />
                        ) : (
                          <span className="flex flex-col items-center gap-1 text-neutral-400">
                            <ImageIcon className="w-6 h-6" />
                            <span className="text-[11px]">No artwork photo</span>
                          </span>
                        )}
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${CATEGORY_TONE[entry.category] || 'bg-neutral-100 text-neutral-700'}`}>
                              {categoryLabel(entry.category)}
                            </span>
                            <p className="font-mono text-sm font-bold text-neutral-900 truncate">{entry.wilcomDesignNumber}</p>
                            {entry.styleName && <p className="text-xs text-neutral-700 truncate">{entry.styleName}</p>}
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEdit(entry)}
                              className="p-1.5 text-neutral-500 hover:text-brand-700 hover:bg-brand-50 rounded-lg cursor-pointer transition"
                              title="Edit design"
                              aria-label={`Edit ${entry.wilcomDesignNumber}`}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(entry.id)}
                              className="p-1.5 text-neutral-500 hover:text-danger-600 hover:bg-danger-50 rounded-lg cursor-pointer transition"
                              title="Delete design"
                              aria-label={`Delete ${entry.wilcomDesignNumber}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {entry.remarks && <p className="text-xs text-neutral-500 line-clamp-2">{entry.remarks}</p>}
                        {editing && <p className="text-[11px] font-semibold text-brand-700">Editing in the form</p>}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white border-2 border-dashed border-neutral-200 rounded-2xl px-6 py-16 flex flex-col items-center text-center gap-2">
                <span className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-brand-600" />
                </span>
                <p className="text-sm font-semibold text-neutral-800">No Wilcom designs yet</p>
                <p className="text-xs text-neutral-500 max-w-xs">
                  Add each embroidery design with its category, design number and artwork. They appear here and on the printed Wilcom sheet.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="px-4 sm:px-8 py-3.5 bg-white border-t border-neutral-200 flex items-center justify-between gap-4 shrink-0">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-600">
          {wilcomEntries.length === 0 ? (
            <span>No designs attached</span>
          ) : (
            Object.entries(counts).map(([cat, n]) => (
              <span key={cat} className={`inline-flex px-2 py-0.5 rounded-md font-semibold ${CATEGORY_TONE[cat] || 'bg-neutral-100 text-neutral-700'}`}>
                {categoryLabel(cat)} · {n}
              </span>
            ))
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold transition shadow-xs cursor-pointer"
        >
          Done
        </button>
      </footer>
    </div>
  );
}

const FIELD_CLASS =
  'w-full h-11 px-3.5 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition';

const CATEGORY_CHIPS = [
  { value: 'TOP', label: 'Top' },
  { value: 'BOTTOM', label: 'Bottom' },
  { value: 'DUPATTA', label: 'Dupatta' },
  { value: 'OTHER', label: 'Other' },
];

const STANDARD_LABEL: Record<string, string> = { TOP: 'Top', BOTTOM: 'Bottom', DUPATTA: 'Dupatta', OTHER: 'Other' };

// Readable tones (the old Top badge was dark text on dark lavender).
const CATEGORY_TONE: Record<string, string> = {
  TOP: 'bg-brand-100 text-brand-800',
  BOTTOM: 'bg-accent-100 text-neutral-900',
  DUPATTA: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
};
