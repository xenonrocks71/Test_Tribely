"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Smartphone,
  Laptop,
  CheckCircle2,
  ArrowRight,
  Sun,
  Moon,
  Bell,
  Zap,
  Shield,
  Share2,
  X,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { useTheme } from "@/app/context/ThemeContext";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export default function LandingPage() {
  const router = useRouter();
  const { theme, toggleTheme, isMounted } = useTheme();
  const isDark = theme === "dark";

  const { isInstallable, isInstalled, isIOS, showIOSGuide, installApp, closeIOSGuide } =
    usePWAInstall();

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("tribely_token") || localStorage.getItem("token");
      if (token) {
        setIsLoggedIn(true);
      }
    }
  }, []);

  const handleOpenApp = () => {
    router.push(isLoggedIn ? "/feed" : "/register");
  };

  return (
    <div className="min-h-screen w-full bg-[#F8F9FA] dark:bg-[#121212] text-neutral-900 dark:text-neutral-100 font-sans selection:bg-[#1A73E8]/15 selection:text-[#1A73E8] transition-colors duration-200 flex flex-col justify-between">
      {/* ── 1. STICKY GOOGLE WORKSPACE HEADER ── */}
      <header className="sticky top-0 z-50 h-16 w-full border-b border-[#E8EAED] dark:border-[#2E3033] bg-[#F8F9FA]/90 dark:bg-[#121212]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
          {/* Tribely Wordmark with Brand Icon */}
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
            <div className="w-8 h-8 rounded-xl overflow-hidden shadow-xs flex items-center justify-center bg-white dark:bg-[#282A2D] border border-neutral-200/60 dark:border-neutral-700/60 p-0.5 group-hover:scale-105 transition-transform">
              <img src="/icons/BrandNewLook.png" alt="Tribely" className="w-full h-full object-contain" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-neutral-900 dark:text-neutral-100">
              Tribely
            </span>
          </Link>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-full text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition cursor-pointer"
              title="Switch Appearance"
              aria-label="Toggle theme"
              suppressHydrationWarning
            >
              {isMounted && isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-neutral-600" />
              )}
            </button>

            {/* Header Install Button (if not already installed) */}
            {!isInstalled && (
              <button
                type="button"
                onClick={installApp}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-[#1A73E8] dark:text-[#8AB4F8] bg-[#E8F0FE] dark:bg-[#1A73E8]/15 hover:bg-[#D2E3FC] dark:hover:bg-[#1A73E8]/25 transition cursor-pointer"
                title="Install Tribely App to your device"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install App</span>
              </button>
            )}

            {/* Auth Navigation */}
            {isLoggedIn ? (
              <Link
                href="/feed"
                className="px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-medium bg-[#1A73E8] hover:bg-[#1557B0] dark:bg-[#8AB4F8] dark:hover:bg-[#AECBFA] text-white dark:text-[#202124] shadow-xs transition active:scale-[0.98] cursor-pointer"
              >
                Open App →
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium text-[#1A73E8] dark:text-[#8AB4F8] border border-neutral-300 dark:border-neutral-700 hover:bg-[#1A73E8]/8 dark:hover:bg-[#8AB4F8]/8 transition cursor-pointer"
                >
                  Log In
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium bg-[#1A73E8] hover:bg-[#1557B0] dark:bg-[#8AB4F8] dark:hover:bg-[#AECBFA] text-white dark:text-[#202124] shadow-xs transition active:scale-[0.98] cursor-pointer"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── 2. HERO SECTION: CLEAN, FOCUSED & PWA READY ── */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-12 pb-14 sm:pt-20 sm:pb-20 lg:pt-24 lg:pb-24">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-[#1A73E8]/10 via-[#4285F4]/5 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-3xl mx-auto px-4 sm:px-6 relative z-10 text-center space-y-6 sm:space-y-7">
            {/* PWA Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E8F0FE] dark:bg-[#1A2742] border border-[#CEEAD6] dark:border-[#0F9D58]/30 text-xs font-medium text-[#0F9D58] dark:text-[#81C995] shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-[#0F9D58] dark:text-[#81C995]" />
              <span>Progressive Web App • Install on Phone & Desktop</span>
            </div>

            {/* Punchy Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-normal tracking-tight leading-[1.12] text-neutral-900 dark:text-white">
              Where habits become{" "}
              <span className="font-bold bg-gradient-to-r from-[#1A73E8] via-[#4285F4] to-[#0D9488] dark:from-[#8AB4F8] dark:via-[#AECBFA] dark:to-[#2DD4BF] bg-clip-text text-transparent">
                social status.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto leading-relaxed font-normal">
              Drop daily proof. Build unbroken streaks with your squad. Put stakes on your discipline.
              Install directly to your home screen or use it seamlessly in your browser.
            </p>

            {/* ── PRIMARY DUAL ACTIONS: INSTALL PWA OR USE IN BROWSER ── */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
              {/* Option 1: Install PWA */}
              {isInstalled ? (
                <button
                  type="button"
                  onClick={handleOpenApp}
                  className="w-full sm:flex-1 py-3.5 px-6 rounded-full bg-[#E6F4EA] dark:bg-[#0F9D58]/20 border border-[#CEEAD6] dark:border-[#0F9D58]/40 text-[#0F9D58] dark:text-[#81C995] text-sm font-medium flex items-center justify-center gap-2 shadow-xs transition active:scale-[0.98] cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>App Installed — Open Now</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={installApp}
                  className="w-full sm:flex-1 py-3.5 px-6 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] dark:bg-[#8AB4F8] dark:hover:bg-[#AECBFA] text-white dark:text-[#202124] text-sm font-medium flex items-center justify-center gap-2 shadow-xs transition active:scale-[0.98] cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download / Install App</span>
                </button>
              )}

              {/* Option 2: Use in Browser */}
              <Link
                href={isLoggedIn ? "/feed" : "/register"}
                className="w-full sm:flex-1 py-3.5 px-6 rounded-full bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-[#282A2D] text-neutral-800 dark:text-neutral-200 text-sm font-medium flex items-center justify-center gap-2 shadow-xs transition active:scale-[0.98] cursor-pointer"
              >
                <span>Continue in Browser</span>
                <ArrowRight className="w-4 h-4 text-[#1A73E8] dark:text-[#8AB4F8]" />
              </Link>
            </div>

            {/* Device Compatibility Footnote */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-neutral-500 dark:text-neutral-400 font-normal">
              <span className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-[#1A73E8] dark:text-[#8AB4F8]" />
                <span>Android & iOS Ready</span>
              </span>
              <span className="text-neutral-300 dark:text-neutral-700">•</span>
              <span className="flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5 text-[#0F9D58] dark:text-[#81C995]" />
                <span>Windows, Mac & Chrome</span>
              </span>
              <span className="text-neutral-300 dark:text-neutral-700">•</span>
              <span>No App Store needed</span>
            </div>
          </div>
        </section>

        {/* ── 3. THREE CLEAN PWA VALUE CARDS ── */}
        <section className="py-10 sm:py-12 max-w-4xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {/* Card 1 */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] space-y-2.5 shadow-xs">
              <div className="w-10 h-10 rounded-full bg-[#E8F0FE] dark:bg-[#1A73E8]/15 text-[#1A73E8] dark:text-[#8AB4F8] flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Instant Home Screen Access
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed font-normal">
                Installs directly to your home screen or desktop dock in 1 second. Zero storage bloat, instant launch.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] space-y-2.5 shadow-xs">
              <div className="w-10 h-10 rounded-full bg-[#E6F4EA] dark:bg-[#0F9D58]/15 text-[#0F9D58] flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Native Push Notifications
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed font-normal">
                Get notified when your squad drops proof and receive reminders before the daily cutoff.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] space-y-2.5 shadow-xs">
              <div className="w-10 h-10 rounded-full bg-[#FEF7E0] dark:bg-[#F9AB00]/15 text-[#F9AB00] flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Full-Screen Experience
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed font-normal">
                Runs standalone with no browser address bar. Works offline with background sync and instant caching.
              </p>
            </div>
          </div>
        </section>

        {/* ── 4. QUICK INSTALL / BROWSER CTA CARD ── */}
        <section className="pb-12 sm:pb-16 max-w-4xl mx-auto px-4 sm:px-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-left shadow-xs">
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-semibold text-neutral-900 dark:text-white">
                Ready to build unbroken streaks?
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Install the app on your device or start exploring right now in your browser.
              </p>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={installApp}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] dark:bg-[#8AB4F8] dark:hover:bg-[#AECBFA] text-white dark:text-[#202124] text-xs font-medium shadow-xs transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isInstalled ? "Open App" : "Install App"}</span>
              </button>

              <Link
                href={isLoggedIn ? "/feed" : "/register"}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-[#282A2D] text-xs font-medium text-neutral-800 dark:text-neutral-200 transition cursor-pointer flex items-center justify-center gap-1"
              >
                <span>Launch Web</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── 5. GOOGLE WORKSPACE UNDERSTATED FOOTER ── */}
      <footer className="border-t border-[#E8EAED] dark:border-[#2E3033] py-6 px-4 text-center text-xs text-neutral-500 dark:text-neutral-400 bg-[#F8F9FA] dark:bg-[#121212]">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-5 mb-2 font-normal">
          <Link href="/protocol" className="hover:underline hover:text-neutral-800 dark:hover:text-neutral-200 transition">
            Protocol & Help
          </Link>
          <Link href="/terms" className="hover:underline hover:text-neutral-800 dark:hover:text-neutral-200 transition">
            Terms
          </Link>
          <Link href="/privacy" className="hover:underline hover:text-neutral-800 dark:hover:text-neutral-200 transition">
            Privacy
          </Link>
          <Link href="/guidelines" className="hover:underline hover:text-neutral-800 dark:hover:text-neutral-200 transition">
            Guidelines
          </Link>
        </div>
        <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
          © {new Date().getFullYear()} Tribely Technologies. Progressive Web App.
        </p>
      </footer>

      {/* ── 6. iOS / BROWSER INSTALLATION GUIDE MODAL ── */}
      <AnimatePresence>
        {showIOSGuide && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="w-full max-w-sm bg-white dark:bg-[#1E1E1E] border border-[#E8EAED] dark:border-[#303134] rounded-3xl p-6 text-neutral-900 dark:text-white shadow-2xl space-y-4 relative"
            >
              <button
                type="button"
                onClick={closeIOSGuide}
                className="absolute top-4 right-4 p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                aria-label="Close guide"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-[#E8F0FE] dark:bg-[#1A73E8]/15 text-[#1A73E8] dark:text-[#8AB4F8] flex items-center justify-center mx-auto">
                <Download className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h4 className="text-base font-semibold">Install Tribely on your Device</h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Follow these simple steps to add Tribely to your home screen:
                </p>
              </div>

              <div className="space-y-3 p-3.5 rounded-2xl bg-[#F8F9FA] dark:bg-[#202124] border border-[#E8EAED] dark:border-[#303134] text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#1A73E8] text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="leading-relaxed">
                    Tap the <span className="font-semibold">Share</span> button{" "}
                    <Share2 className="w-3.5 h-3.5 inline text-[#1A73E8] mx-0.5" /> in your browser menu.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#1A73E8] text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="leading-relaxed">
                    Scroll down and tap <span className="font-semibold">Add to Home Screen</span> or{" "}
                    <span className="font-semibold">Install App</span>.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#0F9D58] text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="leading-relaxed">
                    Open Tribely from your home screen for the complete full-screen experience!
                  </div>
                </div>
              </div>

              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={closeIOSGuide}
                  className="flex-1 py-2.5 rounded-full bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-medium cursor-pointer transition shadow-xs"
                >
                  Got It
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
