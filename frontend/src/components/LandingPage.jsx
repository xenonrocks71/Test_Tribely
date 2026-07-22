"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TribelyLogo from "@/components/TribelyLogo";
import api from "@/app/utils/api";
import {
  FALLBACK_ARENAS,
  mapDiscoveryArena,
  storePendingArenaJoin,
} from "@/app/utils/arenas";
import { useTheme } from "@/app/context/ThemeContext";

const formatMembers = (count) =>
  count >= 1000 ? `${(count / 1000).toFixed(1)}k` : `${count}`;
const formatCurrency = (amount) => `₹${Number(amount).toLocaleString("en-IN")}`;

export default function LandingPage({ initialTab = "explore" }) {
  const router = useRouter();
  const [arenas, setArenas] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Global Theme Context
  const { theme, toggleTheme: toggleGlobalTheme } = useTheme();
  const isDarkMode = theme === "dark";

  useEffect(() => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("tribely_token")
        : null;
    setIsLoggedIn(Boolean(token));

    let isSubscribed = true;

    const loadArenas = async () => {
      setIsLoading(true);

      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 8000)
      );

      try {
        const res = await Promise.race([
          api.get("/api/arenas/discovery/list"),
          timeout,
        ]);
        const data = res.data?.data;
        if (isSubscribed && Array.isArray(data) && data.length > 0) {
          setArenas(data.map(mapDiscoveryArena));
          setIsLoading(false);
          return;
        }
      } catch (err) {
        // Fallback gracefully to predefined arenas if backend is offline or loading
      }

      if (isSubscribed) {
        setArenas(FALLBACK_ARENAS || []);
        setIsLoading(false);
      }
    };

    loadArenas();

    return () => {
      isSubscribed = false;
    };
  }, []);

  const filteredArenas = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return arenas;
    return arenas.filter(
      (arena) =>
        arena.name?.toLowerCase().includes(q) ||
        arena.description?.toLowerCase().includes(q)
    );
  }, [arenas, searchQuery]);

  const handleArenaAction = (arena) => {
    storePendingArenaJoin(arena);
    if (isLoggedIn) {
      router.push("/dashboard");
    } else {
      router.push("/login?redirect=/dashboard");
    }
  };

  return (
    <div
      className={`min-h-screen w-full font-sans antialiased transition-colors duration-200 overflow-x-hidden ${
        isDarkMode ? "bg-[#090D16] text-white" : "bg-[#F8FAFC] text-slate-900"
      }`}
    >
      {/* 1. TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-[#090D16]/80 border-b border-slate-200 dark:border-slate-800 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3 group">
              <TribelyLogo className="h-8 w-auto text-[#5B4DFF] group-hover:scale-105 transition-transform" />
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-[#5B4DFF] to-indigo-500 bg-clip-text text-transparent">
                TRIBELY
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <a href="#features" className="hover:text-[#5B4DFF] transition">
                Features
              </a>
              <a href="#how-it-works" className="hover:text-[#5B4DFF] transition">
                How It Works
              </a>
              <a href="#arenas" className="hover:text-[#5B4DFF] transition">
                Explore Arenas
              </a>
              <Link href="/security" className="hover:text-[#5B4DFF] transition">
                Security & Stakes
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleGlobalTheme}
              className="p-2 rounded-full border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Toggle Theme"
              aria-label="Toggle Theme"
            >
              {isDarkMode ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              )}
            </button>

            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="px-5 py-2 rounded-full text-xs font-bold text-white bg-[#5B4DFF] hover:bg-[#4B3EEB] transition shadow-md hover:shadow-indigo-500/25"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-[#5B4DFF] transition"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="px-5 py-2 rounded-full text-xs font-bold text-white bg-[#5B4DFF] hover:bg-[#4B3EEB] transition shadow-md hover:shadow-indigo-500/25 active:scale-95"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden">
        {/* Subtle Background Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 blur-3xl pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold mb-6 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Next-Gen Accountability Platform</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight max-w-4xl mx-auto leading-[1.1]">
            Build Unshakable Habits with{" "}
            <span className="bg-gradient-to-r from-[#5B4DFF] via-indigo-500 to-purple-600 bg-clip-text text-transparent">
              Real Group Stakes
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            Join habit arenas, upload daily proof before strict deadlines, and stay accountable alongside your tribe. Miss a deadline? Enforce real penalties.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={isLoggedIn ? "/dashboard" : "/register"}
              className="w-full sm:w-auto px-8 py-3.5 rounded-full font-bold text-sm text-white bg-[#5B4DFF] hover:bg-[#4B3EEB] transition shadow-xl hover:shadow-indigo-500/30 active:scale-95"
            >
              Start Your First Arena Free
            </Link>
            <a
              href="#arenas"
              className="w-full sm:w-auto px-8 py-3.5 rounded-full font-bold text-sm border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Explore Active Arenas
            </a>
          </div>

          {/* Interactive Product Mockup Preview */}
          <div className="mt-14 max-w-5xl mx-auto rounded-[32px] border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-4 text-xs font-semibold text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-slate-400 dark:text-slate-500">tribely.app/arena/5am-club</span>
              </div>
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 text-[10px] font-bold uppercase">
                Live Battle Arena
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500">Active Mandate</span>
                <h4 className="text-base font-bold text-slate-900 dark:text-white mt-1">5 AM Sunrise Run</h4>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Cutoff: 05:30 AM</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">₹ 500 Stakes</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50">
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">Daily Proof Submitted</span>
                <div className="mt-2 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                    ✓
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Alex Kumar</h4>
                    <p className="text-[11px] text-slate-500">Verified by 4 peers</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500">Streak Defense</span>
                <h4 className="text-base font-bold text-slate-900 dark:text-white mt-1">14 Days Unbroken</h4>
                <div className="mt-3 w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#5B4DFF] h-full w-4/5 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS SECTION */}
      <section id="how-it-works" className="py-20 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C121E]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#5B4DFF]">
              3-Step Discipline Framework
            </h2>
            <p className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-950 dark:text-white tracking-tight">
              How Tribely Enforces Real Accountability
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-[32px] border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/60 hover:border-indigo-300 dark:hover:border-indigo-500 transition duration-300">
              <div className="w-12 h-12 rounded-2xl bg-[#5B4DFF]/10 text-[#5B4DFF] font-black text-xl flex items-center justify-center mb-6">
                01
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Join or Create an Arena</h3>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Form an arena with friends or colleagues for 5 AM Club, Gym, Reading, or Deep Work. Define your daily cutoff deadline and penalty stakes.
              </p>
            </div>

            <div className="p-8 rounded-[32px] border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/60 hover:border-indigo-300 dark:hover:border-indigo-500 transition duration-300">
              <div className="w-12 h-12 rounded-2xl bg-[#5B4DFF]/10 text-[#5B4DFF] font-black text-xl flex items-center justify-center mb-6">
                02
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Submit Daily Proof</h3>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Before your daily deadline hits, upload photo or text proof directly to your arena's live ledger. No excuses, no late submissions.
              </p>
            </div>

            <div className="p-8 rounded-[32px] border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/60 hover:border-indigo-300 dark:hover:border-indigo-500 transition duration-300">
              <div className="w-12 h-12 rounded-2xl bg-[#5B4DFF]/10 text-[#5B4DFF] font-black text-xl flex items-center justify-center mb-6">
                03
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Peer Verification & Stakes</h3>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Group members review and upvote valid proofs. Miss a deadline or fail to submit? Pay the agreed penalty stake directly into the pool.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FEATURED / DISCOVERY ARENAS SECTION */}
      <section id="arenas" className="py-20 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#5B4DFF]">
                Featured Public Arenas
              </h2>
              <p className="mt-2 text-3xl font-extrabold text-slate-950 dark:text-white tracking-tight">
                Explore & Enlist in Active Communities
              </p>
            </div>

            {/* Search Input Filter */}
            <div className="w-full md:w-80 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search arenas by habit or name..."
                className="w-full px-4 py-2.5 pl-10 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5B4DFF] transition"
              />
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3.5 top-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Arenas Grid */}
          {isLoading ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              Loading active arenas...
            </div>
          ) : filteredArenas.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 p-8">
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                No active arenas match "{searchQuery}".
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredArenas.map((arena) => (
                <div
                  key={arena.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[28px] p-6 flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-500 transition duration-300 shadow-sm"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-bold text-slate-950 dark:text-white tracking-tight line-clamp-1">
                        {arena.name}
                      </h3>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                        {formatMembers(arena.member_count)} Members
                      </span>
                    </div>

                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 h-10">
                      {arena.description}
                    </p>

                    <div className="mt-6 space-y-2 border-t border-slate-200 dark:border-slate-800 pt-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <div className="flex justify-between">
                        <span>Proof Method:</span>
                        <span className="text-slate-900 dark:text-slate-100 font-semibold capitalize">
                          {arena.proof_type}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Daily Cutoff:</span>
                        <span className="text-slate-900 dark:text-slate-100 font-mono font-semibold">
                          {arena.deadline_time}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Penalty Stake:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          {formatCurrency(arena.penalty_amount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleArenaAction(arena)}
                    className="w-full mt-6 py-2.5 text-xs font-bold text-center bg-slate-950 dark:bg-indigo-600 hover:bg-[#5B4DFF] text-white rounded-full transition shadow-md active:scale-95"
                  >
                    Join Arena
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 5. PRODUCT FEATURES GRID */}
      <section id="features" className="py-20 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C121E]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#5B4DFF]">
              Engineered for Results
            </h2>
            <p className="mt-3 text-3xl font-extrabold text-slate-950 dark:text-white tracking-tight">
              Everything You Need to Stick to Your Goals
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/60">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold mb-4">
                ⚡
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Skin in the Game</h3>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Put financial and social stakes behind your daily commitments so failing has real consequences.
              </p>
            </div>

            <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/60">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold mb-4">
                📸
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Daily Proof Verification</h3>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Upload photos or text proof before daily cutoffs. Peers audit and upvote valid proof.
              </p>
            </div>

            <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/60">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold mb-4">
                💬
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Real-Time Group Chat</h3>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Stay connected with your arena members with live WebSocket chat and activity updates.
              </p>
            </div>

            <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/60">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold mb-4">
                🔒
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Private & Public Arenas</h3>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Create invite-only private rooms with admin approval gates or join public open arenas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CONVERSION CTA BANNER */}
      <section className="py-20 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="rounded-[40px] bg-gradient-to-r from-[#5B4DFF] via-indigo-600 to-purple-600 p-10 sm:p-16 text-white shadow-2xl relative overflow-hidden">
            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Ready to Build Unbreakable Habits?
              </h2>
              <p className="mt-4 text-sm sm:text-base text-indigo-100 leading-relaxed">
                Create your first arena in under 60 seconds. Invite your friends and hold each other accountable starting today.
              </p>
              <div className="mt-8 flex justify-center">
                <Link
                  href={isLoggedIn ? "/dashboard" : "/register"}
                  className="px-8 py-3.5 rounded-full font-bold text-sm bg-white text-[#5B4DFF] hover:bg-slate-100 transition shadow-lg active:scale-95"
                >
                  {isLoggedIn ? "Go to Workspace Dashboard" : "Get Started for Free"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-12 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <TribelyLogo className="h-6 w-auto text-[#5B4DFF]" />
            <span className="font-extrabold text-sm text-slate-900 dark:text-white">TRIBELY</span>
            <span>© {new Date().getFullYear()} Tribely Technologies. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6 font-medium">
            <Link href="/protocol" className="hover:text-[#5B4DFF] transition">
              Protocol
            </Link>
            <Link href="/security" className="hover:text-[#5B4DFF] transition">
              Security
            </Link>
            <Link href="/support" className="hover:text-[#5B4DFF] transition">
              Support
            </Link>
            <Link href="/transparency" className="hover:text-[#5B4DFF] transition">
              Transparency
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
