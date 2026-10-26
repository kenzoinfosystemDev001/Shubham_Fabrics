'use client';

import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, RefreshCw, RotateCcw, Upload, X } from 'lucide-react';
import {
  DEFAULT_APP_BACKGROUND,
  DEFAULT_LOGIN_BACKGROUND,
  DEFAULT_SIDEBAR_IMAGE,
  appBackgroundSrc,
  loginBackgroundSrc,
  sidebarImageSrc,
} from '@/lib/branding';
import {
  ALLOWED_DEPARTMENT_IMAGE_TYPES,
  MAX_ALT_TEXT_LENGTH,
  MAX_DEPARTMENT_IMAGE_BYTES,
  sniffDepartmentImageType,
} from '@/lib/department-images';

interface BrandingImageInfo {
  id: string;
  storage: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
  altText: string;
  isActive: boolean;
  version: number;
  updatedAt: string;
  uploadedBy: string | null;
}

type Notify = (text: string, type?: 'success' | 'error') => void;

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** A scaled-down login screen with the same background framing and overlay as the real page. */
function LoginPreview({ src, dimmed }: { src: string; dimmed?: boolean }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
      <div
        className={`absolute inset-0 bg-cover bg-center bg-no-repeat ${dimmed ? 'opacity-30 grayscale' : ''}`}
        style={{ backgroundImage: `url("${src}"), url("${DEFAULT_LOGIN_BACKGROUND}")` }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-white/40 to-brand-100/50" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_60%_at_50%_45%,rgba(255,255,255,0.6),transparent)]" />
      {/* Same layout as the login page: logo, glass station tiles on the background, small sign-in panel. */}
      <div className="absolute left-1/2 top-1/2 flex w-[46%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[4%]">
        <img src="/shubham-logo-mark.png" alt="" className="h-4 w-auto sm:h-6" />
        <div className="h-1 w-1/3 rounded-full bg-neutral-800" />
        <div className="grid w-full grid-cols-4 gap-1">
          {Array.from({ length: 16 }, (_, i) => (
            <div
              key={i}
              className={`h-3 rounded-sm border ${i === 1 ? 'border-brand-500 bg-brand-50/90' : 'border-white/80 bg-white/65'}`}
            />
          ))}
        </div>
        <div className="w-3/5 space-y-1">
          <div className="h-2 rounded-sm border border-white/80 bg-white/85" />
          <div className="h-2 rounded-sm border border-white/80 bg-white/85" />
          <div className="h-2.5 rounded-sm bg-brand-600" />
        </div>
      </div>
    </div>
  );
}

/** A scaled-down department page: sidebar, header and white cards over the shared background. */
function DepartmentPreview({ src, dimmed, off }: { src: string; dimmed?: boolean; off?: boolean }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-neutral-200 bg-canvas flex">
      <div className="w-[18%] h-full bg-white border-r border-neutral-200 p-[1.5%] space-y-1.5">
        <div className="h-2.5 w-3/4 rounded-sm bg-neutral-800" />
        {[80, 65, 70, 55].map((w) => (
          <div key={w} className="h-1.5 rounded-full bg-neutral-200" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="relative flex-1">
        {!off && (
          <>
            <div
              className={`absolute inset-0 bg-cover bg-center bg-no-repeat ${dimmed ? 'opacity-30 grayscale' : ''}`}
              style={{ backgroundImage: `url("${src}"), url("${DEFAULT_APP_BACKGROUND}")` }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-white/85 via-white/75 to-brand-50/80" />
          </>
        )}
        <div className="relative h-[13%] bg-white/90 border-b border-neutral-200" />
        <div className="relative p-[3%] space-y-[3%]">
          <div className="grid grid-cols-4 gap-[2%]">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-6 rounded-md bg-white border border-neutral-200 shadow-xs" />
            ))}
          </div>
          <div className="h-16 rounded-md bg-white border border-neutral-200 shadow-xs" />
        </div>
      </div>
    </div>
  );
}

/** A scaled-down department sidebar: the image covers it from the bottom under a white fade. */
function SidebarPreview({ src, dimmed }: { src: string; dimmed?: boolean }) {
  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[220px] overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div
        className={`absolute inset-0 bg-cover bg-bottom bg-no-repeat ${dimmed ? 'opacity-30 grayscale' : ''}`}
        style={{ backgroundImage: `url("${src}"), url("${DEFAULT_SIDEBAR_IMAGE}")` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white from-25% via-white/85 via-50% to-white/0 to-90%" />
      <div className="relative p-[8%] space-y-2">
        <div className="h-3 w-3/4 rounded-sm bg-neutral-800" />
        {[80, 65, 70, 55, 60].map((w) => (
          <div key={w} className="h-2 rounded-full bg-neutral-200" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

interface BrandingImagePanelProps {
  api: string;
  title: string;
  description: string;
  noun: string;
  defaultSrc: string;
  srcForVersion: (version: number) => string;
  renderPreview: (props: { src: string; dimmed: boolean; off: boolean }) => React.ReactNode;
  /** Adds an on/off switch backed by the route's `enabled` setting. */
  withEnableSwitch?: boolean;
  onNotify: Notify;
}

function BrandingImagePanel({
  api,
  title,
  description,
  noun,
  defaultSrc,
  srcForVersion,
  renderPreview,
  withEnableSwitch,
  onNotify,
}: BrandingImagePanelProps) {
  const [image, setImage] = useState<BrandingImageInfo | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [altText, setAltText] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);

  const applyResponse = (data: { image?: BrandingImageInfo | null; enabled?: boolean }) => {
    setImage(data.image ?? null);
    if (typeof data.enabled === 'boolean') setEnabled(data.enabled);
  };

  const load = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await fetch(api);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to load the ${noun}`);
      applyResponse(data);
      setAltText(data.image?.altText || '');
    } catch (err: any) {
      setLoadError(err.message || `Failed to load the ${noun}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [api]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const clearDraft = () => {
    setFile(null);
    setPreviewUrl(null);
    setFileError(null);
  };

  const handleFile = async (picked: File | undefined) => {
    if (!picked) return;
    let error: string | null = null;
    if (picked.size > MAX_DEPARTMENT_IMAGE_BYTES) {
      error = `Image must be ${MAX_DEPARTMENT_IMAGE_BYTES / (1024 * 1024)} MB or smaller (this one is ${formatSize(picked.size)}).`;
    } else if (!sniffDepartmentImageType(new Uint8Array(await picked.slice(0, 12).arrayBuffer()))) {
      error = 'Only JPG, PNG or WebP images are allowed.';
    }
    if (error) {
      clearDraft();
      setFileError(error);
      return;
    }
    setFileError(null);
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  };

  const request = async (init: RequestInit, success: (data: any) => string) => {
    try {
      setBusy(true);
      const res = await fetch(api, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Request failed');
      applyResponse(data);
      onNotify(success(data));
      return true;
    } catch (err: any) {
      onNotify(err.message || 'Request failed', 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('altText', altText);
    try {
      setBusy(true);
      const res = await fetch(api, { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      applyResponse(data);
      clearDraft();
      onNotify(`${Noun} saved. It appears on the next page load.`);
    } catch (err: any) {
      setFileError(err.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const patch = (body: Record<string, unknown>, success: (data: any) => string) =>
    request({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, success);

  const restoreDefault = async () => {
    if (!image) return;
    if (!window.confirm(`Remove the uploaded ${noun} and restore the default image?`)) return;
    if (await request({ method: 'DELETE' }, () => `Default ${noun} restored.`)) {
      setAltText('');
      clearDraft();
    }
  };

  const currentSrc = image ? srcForVersion(image.version) : defaultSrc;
  const off = !!withEnableSwitch && !enabled;
  const badge = off
    ? { text: 'Off', cls: 'bg-neutral-100 text-neutral-600 border-neutral-200' }
    : !image
    ? { text: 'Default', cls: 'bg-neutral-100 text-neutral-600 border-neutral-200' }
    : image.isActive
    ? { text: 'Active', cls: 'bg-accent-100 text-neutral-900 border-accent-300' }
    : { text: 'Inactive', cls: 'bg-danger-50 text-danger-800 border-danger-300' };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">{title}</h2>
          <p className="text-xs text-neutral-500">{description}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50 self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {loadError && (
        <div className="px-4 py-3 rounded-xl border border-danger-300 bg-danger-50 text-xs font-semibold text-danger-800">{loadError}</div>
      )}

      {!loadError && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4">
          <div className="bg-white rounded-xl border border-neutral-200 shadow-xs p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                {previewUrl ? 'Preview (not saved yet)' : 'Current'}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.text}</span>
            </div>
            {renderPreview({ src: previewUrl || currentSrc, dimmed: !previewUrl && !!image && !image.isActive, off: off && !previewUrl })}
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 shadow-xs p-4 space-y-3">
            {withEnableSwitch && (
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-neutral-100">
                <div>
                  <span className="block text-xs font-semibold text-neutral-900">Show on department pages</span>
                  <span className="block text-[11px] text-neutral-500">{enabled ? 'On for every department' : 'Off: plain background'}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label="Show on department pages"
                  disabled={busy || loading}
                  onClick={() =>
                    patch({ enabled: !enabled }, (d) => (d.enabled ? `${Noun} turned on.` : `${Noun} turned off.`))
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 cursor-pointer ${
                    enabled ? 'bg-brand-600' : 'bg-neutral-300'
                  }`}
                >
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            )}

            {image ? (
              <div className="text-[11px] text-neutral-500 leading-relaxed space-y-0.5">
                <span className="block font-semibold text-neutral-900 break-all">{image.fileName}</span>
                <span className="block">
                  {image.mimeType.replace('image/', '').toUpperCase()} · {formatSize(image.fileSize)} ·{' '}
                  {image.storage === 'CLOUDINARY' ? 'Cloudinary' : 'Database'}
                </span>
                <span className="block">
                  Updated {new Date(image.updatedAt).toLocaleString()}
                  {image.uploadedBy ? ` by ${image.uploadedBy}` : ''}
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-neutral-500">No custom image. The default fabric photo is used.</p>
            )}

            <div className="space-y-2 border-t border-neutral-100 pt-3">
              <input
                type="file"
                accept={ALLOWED_DEPARTMENT_IMAGE_TYPES.join(',')}
                onChange={(e) => {
                  handleFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
                className="block w-full text-[11px] text-neutral-700 file:mr-2 file:px-2.5 file:py-1.5 file:rounded-lg file:border file:border-neutral-200 file:bg-white file:text-[11px] file:font-semibold file:text-neutral-900 hover:file:bg-neutral-100"
              />
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Description (alt text)</span>
                <input
                  type="text"
                  value={altText}
                  maxLength={MAX_ALT_TEXT_LENGTH}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder="Textile background"
                  className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                />
              </label>
              {fileError && <p className="text-[11px] font-semibold text-danger-700">{fileError}</p>}
              <div className="flex items-center gap-2">
                <button
                  onClick={save}
                  disabled={!file || busy}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50"
                >
                  {busy && file ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>{image ? 'Replace Image' : 'Save Image'}</span>
                </button>
                {file && (
                  <button
                    onClick={clearDraft}
                    disabled={busy}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                )}
              </div>
            </div>

            {image && (
              <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
                <button
                  onClick={() =>
                    patch({ isActive: !image.isActive }, (d) =>
                      d.image?.isActive ? `Uploaded ${noun} activated.` : `Uploaded ${noun} deactivated (default shown).`,
                    )
                  }
                  disabled={busy}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 rounded-lg text-[11px] font-semibold transition disabled:opacity-50"
                >
                  {image.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{image.isActive ? 'Use Default Instead' : 'Use Uploaded Image'}</span>
                </button>
                <button
                  onClick={restoreDefault}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-danger-50 hover:text-danger-800 border border-neutral-200 text-neutral-700 rounded-lg text-[11px] font-semibold transition disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Default</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const SIZE_NOTE = `JPG, PNG or WebP up to ${MAX_DEPARTMENT_IMAGE_BYTES / (1024 * 1024)} MB; a landscape photo around 1920 × 1080 works best.`;

export function AppBackgroundPanel({ onNotify }: { onNotify: Notify }) {
  return (
    <BrandingImagePanel
      api="/api/admin/branding/app-background"
      title="Department Background"
      description={`One background behind the content of every department page. ${SIZE_NOTE}`}
      noun="department background"
      defaultSrc={DEFAULT_APP_BACKGROUND}
      srcForVersion={appBackgroundSrc}
      renderPreview={({ src, dimmed, off }) => <DepartmentPreview src={src} dimmed={dimmed} off={off} />}
      withEnableSwitch
      onNotify={onNotify}
    />
  );
}

/** Admin > Sidebar Image: one image for the sidebar of every department. */
export function SidebarImagePanel({ onNotify }: { onNotify: Notify }) {
  return (
    <BrandingImagePanel
      api="/api/admin/branding/sidebar-image"
      title="Sidebar Image"
      description={`One textile image behind the sidebar of every department; it fills the sidebar from the bottom. JPG, PNG or WebP up to ${
        MAX_DEPARTMENT_IMAGE_BYTES / (1024 * 1024)
      } MB; a tall portrait photo around 800 × 1600 works best.`}
      noun="sidebar image"
      defaultSrc={DEFAULT_SIDEBAR_IMAGE}
      srcForVersion={sidebarImageSrc}
      renderPreview={({ src, dimmed }) => <SidebarPreview src={src} dimmed={dimmed} />}
      onNotify={onNotify}
    />
  );
}

export function LoginAppearancePanel({ onNotify }: { onNotify: Notify }) {
  return (
    <BrandingImagePanel
      api="/api/admin/branding/login-background"
      title="Login Page Background"
      description={`Full-page background behind the sign-in screen. ${SIZE_NOTE}`}
      noun="login background"
      defaultSrc={DEFAULT_LOGIN_BACKGROUND}
      srcForVersion={loginBackgroundSrc}
      renderPreview={({ src, dimmed }) => <LoginPreview src={src} dimmed={dimmed} />}
      onNotify={onNotify}
    />
  );
}

/** Admin > Appearance: the shared department background and the login background. */
export function AppearancePanel({ onNotify }: { onNotify: Notify }) {
  return (
    <div className="space-y-10">
      <AppBackgroundPanel onNotify={onNotify} />
      <div className="border-t border-neutral-200" />
      <LoginAppearancePanel onNotify={onNotify} />
    </div>
  );
}
