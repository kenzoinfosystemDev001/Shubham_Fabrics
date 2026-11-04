'use client';

import React, { useEffect, useState } from 'react';
import { DEFAULT_SIDEBAR_IMAGE, sidebarImageSrc } from '@/lib/branding';

// The image URL once it has fully loaded, shared by every sidebar for the rest of the page load, so
// moving between pages shows it straight away. One request per page load; failures are not cached.
let loadedSrc: string | null = null;
let srcRequest: Promise<string | null> | null = null;

function whenLoaded(src: string) {
  return new Promise<string | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function loadSidebarSrc() {
  srcRequest ??= fetch('/api/branding/sidebar-image/config', { cache: 'no-store' })
    .then((res) => (res.ok ? (res.json() as Promise<{ version: string | null }>) : null))
    .catch(() => null)
    .then((config) => {
      // null = the active image is unknown: keep the plain sidebar rather than guess.
      if (!config || config.version === null) return null;
      return whenLoaded(config.version ? sidebarImageSrc(config.version) : DEFAULT_SIDEBAR_IMAGE);
    })
    .then((src) => {
      if (src) loadedSrc = src;
      else srcRequest = null;
      return src;
    });
  return srcRequest;
}

/**
 * Full-height textile background for a department sidebar. Render it as the first child of the
 * sidebar <aside>: it sits behind the sidebar's content (-z-10 inside the aside's stacking
 * context), never takes clicks, and is hidden from assistive tech.
 *
 * Every department shows the same picture, set once in Admin > Appearance. Only the active image is
 * ever drawn, and only once it has fully loaded (faded in over the plain white sidebar), so no other
 * image can flash first; if it fails to load the sidebar stays plain. Covering from the bottom keeps
 * the subject in view on any sidebar height; the white gradient keeps the upper navigation on a clean
 * white surface.
 */
export function SidebarDepartmentArt() {
  const [src, setSrc] = useState<string | null>(loadedSrc);

  useEffect(() => {
    if (loadedSrc) return;
    let alive = true;
    loadSidebarSrc().then((s) => {
      if (alive) setSrc(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div aria-hidden="true" data-sidebar-background className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className={`absolute inset-0 bg-cover bg-bottom bg-no-repeat transition-opacity duration-500 motion-reduce:transition-none ${
          src ? 'opacity-100' : 'opacity-0'
        }`}
        style={src ? { backgroundImage: `url("${src}")` } : undefined}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white from-25% via-white/85 via-50% to-white/0 to-90%" />
    </div>
  );
}
