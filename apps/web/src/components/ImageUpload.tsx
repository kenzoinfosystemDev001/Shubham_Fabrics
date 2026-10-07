'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, X, Image as ImageIcon, CheckCircle, Loader2 } from 'lucide-react';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label: string;
  folder?: string;
  helpText?: string;
}

export function ImageUpload({
  value,
  onChange,
  label,
  folder = 'production-sheets',
  helpText = 'PNG, JPG, or WEBP up to 10MB',
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      onChange(data.url);
    } catch (err: any) {
      console.error('Image upload failed:', err);
      setError(err.message || 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClear = () => {
    onChange('');
    setError(null);
  };

  return (
    <div className="w-full">
      <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
        {label}
      </label>

      {value ? (
        <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50 p-2 flex items-center gap-3">
          <div className="w-16 h-16 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
            <img src={value} alt={label} className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-emerald-700 flex items-center gap-1 mb-0.5">
              <CheckCircle className="w-3.5 h-3.5" />
              Image Uploaded / Ready
            </span>
            <p className="text-[10px] font-mono text-slate-400 truncate">{value}</p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
            title="Remove image"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/20 rounded-xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5"
        >
          {uploading ? (
            <>
              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              <span className="text-xs font-semibold text-indigo-900">
                Uploading to Cloud CDN...
              </span>
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-0.5">
                <UploadCloud className="w-4 h-4 text-slate-600" />
              </div>
              <span className="text-xs font-semibold text-slate-700">
                Click to upload image
              </span>
              <span className="text-[10px] text-slate-400">{helpText}</span>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </div>
      )}

      {error && <p className="text-[11px] text-rose-600 mt-1">{error}</p>}
    </div>
  );
}
