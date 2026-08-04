"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TribelyLogo from "@/components/TribelyLogo";
import api from "@/app/utils/api";
import dataCache from "@/app/utils/dataCache";
import FastLink from "@/components/FastLink";
import { FALLBACK_ARENAS, mapDiscoveryArena, storePendingArenaJoin } from "@/app/utils/arenas";
import { useTheme } from "@/app/context/ThemeContext";

const formatMembers = (count) =>
  count >= 1000 ? `${(count / 1000).toFixed(1)}k` : `${count}`;
const formatCurrency = (amount) =>
  `₹${Number(amount).toLocaleString("en-IN")}`;

// ── Sun / Moon icons ──────────────────────────────────────────────────────
function SunIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

export default function LandingPage({ initialTab = "explore" }) {
  const router = useRouter();
  const [arenas, setArenas] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const { theme, toggleTheme: toggleGlobalTheme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("tribely_token") : null;
    setIsLoggedIn(Boolean(token));

    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });

    let active = true;
    const load = async () => {
      await dataCache.fetchSWR("/api/arenas/discovery/list", (data) => {
        if (active && Array.isArray(data) && data.length > 0) {
          setArenas(data.map(mapDiscoveryArena));
          setIsLoading(false);
        }
      }, () => {
        if (active) {
          setArenas(FALLBACK_ARENAS || []);
          setIsLoading(false);
        }
      });
    };
    load();
    return () => { active = false; window.removeEventListener("scroll", onScroll); };
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return arenas;
    return arenas.filter(a =>
      a.name?.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q)
    );
  }, [arenas, searchQuery]);

  const handleArenaAction = (arena) => {
    storePendingArenaJoin(arena);
    router.push(isLoggedIn ? "/dashboard" : "/login?redirect=/dashboard");
  };

  const NAV_LINKS = [
    { href: "#features", label: "Features" },
    { href: "#how-it-works", label: "How It Works" },
    { href: "#arenas", label: "Explore Arenas" },
    { href: "/security", label: "Security & Stakes" },
  ];

  const STEPS = [
    { n: "01", title: "Join or Create an Arena", body: "Form an arena with friends for 5 AM Club, Gym, Reading, or Deep Work. Set your daily cutoff and penalty stakes." },
    { n: "02", title: "Submit Daily Proof", body: "Before your deadline, upload photo or text proof to the arena's live ledger. No excuses, no late submissions." },
    { n: "03", title: "Peer Verification & Stakes", body: "Members review and upvote valid proofs. Miss a deadline? Pay the agreed penalty stake directly into the pool." },
  ];

  const FEATURES = [
    { icon: "⚡", color: "rgba(0,122,204,0.12)", title: "Skin in the Game", body: "Put financial and social stakes behind your daily commitments so failing has real consequences." },
    { icon: "📸", color: "rgba(139,92,246,0.12)", title: "Daily Proof Verification", body: "Upload photos or text proof before daily cutoffs. Peers audit and upvote valid proof." },
    { icon: "💬", color: "rgba(16,185,129,0.12)", title: "Real-Time Group Chat", body: "Stay connected with live WebSocket chat and live arena activity updates." },
    { icon: "🔒", color: "rgba(245,158,11,0.12)", title: "Private & Public Arenas", body: "Create invite-only private rooms with admin approval gates or join open public arenas." },
  ];

  const FOOTER_LINKS = [["protocol","Protocol"],["security","Security"],["support","Support"],["transparency","Transparency"]];

  return (
    <div style={{ background: "var(--bg)", color: "var(--fg)" }} className="min-h-screen w-full overflow-x-hidden transition-colors duration-200">

      {/* ── NAVBAR ─────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "shadow-lg" : ""}`}
        style={{
          background: scrolled ? "var(--glass-bg)" : "transparent",
          backdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
          borderBottom: scrolled ? "1px solid var(--border)" : "1px solid transparent",
        }}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <FastLink href="/" className="flex items-center gap-2.5 group">
              <TribelyLogo className="h-7 w-auto" style={{ color: "var(--accent)" }} />
              <span className="font-extrabold text-lg tracking-tight" style={{ color: "var(--fg)" }}>TRIBELY</span>
            </FastLink>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium" style={{ color: "var(--fg-muted)" }}>
              {NAV_LINKS.map(l => (
                l.href.startsWith("/") ? (
                  <FastLink key={l.href} href={l.href} className="transition-colors hover:text-[var(--accent)]"
                    style={{ transition: "color 0.15s" }}>{l.label}</FastLink>
                ) : (
                  <a key={l.href} href={l.href} className="transition-colors hover:text-[var(--accent)]"
                    style={{ transition: "color 0.15s" }}>{l.label}</a>
                )
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleGlobalTheme}
              className="p-2.5 rounded-full transition-all duration-150 hover:scale-110"
              style={{ background: "var(--bg-raised)", border: "1px solid var(--border)", color: "var(--fg-muted)" }}
              aria-label="Toggle theme"
            >
              {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
            {isLoggedIn ? (
              <Link href="/dashboard"
                className="px-5 py-2.5 rounded-full text-xs font-bold text-white transition-all duration-150 hover:opacity-90 active:scale-95"
                style={{ background: "var(--accent)", boxShadow: "0 4px 16px var(--accent-glow)" }}>
                Dashboard →
              </Link>
            ) : (
              <>
                <Link href="/login"
                  className="px-4 py-2 text-sm font-semibold transition-colors hover:opacity-70"
                  style={{ color: "var(--fg-muted)" }}>Sign in</Link>
                <Link href="/register"
                  className="px-5 py-2.5 rounded-full text-sm font-bold text-white transition-all duration-150 hover:opacity-90 active:scale-95"
                  style={{ background: "var(--accent)", boxShadow: "0 4px 16px var(--accent-glow)" }}>
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="relative pt-16 pb-24 md:pt-28 md:pb-36 overflow-hidden">
        {/* background orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full"
            style={{ background: "radial-gradient(ellipse, rgba(0,122,204,0.12) 0%, transparent 70%)", filter: "blur(40px)" }} />
          <div className="absolute bottom-0 left-[-5%] w-[400px] h-[400px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(0,122,204,0.06) 0%, transparent 70%)", filter: "blur(60px)" }} />
          <div className="absolute bottom-0 right-[-5%] w-[400px] h-[400px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)", filter: "blur(60px)" }} />
        </div>

        <div className="max-w-7xl mx-auto px-5 sm:px-8 relative z-10 text-center">
          {/* pill badge */}
          <div className="animate-fade-in inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8"
            style={{ background: "var(--accent-light)", border: "1px solid rgba(0,122,204,0.25)", color: "var(--accent)" }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--success)" }} />
            Next-Gen Accountability Platform
          </div>

          <h1 className="animate-fade-in delay-100 text-5xl sm:text-6xl lg:text-[72px] font-extrabold tracking-tight leading-[1.05] max-w-4xl mx-auto"
            style={{ color: "var(--fg)" }}>
            Build Unshakable Habits<br />with{" "}
            <span style={{
              background: "linear-gradient(135deg, var(--accent), #0095F6, #38BDF8)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
            }}>Real Group Stakes</span>
          </h1>

          <p className="animate-fade-in delay-200 mt-6 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed"
            style={{ color: "var(--fg-muted)" }}>
            Join habit arenas, upload daily proof before strict deadlines, and stay accountable alongside your tribe. Miss a deadline? Enforce real penalties.
          </p>

          <div className="animate-fade-in delay-300 mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href={isLoggedIn ? "/dashboard" : "/register"}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl font-bold text-sm text-white transition-all duration-150 hover:opacity-90 active:scale-95"
              style={{ background: "var(--accent)", boxShadow: "0 8px 32px var(--accent-glow)" }}>
              Start Your First Arena — Free
            </Link>
            <a href="#arenas"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl font-bold text-sm transition-all duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)] btn-ghost">
              Explore Active Arenas
            </a>
          </div>

          {/* ── PRODUCT MOCKUP ── */}
          <div className="animate-fade-in delay-400 mt-16 max-w-4xl mx-auto rounded-[28px] p-5 sm:p-7 shadow-2xl"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            {/* browser chrome */}
            <div className="flex items-center justify-between border-b pb-4 mb-5" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ background: "#FF5F57" }} />
                <span className="w-3 h-3 rounded-full" style={{ background: "#FFBD2E" }} />
                <span className="w-3 h-3 rounded-full" style={{ background: "#28C840" }} />
                <span className="ml-3 text-[11px] font-mono" style={{ color: "var(--fg-subtle)" }}>tribely.app/arena/5am-club</span>
              </div>
              <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase"
                style={{ background: "rgba(16,185,129,0.10)", color: "var(--success)", border: "1px solid rgba(16,185,129,0.20)" }}>
                <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ background: "var(--success)" }} />
                Live Battle Arena
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              {[
                { label: "Active Mandate", title: "5 AM Sunrise Run", meta1: "Cutoff: 05:30 AM", meta2: "₹ 500 Stakes", accent: false },
                { label: "Daily Proof Submitted", title: "Alex Kumar", meta1: "Verified by 4 peers ✓", meta2: null, accent: true },
                { label: "Streak Defense", title: "14 Days Unbroken", meta1: null, meta2: null, progress: true, accent: false },
              ].map((card, i) => (
                <div key={i} className="p-4 rounded-2xl"
                  style={{
                    background: card.accent ? "var(--accent-light)" : "var(--bg-raised)",
                    border: `1px solid ${card.accent ? "rgba(0,122,204,0.20)" : "var(--border)"}`,
                  }}>
                  <span className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: card.accent ? "var(--accent)" : "var(--fg-muted)" }}>{card.label}</span>
                  <h4 className="text-sm font-bold mt-1" style={{ color: "var(--fg)" }}>{card.title}</h4>
                  {card.meta1 && <p className="text-xs mt-2" style={{ color: "var(--fg-muted)" }}>{card.meta1}</p>}
                  {card.meta2 && <p className="text-xs font-bold mt-1" style={{ color: "var(--success)" }}>{card.meta2}</p>}
                  {card.progress && (
                    <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                      <div className="h-full rounded-full w-4/5" style={{ background: "var(--accent)" }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────── */}
      <section id="how-it-works" className="py-24 border-t" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-xs font-extrabold uppercase tracking-widest mb-3" style={{ color: "var(--accent)" }}>
              3-Step Discipline Framework
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: "var(--fg)" }}>
              How Tribely Enforces Real Accountability
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((s) => (
              <div key={s.n} className="p-8 rounded-3xl card-hover"
                style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl mb-6"
                  style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                  {s.n}
                </div>
                <h3 className="text-lg font-bold mb-3" style={{ color: "var(--fg)" }}>{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DISCOVERY ARENAS ───────────────────────────────── */}
      <section id="arenas" className="py-24 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest mb-2" style={{ color: "var(--accent)" }}>Featured Public Arenas</p>
              <h2 className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--fg)" }}>Explore & Enlist in Active Communities</h2>
            </div>
            <div className="relative w-full md:w-80">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search arenas..."
                className="w-full pl-10 pr-4 py-2.5 rounded-full text-sm focus-accent"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--fg)" }} />
              <svg className="w-4 h-4 absolute left-3.5 top-3" style={{ color: "var(--fg-subtle)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1,2,3].map(i => (
                <div key={i} className="rounded-[28px] h-64 animate-shimmer"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 rounded-3xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p style={{ color: "var(--fg-muted)" }}>No arenas match "{searchQuery}".</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((arena) => (
                <div key={arena.id} className="rounded-[28px] p-6 flex flex-col justify-between card-hover shadow-sm"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-base font-bold line-clamp-1" style={{ color: "var(--fg)" }}>{arena.name}</h3>
                      <span className="pill shrink-0"
                        style={{ background: "rgba(16,185,129,0.10)", color: "var(--success)", border: "1px solid rgba(16,185,129,0.20)" }}>
                        {formatMembers(arena.member_count)} Members
                      </span>
                    </div>
                    <p className="text-sm line-clamp-2 h-10" style={{ color: "var(--fg-muted)" }}>{arena.description}</p>

                    <div className="mt-5 pt-4 space-y-2 text-xs font-medium border-t" style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}>
                      <div className="flex justify-between">
                        <span>Proof Method</span>
                        <span className="font-semibold capitalize" style={{ color: "var(--fg)" }}>{arena.proof_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Daily Cutoff</span>
                        <span className="font-mono font-semibold" style={{ color: "var(--fg)" }}>{arena.deadline_time}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Penalty Stake</span>
                        <span className="font-bold" style={{ color: "var(--success)" }}>{formatCurrency(arena.penalty_amount)}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleArenaAction(arena)}
                    className="w-full mt-5 py-2.5 text-sm font-bold text-white rounded-full transition-all duration-150 hover:opacity-90 active:scale-95"
                    style={{ background: "var(--accent)", boxShadow: "0 4px 16px var(--accent-glow2)" }}>
                    Join Arena
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── FEATURES GRID ──────────────────────────────────── */}
      <section id="features" className="py-24 border-t" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-xs font-extrabold uppercase tracking-widest mb-3" style={{ color: "var(--accent)" }}>Engineered for Results</p>
            <h2 className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--fg)" }}>Everything You Need to Stick to Your Goals</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-6 rounded-3xl card-hover"
                style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}>
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-lg mb-5"
                  style={{ background: f.color }}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-sm mb-2" style={{ color: "var(--fg)" }}>{f.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--fg-muted)" }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ─────────────────────────────────────── */}
      <section className="py-24 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-8">
          <div className="relative overflow-hidden rounded-[40px] p-10 sm:p-16 text-center"
            style={{ background: "linear-gradient(135deg, #005fa3 0%, var(--accent) 50%, #0095F6 100%)" }}>
            {/* glow orbs inside CTA */}
            <div className="absolute top-[-40px] left-[-40px] w-64 h-64 rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)" }} />
            <div className="absolute bottom-[-40px] right-[-40px] w-64 h-64 rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)" }} />
            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Ready to Build Unbreakable Habits?
              </h2>
              <p className="mt-4 text-sm sm:text-base text-blue-100 leading-relaxed">
                Create your first arena in under 60 seconds. Invite your friends and hold each other accountable starting today.
              </p>
              <div className="mt-8">
                <Link href={isLoggedIn ? "/dashboard" : "/register"}
                  className="inline-flex px-8 py-3.5 rounded-full font-bold text-sm bg-white hover:bg-slate-50 transition-all duration-150 active:scale-95 shadow-xl"
                  style={{ color: "var(--accent)" }}>
                  {isLoggedIn ? "Go to Dashboard →" : "Get Started for Free →"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer className="border-t py-12 text-xs" style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <TribelyLogo className="h-5 w-auto" style={{ color: "var(--accent)" }} />
            <span className="font-extrabold text-sm" style={{ color: "var(--fg)" }}>TRIBELY</span>
            <span>© {new Date().getFullYear()} Tribely Technologies. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 font-medium">
            {[["/protocol","Protocol"],["/security","Security"],["/support","Support"],["/transparency","Transparency"]].map(([href, label]) => (
              <Link key={href} href={href} className="hover:opacity-80 transition" style={{ color: "var(--fg-muted)" }}>{label}</Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
