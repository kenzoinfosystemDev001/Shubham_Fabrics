'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { DEFAULT_APP_BACKGROUND, appBackgroundSrc, type AppBackgroundConfig } from '@/lib/branding';

// Login and Admin have their own look; the root path only redirects.
const EXCLUDED_PREFIXES = ['/login', '/admin'];

// One config request per page load, shared by every mount; failures are not cached.
let configRequest: Promise<AppBackgroundConfig | null> | null = null;
function loadConfig() {
  configRequest ??= fetch('/api/branding/app-background/config', { cache: 'no-store' })
    .then((res) => (res.ok ? (res.json() as Promise<AppBackgroundConfig>) : null))
    .catch(() => null)
    .then((config) => {
      if (!config) configRequest = null;
      return config;
    });
  return configRequest;
}

/**
 * The shared background behind the content area of every department page (Admin > Appearance).
 * Fixed behind everything and never takes clicks. While it is shown, `data-app-background` on <html>
 * lets globals.css clear the page-level canvas colour so the image shows through; cards, tables,
 * forms and modals keep their own white surfaces.
 */
export function AppBackground() {
  const pathname = usePathname() || '/';
  const excluded = pathname === '/' || EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const [config, setConfig] = useState<AppBackgroundConfig | null>(null);

  useEffect(() => {
    if (excluded) return;
    let alive = true;
    loadConfig().then((c) => {
      if (alive) setConfig(c);
    });
    return () => {
      alive = false;
    };
  }, [excluded]);

  const active = !excluded && !!config?.enabled;

  useEffect(() => {
    const root = document.documentElement;
    if (active) root.setAttribute('data-app-background', '');
    else root.removeAttribute('data-app-background');
    return () => root.removeAttribute('data-app-background');
  }, [active]);

  if (!active || !config) return null;
  const src = config.version ? appBackgroundSrc(config.version) : DEFAULT_APP_BACKGROUND;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 print:hidden">
      {/* The default is layered underneath, so it shows if the configured image cannot load. */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url("${src}"), url("${DEFAULT_APP_BACKGROUND}")` }}
      />
      {/* Light wash keeps operational content easy to read over any image. */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/85 via-white/75 to-brand-50/80" />
    </div>
  );
}
