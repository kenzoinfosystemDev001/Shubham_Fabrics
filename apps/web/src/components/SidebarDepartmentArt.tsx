'use client';

import React from 'react';
import { DEFAULT_SIDEBAR_IMAGE, sidebarImageSrc } from '@/lib/branding';

/**
 * Full-height textile background for a department sidebar. Render it as the first child of the
 * sidebar <aside>: it sits behind the sidebar's content (-z-10 inside the aside's stacking
 * context), never takes clicks, and is hidden from assistive tech.
 *
 * Every department shows the same picture, set once in Admin > Sidebar Image. The default image is
 * layered underneath as a CSS fallback, so it shows whenever no image is set or it fails to load.
 * Covering from the bottom keeps the subject in view on any sidebar height; the white gradient
 * keeps the upper navigation on a clean white surface.
 */
export function SidebarDepartmentArt() {
  return (
    <div aria-hidden="true" data-sidebar-background className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-bottom bg-no-repeat"
        style={{ backgroundImage: `url("${sidebarImageSrc()}"), url("${DEFAULT_SIDEBAR_IMAGE}")` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white from-25% via-white/85 via-50% to-white/0 to-90%" />
    </div>
  );
}
