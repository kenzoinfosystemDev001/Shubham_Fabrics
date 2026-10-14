'use client';

import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Share, PlusSquare, CheckCircle, X } from 'lucide-react';

interface InstallAppButtonProps {
  variant?: 'nav' | 'banner' | 'floating' | 'button';
  className?: string;
}

export function InstallAppButton({ variant = 'button', className = '' }: InstallAppButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);
  const [installedSuccessfully, setInstalledSuccessfully] = useState<boolean>(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed app)
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone);
    };

    checkInstalled();

    // Check for iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

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

  const handleInstallClick = async () => {
    if (isInstalled) {
      alert('Shubham Fabrics MES is already installed on this device!');
      return;
    }

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setInstalledSuccessfully(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error('PWA install error:', err);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      // General instructions / browser prompt fallback
      setShowIOSModal(true);
    }
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
      {/* IOS / Generic Installation Instruction Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-sky-500/40 rounded-2xl p-6 shadow-2xl text-slate-100">
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/80 hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Install Shubham MES App</h3>
                <p className="text-xs text-sky-400 font-medium">Add to your Mobile Home Screen</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 mb-4">
              Install the official Shubham Fabrics MES application on your phone for instant, high-speed access:
            </p>

            {isIOS ? (
              <div className="space-y-3 bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-200">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-sky-500/20 text-sky-400 rounded-lg shrink-0">
                    <Share className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-white">Step 1:</span> Tap the <strong className="text-sky-300">Share</strong> icon in the bottom menu bar of Safari.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg shrink-0">
                    <PlusSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-white">Step 2:</span> Scroll down and tap <strong className="text-indigo-300">'Add to Home Screen'</strong>.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-white">Step 3:</span> Tap <strong className="text-emerald-300">'Add'</strong> at the top right. The app will be installed on your phone home screen!
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-200">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-sky-500/20 text-sky-400 rounded-lg shrink-0">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-white">For Android / Chrome / Edge:</span> Tap the browser menu (<strong className="text-sky-300">⋮</strong>) at the top right and select <strong className="text-sky-300">'Install App'</strong> or <strong className="text-sky-300">'Add to Home Screen'</strong>.
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowIOSModal(false)}
              className="mt-5 w-full py-2.5 px-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-sky-500/25 transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Render based on variant */}
      {variant === 'nav' && (
        <button
          onClick={handleInstallClick}
          className={`flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-sky-200 hover:text-white bg-sky-950/50 hover:bg-sky-900/60 border border-sky-500/30 hover:border-sky-400/60 rounded-xl shadow-sm transition-all group ${className}`}
          title="Download & Install Mobile App"
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
              Install the Shubham Fabrics App on your phone for faster access!
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
