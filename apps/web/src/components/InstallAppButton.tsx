'use client';

import React, { useState, useEffect } from 'react';
import { Download, Smartphone, CheckCircle } from 'lucide-react';

interface InstallAppButtonProps {
  variant?: 'nav' | 'banner' | 'floating' | 'button';
  className?: string;
}

export function InstallAppButton({ variant = 'button', className = '' }: InstallAppButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [installedSuccessfully, setInstalledSuccessfully] = useState<boolean>(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed app)
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone);
    };

    checkInstalled();

    // Listen for beforeinstallprompt event on Android / Chromium
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setInstalledSuccessfully(true);
      setTimeout(() => setInstalledSuccessfully(false), 5000);
    });

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service Worker registration failed:', err);
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const triggerDirectDownload = () => {
    const link = document.createElement('a');
    link.href = '/shubham-fabrics.apk';
    link.setAttribute('download', 'Shubham_Fabrics.apk');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleInstallClick = async () => {
    if (isInstalled) {
      alert('Shubham Fabrics MES is already installed on this device!');
      return;
    }

    // If native PWA install prompt is available, trigger it directly without any instructional modal
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice?.outcome === 'accepted') {
          setInstalledSuccessfully(true);
          setDeferredPrompt(null);
          return;
        }
      } catch (err) {
        console.error('PWA install error:', err);
      }
    }

    // Direct download on the mobile device immediately
    triggerDirectDownload();
  };

  // If already running in standalone mode, show subtle checkmark or nothing
  if (isInstalled) {
    if (variant === 'nav') {
      return (
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 rounded-lg">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span>App Installed</span>
        </div>
      );
    }
    return null;
  }

  return (
    <>
      {/* Render based on variant */}
      {variant === 'nav' && (
        <button
          onClick={handleInstallClick}
          className={`flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-sky-200 hover:text-white bg-sky-950/50 hover:bg-sky-900/60 border border-sky-500/30 hover:border-sky-400/60 rounded-xl shadow-sm transition-all group ${className}`}
          title="Download Mobile App"
        >
          <div className="p-1 rounded-md bg-sky-500/20 group-hover:bg-sky-500/40 text-sky-400 group-hover:text-sky-300 transition-colors">
            <Download className="w-3.5 h-3.5" />
          </div>
          <span>Download App</span>
        </button>
      )}

      {variant === 'floating' && (
        <div className="fixed bottom-5 right-5 z-40 md:hidden animate-bounce hover:animate-none">
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold text-sm rounded-full shadow-2xl shadow-sky-500/50 border border-sky-300/40 hover:scale-105 active:scale-95 transition-all"
          >
            <Smartphone className="w-5 h-5 text-sky-100" />
            <span>Download Mobile App</span>
          </button>
        </div>
      )}

      {variant === 'banner' && (
        <div className="w-full bg-gradient-to-r from-sky-900/90 via-indigo-900/90 to-slate-900/90 border-b border-sky-500/30 px-3 py-2 text-xs flex items-center justify-between text-white shadow-inner">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-sky-500/30 text-sky-300">
              <Smartphone className="w-4 h-4" />
            </div>
            <span className="font-semibold text-slate-100">
              Download the Shubham Fabrics App on your phone for faster access!
            </span>
          </div>
          <button
            onClick={handleInstallClick}
            className="px-3 py-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shrink-0 shadow"
          >
            <Download className="w-3.5 h-3.5" />
            Download App
          </button>
        </div>
      )}

      {variant === 'button' && (
        <button
          onClick={handleInstallClick}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 border border-sky-400/30 rounded-xl shadow-md shadow-sky-900/30 transition-all ${className}`}
        >
          <Download className="w-4 h-4 text-sky-200" />
          <span>Download App</span>
        </button>
      )}
    </>
  );
}
