'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Shirt } from 'lucide-react';
import { garmentImageUrl, groupGarments, imageFor } from '@/lib/finished-garments.mjs';

/*
 * Finished garments on challans (Finishing onward): each garment is shown by its name and image only.
 */

export interface GarmentImageRef {
  id: string;
  programId: string;
  garmentCategory: string;
  styleRef: string;
  version: number;
}

/** Garment images of these Production Sheets; `reload` after an upload. */
export function useGarmentImages(programIds: Array<string | null | undefined>) {
  const ids = Array.from(new Set(programIds.filter((id): id is string => Boolean(id)))).sort().join(',');
  const [images, setImages] = useState<GarmentImageRef[]>([]);
  const reload = useCallback(async () => {
    if (!ids) {
      setImages([]);
      return;
    }
    try {
      const res = await fetch(`/api/garment-images?programIds=${encodeURIComponent(ids)}`);
      const body = await res.json().catch(() => ({}));
      if (res.ok) setImages(body.data || []);
    } catch {
      /* garments then show without an image */
    }
  }, [ids]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { images, reload };
}

/** The image of a finished garment, or a placeholder when it has none. */
export function GarmentThumb({ image, name, size = 'md' }: { image: GarmentImageRef | null; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'sm' ? 'w-10 h-10' : size === 'lg' ? 'w-24 h-24' : 'w-16 h-16';
  const url = garmentImageUrl(image);
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className={`${box} shrink-0 rounded-lg border border-neutral-200 bg-white overflow-hidden block`} title={`Open the image of ${name}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={name} className="w-full h-full object-cover" loading="lazy" />
    </a>
  ) : (
    <span className={`${box} shrink-0 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 flex items-center justify-center text-neutral-300`} title="No image yet">
      <Shirt className="w-1/2 h-1/2" />
    </span>
  );
}

/** Finishing: add or replace the image of a garment it holds. */
export function GarmentImageUpload({
  programId,
  garmentCategory,
  styleRef,
  hasImage,
  onUploaded,
}: {
  programId: string;
  garmentCategory: string;
  styleRef: string;
  hasImage: boolean;
  onUploaded: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('programId', programId);
      form.append('garmentCategory', garmentCategory);
      form.append('styleRef', styleRef);
      form.append('file', file);
      const res = await fetch('/api/finishing/garment-images', { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Upload failed (${res.status})`);
      onUploaded();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) upload(file);
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold transition disabled:opacity-50 ${
          hasImage ? 'border-neutral-200 text-neutral-600 hover:bg-neutral-50' : 'border-brand-300 bg-brand-50 text-brand-800 hover:bg-brand-100'
        }`}
      >
        <Camera className="w-3.5 h-3.5" />
        {busy ? 'Uploading…' : hasImage ? 'Replace image' : 'Add image'}
      </button>
      {error && <span className="text-[11px] text-danger-700 max-w-[14rem]">{error}</span>}
    </span>
  );
}

/** The garments of a finished-garment challan: one card per garment with its image and name. */
export function FinishedGarmentList({ items, programId, images }: { items: any[]; programId?: string | null; images: GarmentImageRef[] }) {
  const groups = groupGarments((items || []).map((i) => ({ ...i, programId: i.programId || programId })));
  if (groups.length === 0) return <p className="px-5 py-8 text-center text-sm text-neutral-500">No garments on this challan.</p>;
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
      {groups.map((g) => (
        <li key={g.key} className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 bg-white">
          <GarmentThumb image={imageFor(images, g.items[0])} name={g.name} size="lg" />
          <span className="text-sm font-bold text-neutral-900">{g.name}</span>
        </li>
      ))}
    </ul>
  );
}
