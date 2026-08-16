"use client";

import React, { useState, useEffect } from "react";
import { Download, Share, PlusSquare, X, Smartphone, CheckCircle, Sparkles, Star } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [showIosModal, setShowIosModal] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [installedSuccessfully, setInstalledSuccessfully] = useState<boolean>(false);

  useEffect(() => {
    // 1. Check if app is already running in Standalone PWA mode
    const inStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (inStandalone) {
      setIsStandalone(true);
      return;
    }

    // 2. Check if user dismissed banner in current session
    if (sessionStorage.getItem("tribely_pwa_banner_dismissed") === "true") {
      setDismissed(true);
    }

    // 3. Detect mobile OS & device types
    const ua = navigator.userAgent;
    const mobileCheck = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const iosCheck = /iPhone|iPad|iPod/i.test(ua);

    setIsMobile(mobileCheck);
    setIsIos(iosCheck);

    // 4. Intercept Android/Chrome beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 5. Listen for appinstalled event
    const handleAppInstalled = () => {
      setInstalledSuccessfully(true);
      setIsStandalone(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Do not display if running in PWA mode or explicitly dismissed
  if (isStandalone || dismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosModal(true);
      return;
    }

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === "accepted") {
          setInstalledSuccessfully(true);
          setIsStandalone(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn("PWA install prompt error:", err);
      }
    } else {
      // Fallback instructions if prompt isn't fired yet
      alert("To install Tribely: Open browser menu (⋮ or Share) and select 'Add to Home Screen' or 'Install App'.");
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("tribely_pwa_banner_dismissed", "true");
  };

  return (
    <>
      {/* Floating Bottom PWA Installation Banner */}
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-in slide-in-from-bottom duration-300">
        <div className="relative overflow-hidden rounded-2xl bg-slate-900/95 dark:bg-[#121824]/95 backdrop-blur-xl border border-amber-500/30 p-4 shadow-2xl shadow-amber-500/10">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start space-x-3.5 pr-6">
            <div className="relative flex-shrink-0">
              <img
                src="/logo.png"
                alt="Tribely App Icon"
                className="w-12 h-12 rounded-xl object-cover border border-amber-500/40 shadow-md"
              />
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] text-slate-950 font-bold">
                ★
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-1.5">
                <h4 className="text-sm font-bold text-white tracking-tight">Install Tribely App</h4>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Sparkles className="w-2.5 h-2.5 mr-0.5" /> PWA
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-snug">
                Install on your home screen for full app performance, 0ms latency, and offline support.
              </p>

              <div className="flex items-center space-x-1 text-[11px] text-amber-400 font-medium mt-1">
                <div className="flex text-amber-400">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                </div>
                <span className="text-slate-400 ml-1">4.9 • Official App</span>
              </div>
            </div>
          </div>

          <div className="mt-3.5 flex items-center space-x-2">
            <button
              onClick={handleInstallClick}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all transform active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isIos ? "Install on iOS" : "Install App"}</span>
            </button>

            <button
              onClick={handleDismiss}
              className="px-3 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-medium text-xs border border-slate-700 transition"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>

      {/* iOS Safari Guided Installation Modal */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-amber-500/30 p-6 text-white shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Install on iPhone / iPad</h3>
                  <p className="text-xs text-slate-400">Follow these 2 quick steps in Safari</p>
                </div>
              </div>
              <button
                onClick={() => setShowIosModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 pt-1 text-xs">
              <div className="flex items-start space-x-3 p-3 rounded-2xl bg-slate-800/60 border border-slate-700/50">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-bold text-xs">
                  1
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-slate-200 flex items-center">
                    Tap the Share button <Share className="w-3.5 h-3.5 ml-1.5 text-amber-400 inline" />
                  </p>
                  <p className="text-slate-400">Located at the bottom center of your Safari browser bar.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-2xl bg-slate-800/60 border border-slate-700/50">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-bold text-xs">
                  2
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-slate-200 flex items-center">
                    Tap &quot;Add to Home Screen&quot; <PlusSquare className="w-3.5 h-3.5 ml-1.5 text-amber-400 inline" />
                  </p>
                  <p className="text-slate-400">Scroll down the share options list and select Add to Home Screen.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIosModal(false)}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-lg"
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
