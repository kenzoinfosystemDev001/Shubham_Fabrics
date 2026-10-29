'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Upload, X } from 'lucide-react';

// Fabric photos of a work line's Production Sheet: the ones this department may see (its own and those of the
// departments before it), and, for Embroidery, Threadcut QC and Stitching, an upload. Used in the work-line
// drawers and the Inventory record drawer. Access is decided by the server from the work line.

interface Photo {
  id: string;
  departmentCode: string;
  departmentLabel: string;
  fabricName: string | null;
  colour: string | null;
  uploadedBy: string;
  createdAt: string;
}
interface LineInfo {
  designNumber: string;
  serialNumber: string;
  productionSheet: string;
}

const DEPT_STYLE: Record<string, string> = {
  EMBROIDERY: 'bg-brand-100 text-brand-800 border-brand-200',
  QC2: 'bg-accent-100 text-accent-800 border-accent-200',
  STITCHING: 'bg-neutral-900 text-white border-neutral-900',
};
const UPLOAD_TITLE: Record<string, string> = {
  EMBROIDERY: 'Upload Fabric Photo',
  QC2: 'Upload Thread Cutting QC Photo',
  STITCHING: 'Upload Stitching Photo',
};

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * Shrinks a camera photo (often 3-8 MB) to at most 2000 px as JPEG before upload, and converts other image
 * types the phone may give (e.g. HEIC) to JPEG. Small JPG / PNG / WebP files are sent as they are.
 */
async function preparePhoto(file: File): Promise<File> {
  if (file.size <= 1.5 * 1024 * 1024 && /^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/** Uploads with progress (fetch has no upload progress). */
function sendPhoto(form: FormData, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/fabric-photos');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = 'Failed to upload the photo.';
      try {
        message = JSON.parse(xhr.responseText).error || message;
      } catch {}
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error('Network error while uploading. Try again.'));
    xhr.send(form);
  });
}

export function FabricPhotos({ workItemId }: { workItemId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [line, setLine] = useState<LineInfo | null>(null);
  const [uploadDept, setUploadDept] = useState<string | null>(null);
  const [visibleFrom, setVisibleFrom] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [viewing, setViewing] = useState<Photo | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/fabric-photos?workItemId=${encodeURIComponent(workItemId)}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load fabric photos.');
      setPhotos(json.data || []);
      setLine(json.line || null);
      setUploadDept(json.canUpload ? json.line?.departmentCode || null : null);
      setVisibleFrom(json.visibleFrom || []);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load fabric photos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workItemId]);

  // Free the preview's object URL when it is replaced or the drawer closes.
  useEffect(() => () => {
    if (pending) URL.revokeObjectURL(pending.url);
  }, [pending]);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || progress !== null) return;
    if (file.type && !file.type.startsWith('image/')) {
      setError('Choose a photo (JPG, PNG or WebP).');
      return;
    }
    setError(null);
    setNotice(null);
    // Uploads straight away (with the preview and progress shown), so a chosen photo is never lost by
    // closing the drawer or pressing Save before a separate Upload button.
    const next = { file, url: URL.createObjectURL(file) };
    setPending(next);
    upload(next);
  };

  const upload = async (target = pending) => {
    if (!target || progress !== null) return;
    try {
      setProgress(0);
      setError(null);
      const file = await preparePhoto(target.file);
      const form = new FormData();
      form.append('workItemId', workItemId);
      form.append('file', file);
      await sendPhoto(form, setProgress);
      setPending(null);
      setNotice('Photo uploaded.');
      await load();
    } catch (e: any) {
      setError(e.message || 'Failed to upload the photo.');
    } finally {
      setProgress(null);
    }
  };

  const src = (p: Photo) => `/api/fabric-photos/${p.id}?workItemId=${encodeURIComponent(workItemId)}`;
  const uploading = progress !== null;

  return (
    <section className="rounded-xl border border-neutral-200 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wide">Fabric Photos</h4>
        {line && (
          <span className="text-[11px] text-neutral-500 truncate">
            Design {line.designNumber || '—'} · Serial {line.serialNumber || '—'}
          </span>
        )}
      </div>

      {error && <p className="text-xs text-danger-700 bg-danger-50 border border-danger-200 rounded-lg px-2.5 py-2">{error}</p>}
      {notice && <p className="text-xs text-accent-800 bg-accent-50 border border-accent-200 rounded-lg px-2.5 py-2">{notice}</p>}

      {/* Upload (Embroidery, Threadcut QC, Stitching) */}
      {uploadDept && (
        <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-2.5 space-y-2">
          <p className="text-xs font-semibold text-neutral-800">{UPLOAD_TITLE[uploadDept] || 'Upload Photo'}</p>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
          <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />
          {!pending ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => cameraRef.current?.click()} className="px-3 py-2 rounded-lg bg-white border border-neutral-300 text-xs font-semibold text-neutral-800 hover:bg-neutral-100 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5" /> Take Photo
              </button>
              <button type="button" onClick={() => galleryRef.current?.click()} className="px-3 py-2 rounded-lg bg-white border border-neutral-300 text-xs font-semibold text-neutral-800 hover:bg-neutral-100 flex items-center gap-1.5">
                <ImagePlus className="w-3.5 h-3.5" /> Choose from Device
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <img src={pending.url} alt="Preview" className="w-24 h-24 object-cover rounded-lg border border-neutral-200 bg-white" />
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-[11px] text-neutral-600 truncate">{pending.file.name}</p>
                {uploading && (
                  <div className="h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                    <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => upload()} disabled={uploading} className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60">
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {uploading ? `Uploading ${progress}%` : 'Try Again'}
                  </button>
                  <button type="button" onClick={() => setPending(null)} disabled={uploading} className="px-3 py-1.5 rounded-lg border border-neutral-300 text-xs font-semibold text-neutral-700 disabled:opacity-60">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Photos, oldest first */}
      {loading ? (
        <p className="text-xs text-neutral-500">Loading photos…</p>
      ) : photos.length === 0 ? (
        <p className="text-xs text-neutral-500 py-2">
          {uploadDept || visibleFrom.length === 0
            ? 'No fabric photos for this production sheet yet.'
            : `No photo uploaded by ${visibleFrom.join(' or ')} for this production sheet yet. It will show here once uploaded.`}
        </p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {photos.map((p) => (
            <li key={p.id} className="rounded-lg border border-neutral-200 overflow-hidden bg-white">
              <button type="button" onClick={() => setViewing(p)} className="block w-full aspect-square bg-neutral-100" title="View full size">
                <img src={src(p)} alt={`${p.departmentLabel} photo`} loading="lazy" className="w-full h-full object-cover" />
              </button>
              <div className="p-2 space-y-0.5">
                <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-bold ${DEPT_STYLE[p.departmentCode] || 'bg-neutral-100 text-neutral-800 border-neutral-200'}`}>
                  {p.departmentLabel}
                </span>
                <p className="text-[10px] text-neutral-700 truncate">{p.uploadedBy || '—'}</p>
                <p className="text-[10px] text-neutral-500">{dateTime(p.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Full-size view */}
      {viewing && (
        <div className="fixed inset-0 z-[60] bg-neutral-900/85 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 text-white mb-2">
              <div className="text-xs space-y-0.5">
                <p className="font-bold text-sm">{viewing.departmentLabel} photo</p>
                <p>
                  Design {line?.designNumber || '—'} · Serial {line?.serialNumber || '—'} · Production Sheet {line?.productionSheet || '—'}
                </p>
                <p>
                  {[viewing.fabricName, viewing.colour].filter(Boolean).join(' · ')}
                  {viewing.fabricName || viewing.colour ? ' · ' : ''}
                  {viewing.uploadedBy || '—'} · {dateTime(viewing.createdAt)}
                </p>
              </div>
              <button type="button" onClick={() => setViewing(null)} className="p-1.5 rounded-lg hover:bg-white/10" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <img src={src(viewing)} alt={`${viewing.departmentLabel} photo`} className="w-full max-h-[80vh] object-contain rounded-lg bg-black" />
          </div>
        </div>
      )}
    </section>
  );
}
