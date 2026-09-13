"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  Zap,
  Shield,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sun,
  Moon,
  Users,
  Compass,
  Heart,
  MessageCircle,
  Share2,
  Plus,
  Check,
} from "lucide-react";
import { useTheme } from "@/app/context/ThemeContext";
import api from "@/app/utils/api";

const LIVE_TICKER_ITEMS = [
  "🔥 14,200+ daily proofs dropped this week",
  "🛡️ ₹2.4M protected in squad vaults",
  "⚡ 98.4% streak retention rate",
  "📸 1-tap BeReal dual-camera proof drops",
  "🏆 LeetCode, 5 AM Club & Deep Work squads live",
];

export default function LandingPage() {
  const router = useRouter();
  const { theme, toggleTheme, isMounted } = useTheme();
  const isDark = theme === "dark";

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [arenas, setArenas] = useState<any[]>([]);
  const [doubleTapped, setDoubleTapped] = useState(false);
  const [heartCount, setHeartCount] = useState(48);
  const [joinedArenas, setJoinedArenas] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("tribely_token");
      setIsLoggedIn(Boolean(token));
    }

    // Fetch live public discovery arenas
    api
      .get("/api/arenas/discovery/list")
      .then((res) => {
        const data = res.data?.data;
        if (Array.isArray(data) && data.length > 0) {
          const filtered = data.filter(
            (a: any) =>
              !a.name?.toLowerCase().includes("smoke test") &&
              !a.name?.toLowerCase().includes("test")
          );
          if (filtered.length > 0) {
            setArenas(filtered.slice(0, 6));
          }
        }
      })
      .catch(() => {
        // Fallback to DEFAULT_ARENAS
      });
  }, []);

  const handleDoubleTapPhone = () => {
    setDoubleTapped(true);
    setHeartCount((c) => c + 1);
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([25, 40]);
      }
    } catch {}
    setTimeout(() => setDoubleTapped(false), 900);
  };

  const handleJoinArena = (arena: any) => {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/dashboard`);
      return;
    }
    setJoinedArenas((prev) => ({ ...prev, [arena.id]: true }));
    router.push(`/arenas/${arena.id}`);
  };

  return (
    <div className="min-h-screen w-full bg-white dark:bg-[#0A0A0A] text-neutral-900 dark:text-[#F5F5F5] font-sans selection:bg-[#FF5E00]/20 selection:text-[#FF5E00] transition-colors duration-200">
      {/* ── 1. STICKY 56PX INSTAGRAM/THREADS HEADER ── */}
      <header className="sticky top-0 z-50 h-14 w-full border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/85 dark:bg-[#0A0A0A]/85 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
          {/* Stylized Tribely Wordmark */}
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF5E00] to-[#FF2E00] flex items-center justify-center shadow-[0_0_16px_rgba(255,94,0,0.4)] group-hover:scale-105 transition-transform">
              <Flame className="w-5 h-5 text-white fill-white" />
            </div>
            <span className="font-black text-lg tracking-tight text-neutral-900 dark:text-white">
              TRIBELY
            </span>
          </Link>

          {/* Right Controls: Theme Switcher + Auth Pill */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition cursor-pointer"
              title="Switch Appearance"
              aria-label="Toggle theme"
            >
              {isMounted && isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-neutral-600" />
              )}
            </button>

            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-full text-xs font-black bg-[#FF5E00] hover:bg-[#FF4500] text-white shadow-[0_0_16px_rgba(255,94,0,0.3)] transition active:scale-95 cursor-pointer"
              >
                Open App →
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-3.5 py-1.5 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition cursor-pointer"
                >
                  Log In
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 rounded-full text-xs font-black bg-[#FF5E00] hover:bg-[#FF4500] text-white shadow-[0_0_16px_rgba(255,94,0,0.3)] transition active:scale-95 cursor-pointer"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── 2. HERO SPLIT SECTION (Instagram Native Visuals) ── */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-28">
        {/* Subtle Ambient Radial Orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-[#FF5E00]/15 to-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Consumer-Grade High-Impact Typography */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-800 dark:text-neutral-200 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>The Social Habit Network</span>
            </div>

            <h1 className="text-4xl sm:text-6xl xl:text-7xl font-black tracking-tight leading-[1.05] text-neutral-900 dark:text-white">
              Where habits{" "}
              <br className="hidden sm:inline" />
              become{" "}
              <span className="bg-gradient-to-r from-[#FF5E00] via-[#FF3E00] to-rose-500 bg-clip-text text-transparent">
                social status.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
              Drop daily proof. Build unbroken streaks with your squad. Put
              stakes on your discipline. Miss a cutoff, lose your streak.
            </p>

            {/* CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5">
              <Link
                href={isLoggedIn ? "/dashboard" : "/register"}
                className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-[#FF5E00] hover:bg-[#FF4500] text-white font-black text-sm text-center shadow-[0_8px_24px_rgba(255,94,0,0.35)] active:scale-[0.98] transition cursor-pointer"
              >
                Get Started — Free
              </Link>
              <a
                href="#arenas"
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-sm text-center active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Compass className="w-4 h-4 text-[#FF5E00]" />
                <span>Explore Live Arenas</span>
              </a>
            </div>

            {/* Social Trust Metrics */}
            <div className="pt-4 flex items-center justify-center lg:justify-start gap-4">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <img
                    key={i}
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=user_${i + 12}`}
                    alt="User"
                    className="w-8 h-8 rounded-full border-2 border-white dark:border-[#0A0A0A] bg-neutral-800"
                  />
                ))}
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                <span className="font-bold text-neutral-900 dark:text-white">1,200+</span> spotters active today
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Floating 3D iPhone Showcase */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-[320px] sm:w-[350px] aspect-[9/18.5] rounded-[48px] p-3.5 bg-neutral-800 dark:bg-neutral-900 border-[6px] border-neutral-700 dark:border-neutral-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5),0_0_40px_rgba(255,94,0,0.15)] select-none">
              {/* iPhone Notch / Island */}
              <div className="absolute top-5 left-1/2 -translate-x-1/2 w-24 h-4 bg-black rounded-full z-30" />

              {/* Screen Container */}
              <div
                onClick={handleDoubleTapPhone}
                className="relative w-full h-full rounded-[38px] bg-neutral-950 overflow-hidden text-white flex flex-col cursor-pointer"
              >
                {/* Simulated App Header */}
                <div className="px-4 pt-7 pb-2 flex items-center justify-between border-b border-neutral-900">
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-[#FF5E00] fill-[#FF5E00]" />
                    <span className="text-xs font-black tracking-tight">TRIBELY</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-neutral-400" />
                  </div>
                </div>

                {/* Simulated Stories Tray */}
                <div className="px-3 py-2.5 flex items-center gap-2.5 overflow-x-hidden border-b border-neutral-900/60">
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className="w-11 h-11 rounded-full p-0.5 bg-neutral-800 border border-dashed border-neutral-600 flex items-center justify-center">
                      <Plus className="w-4 h-4 text-neutral-300" />
                    </div>
                    <span className="text-[9px] text-neutral-400">Your Drop</span>
                  </div>
                  {[
                    { name: "Mayur", avatar: "mayur" },
                    { name: "Sarah", avatar: "sarah" },
                    { name: "Alex", avatar: "alex" },
                    { name: "Kavya", avatar: "kavya" },
                  ].map((s, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1 shrink-0">
                      <div className="w-11 h-11 rounded-full p-[2px] bg-gradient-to-tr from-[#FF5E00] to-rose-500 shadow-sm">
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${s.avatar}`}
                          alt={s.name}
                          className="w-full h-full rounded-full object-cover bg-neutral-900 border border-neutral-950"
                        />
                      </div>
                      <span className="text-[9px] text-neutral-300 font-medium">{s.name}</span>
                    </div>
                  ))}
                </div>

                {/* Active Feed Post inside Phone */}
                <div className="flex-1 overflow-hidden p-3 flex flex-col justify-between">
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <img
                        src="https://api.dicebear.com/7.x/avataaars/svg?seed=mayur"
                        alt="Mayur"
                        className="w-7 h-7 rounded-full border border-neutral-800"
                      />
                      <div>
                        <div className="text-[11px] font-bold">Mayur Patil</div>
                        <div className="text-[9px] text-[#FF5E00] font-black">#LeetCode</div>
                      </div>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                      Verified 08:30 PM
                    </span>
                  </div>

                  {/* Media Viewport with BeReal PiP & Double-Tap Trigger */}
                  <div className="relative flex-1 rounded-2xl bg-neutral-900 overflow-hidden border border-neutral-800/80 flex items-center justify-center">
                    {/* Background Coding/Fitness graphic */}
                    <div className="w-full h-full bg-gradient-to-br from-neutral-900 via-[#141414] to-neutral-900 p-4 flex flex-col justify-center items-center text-center">
                      <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 mb-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                      </div>
                      <div className="text-xs font-mono font-bold text-emerald-400">Accepted: 100% Beats</div>
                      <div className="text-[10px] text-neutral-400 mt-1">Problem 435: Non-overlapping Intervals</div>
                    </div>

                    {/* Double-tap prompt pill */}
                    <div className="absolute bottom-2 inset-x-2 flex items-center justify-between pointer-events-none">
                      <span className="text-[9px] font-bold bg-black/60 backdrop-blur-xs px-2 py-1 rounded-lg border border-white/10 text-neutral-300">
                        ⚡ 14d Streak Safe
                      </span>
                      <span className="text-[8px] font-medium text-neutral-400 bg-black/60 px-1.5 py-0.5 rounded">
                        Double-tap 🔥
                      </span>
                    </div>

                    {/* Bursting Heart / Fire on Double Tap */}
                    <AnimatePresence>
                      {doubleTapped && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1.4, opacity: 1 }}
                          exit={{ scale: 0.9, opacity: 0 }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                          className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
                        >
                          <Flame className="w-16 h-16 text-[#FF5E00] fill-[#FF5E00] drop-shadow-[0_0_20px_rgba(255,94,0,0.8)]" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Reactions Footer */}
                  <div className="pt-2 flex items-center justify-between text-neutral-400">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-white">
                        <Flame className="w-3.5 h-3.5 text-[#FF5E00] fill-[#FF5E00]" />
                        <span>{heartCount}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400">
                        <Zap className="w-3.5 h-3.5 fill-amber-400" />
                        <span>18</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-neutral-500">2 min ago</span>
                  </div>
                </div>

                {/* Home Indicator */}
                <div className="w-24 h-1 rounded-full bg-neutral-700 mx-auto mb-2" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. HORIZONTAL SOCIAL PROOF STRIP ── */}
      <div className="w-full border-y border-neutral-200 dark:border-neutral-800/80 bg-neutral-50 dark:bg-neutral-900/50 py-3.5 overflow-hidden">
        <div className="flex items-center gap-8 animate-marquee whitespace-nowrap text-xs font-bold text-neutral-700 dark:text-neutral-300">
          {LIVE_TICKER_ITEMS.concat(LIVE_TICKER_ITEMS).map((item, idx) => (
            <span key={idx} className="flex items-center gap-2">
              <span>{item}</span>
              <span className="text-neutral-400 dark:text-neutral-600">•</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── 4. LIVE SQUADS / DISCOVERY SHOWCASE ── */}
      <section id="arenas" className="py-16 md:py-24 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-[#FF5E00] mb-1">
              Active Habit Arenas
            </div>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-neutral-900 dark:text-white">
              Pick your squad. Lock in your stake.
            </h2>
          </div>
          <Link
            href={isLoggedIn ? "/dashboard" : "/register"}
            className="text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-[#FF5E00] dark:hover:text-[#FF5E00] transition flex items-center gap-1"
          >
            <span>View All Arenas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Arenas Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {arenas.length === 0 ? (
            <div className="col-span-full py-12 px-4 text-center rounded-3xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <p className="text-sm font-bold text-neutral-600 dark:text-neutral-400">
                No active public habit arenas yet.
              </p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500">
                Be the first to create an accountability tribe and invite your peers!
              </p>
              <Link
                href={isLoggedIn ? "/dashboard" : "/register"}
                className="inline-flex items-center gap-1.5 mt-3 px-5 py-2.5 rounded-full bg-[#FF5E00] text-white text-xs font-black shadow-md hover:bg-[#e05200] transition cursor-pointer"
              >
                <span>Launch First Habit Tribe</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            arenas.map((arena: any) => {
            const isJoined = Boolean(joinedArenas[arena.id]);
            return (
              <div
                key={arena.id}
                className="p-5 rounded-3xl bg-white dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 transition flex flex-col justify-between shadow-xs hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-full bg-[#FF5E00]/10 text-[#FF5E00] text-[10px] font-black uppercase tracking-wider">
                      {arena.proof_type === "link" ? "Link Verified ↗" : "Photo Proof 📸"}
                    </span>
                    <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {arena.member_count || 12} spotters
                    </span>
                  </div>

                  <h3 className="text-base font-black text-neutral-900 dark:text-white">
                    {arena.name}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 line-clamp-2 leading-relaxed">
                    {arena.description || "Daily accountability check-ins with peer verification."}
                  </p>
                </div>

                <div className="pt-5 mt-4 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-neutral-400">Daily Cutoff</div>
                    <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#FF5E00]" />
                      {arena.deadline_time || "23:59"}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleJoinArena(arena)}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                      isJoined
                        ? "bg-emerald-500 text-neutral-950 shadow-sm"
                        : "bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                    }`}
                  >
                    {isJoined ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Joined</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        <span>1-Tap Lock In</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          }))}
        </div>
      </section>

      {/* ── 5. MINIMAL INSTAGRAM-STYLE FOOTER ── */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800/80 py-10 px-4 text-center text-xs text-neutral-500 dark:text-neutral-500">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-6 mb-4 font-medium">
          <Link href="/terms" className="hover:text-neutral-900 dark:hover:text-white transition">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-neutral-900 dark:hover:text-white transition">
            Privacy
          </Link>
          <Link href="/guidelines" className="hover:text-neutral-900 dark:hover:text-white transition">
            Guidelines
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-neutral-900 dark:hover:text-white transition"
          >
            GitHub
          </a>
        </div>
        <p className="text-[11px] text-neutral-400 dark:text-neutral-600">
          © 2026 Tribely. Built with social discipline.
        </p>
      </footer>
    </div>
  );
}
