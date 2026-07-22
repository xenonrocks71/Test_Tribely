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

const FALLBACK_LEDGER_FEED = [
  {
    id: 1,
    user: "alex",
    action: "posted proof",
    arena: "5AM Club",
    status: "success",
  },
  {
    id: 2,
    user: "sam",
    action: "missed deadline",
    arena: "Savage Athletics",
    status: "liquidated",
    amount: 500,
  },
  {
    id: 3,
    user: "jordan",
    action: "posted proof",
    arena: "Deep Work Club",
    status: "success",
  },
  {
    id: 4,
    user: "priya",
    action: "posted proof",
    arena: "5AM Club",
    status: "success",
  },
];

const NAV_ITEMS = [
  { key: "explore", label: "Explore" },
  { key: "ledger", label: "Ledger" },
  { key: "proof", label: "Proof" },
  { key: "social", label: "Chat" },
  { key: "vault", label: "Vault" },
];

const formatMembers = (count) =>
  count >= 1000 ? `${(count / 1000).toFixed(1)}k` : `${count}`;
const formatCurrency = (amount) => `₹${Number(amount).toLocaleString("en-IN")}`;
const arenaInitial = (name) => (name || "A").trim().charAt(0).toUpperCase();

export default function LandingPage({ initialTab = "explore" }) {
  const [arenas, setArenas] = useState([]);
  const [ledgerFeed, setLedgerFeed] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [apiError, setApiError] = useState(false);
  const [usingSampleData, setUsingSampleData] = useState(false);

  // Global Theme Context
  const { theme, toggleTheme: toggleGlobalTheme, isMounted: mounted } = useTheme();
  const isDarkMode = theme === "dark";

  const toggleTheme = (e) => {
    e?.stopPropagation();
    toggleGlobalTheme();
  };

  useEffect(() => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("tribely_token")
        : null;
    setIsLoggedIn(Boolean(token));

    let isSubscribed = true;

    const loadArenas = async () => {
      setIsLoading(true);
      setApiError(false);

      // Force 2 second max wait for mobile network timeouts
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 10000),
      );

      try {
        const res = await Promise.race([
          api.get("/api/arenas/discovery/list"),
          timeout,
        ]);
        const data = res.data?.data;
        if (isSubscribed && Array.isArray(data) && data.length > 0) {
          setArenas(data.map(mapDiscoveryArena));
          setUsingSampleData(false);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        if (isSubscribed) setApiError(true);
      }

      // Fallback if local backend is unreachable over mobile IP
      if (isSubscribed) {
        setArenas(FALLBACK_ARENAS || []);
        setUsingSampleData(true);
        setLedgerFeed(FALLBACK_LEDGER_FEED);
        setIsLoading(false);
      }
    };

    loadArenas();

    return () => {
      isSubscribed = false;
    };
  }, []);

  const totalStakesCommitted = useMemo(
    () => arenas.reduce((sum, a) => sum + (a.stake_at_risk || 0), 0),
    [arenas],
  );

  const filteredArenas = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return arenas;
    return arenas.filter(
      (arena) =>
        arena.name?.toLowerCase().includes(q) ||
        arena.description?.toLowerCase().includes(q),
    );
  }, [arenas, searchQuery]);

  return (
    <div
      className={`min-h-screen w-full font-sans antialiased transition-colors duration-200 overflow-x-hidden selection:bg-purple-500 selection:text-white ${
        mounted && !isDarkMode
          ? "bg-[#F8FAFC] text-slate-900"
          : "bg-[#131313] text-white"
      }`}
    >
      <div className="flex">
        <Sidebar
          isLoggedIn={isLoggedIn}
          activeTab={activeTab}
          onNavigate={setActiveTab}
          isDarkMode={isDarkMode}
        />

        <div className="flex-1 min-w-0 flex flex-col">
          <TopBar
            isLoggedIn={isLoggedIn}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isDarkMode={isDarkMode}
            onToggleTheme={toggleTheme}
          />

          <main className="flex-1 px-4 md:px-8 pt-6 pb-28 md:pb-10 max-w-6xl w-full mx-auto space-y-8">
            {apiError && activeTab === "explore" && (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm text-center backdrop-blur-md ${
                  isDarkMode
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                Backend is temporarily unreachable. Showing offline sample
                arenas while the app retries.
              </div>
            )}

            {activeTab === "explore" ? (
              <>
                <Hero
                  totalStakesCommitted={totalStakesCommitted}
                  isDarkMode={isDarkMode}
                />

                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  isDarkMode={isDarkMode}
                  className="md:hidden"
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-4">
                    <SectionHeader
                      title="Open arenas"
                      count={filteredArenas.length}
                      isDarkMode={isDarkMode}
                    />
                    <ArenaGrid
                      arenas={filteredArenas}
                      isLoading={isLoading}
                      searchActive={Boolean(searchQuery)}
                      isLoggedIn={isLoggedIn}
                      usingSampleData={usingSampleData}
                      isDarkMode={isDarkMode}
                    />
                  </div>

                  <div className="hidden lg:block">
                    <LedgerFeed items={ledgerFeed} isDarkMode={isDarkMode} />
                  </div>
                </div>
              </>
            ) : (
              <ComingSoonPanel tab={activeTab} isDarkMode={isDarkMode} />
            )}
          </main>

          <PageFooter isDarkMode={isDarkMode} />
        </div>
      </div>

      <BottomNav
        activeTab={activeTab}
        onNavigate={setActiveTab}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}

function Sidebar({ isLoggedIn, activeTab, onNavigate, isDarkMode }) {
  const newArenaHref = isLoggedIn
    ? "/dashboard?create=1"
    : "/login?redirect=/dashboard?create=1";

  const links = [
    { key: "explore", label: "Arenas" },
    { key: "ledger", label: "Ledger" },
    { key: "vault", label: "Vault" },
  ];

  return (
    <aside
      className={`hidden md:flex md:w-56 md:flex-col md:shrink-0 border-r min-h-screen sticky top-0 px-4 py-5 transition-colors ${
        isDarkMode
          ? "border-white/10 bg-[#131313]"
          : "border-slate-200 bg-white"
      }`}
    >
      <Link href="/" className="flex items-center gap-2.5 mb-8 px-1">
        <TribelyLogo className="h-8 w-8 text-purple-600" />
        <span
          className={`text-base font-extrabold tracking-wider ${
            isDarkMode ? "text-white" : "text-slate-900"
          }`}
        >
          Tribely
        </span>
      </Link>

      <Link
        href={newArenaHref}
        className="mb-6 h-10 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold flex items-center justify-center gap-1 transition-all shadow-lg shadow-purple-600/20 active:scale-95"
      >
        + Create arena
      </Link>

      <nav className="space-y-1 flex-1">
        {links.map((link) => (
          <button
            key={link.key}
            type="button"
            onClick={() => onNavigate(link.key)}
            className={`w-full px-3 h-9 rounded-xl text-sm font-medium transition-all text-left ${
              activeTab === link.key
                ? isDarkMode
                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                  : "bg-purple-50 text-purple-700 font-semibold"
                : isDarkMode
                  ? "text-gray-400 hover:bg-white/5 hover:text-white"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            {link.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

function TopBar({
  isLoggedIn,
  searchQuery,
  onSearchChange,
  isDarkMode,
  onToggleTheme,
}) {
  return (
    <header
      className={`sticky top-0 z-30 backdrop-blur-md border-b transition-colors ${
        isDarkMode
          ? "bg-[#131313]/80 border-white/10 shadow-sm"
          : "bg-white/80 border-slate-200 shadow-sm"
      }`}
    >
      <div className="md:hidden h-14 px-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <TribelyLogo className="h-7 w-7 text-purple-600" />
          <span
            className={`text-base font-extrabold tracking-wider ${
              isDarkMode ? "text-white" : "text-slate-900"
            }`}
          >
            Tribely
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <ThemeToggleButton isDarkMode={isDarkMode} onToggle={onToggleTheme} />
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-purple-500"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-sm font-semibold text-purple-500"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>

      <div className="hidden md:flex h-14 px-8 items-center justify-between gap-6">
        <div className="flex-1 max-w-sm relative">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search arenas..."
            className={`w-full h-9 pl-4 pr-3 rounded-full text-sm transition focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
              isDarkMode
                ? "bg-white/5 border border-white/10 text-white placeholder-gray-500"
                : "bg-slate-100 border border-slate-200 text-slate-900 placeholder-slate-400"
            }`}
          />
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggleButton isDarkMode={isDarkMode} onToggle={onToggleTheme} />

          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className={`text-sm font-medium ${
                isDarkMode ? "text-gray-300" : "text-slate-600"
              }`}
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="h-9 px-5 rounded-full bg-purple-600 text-white text-sm font-semibold flex items-center shadow-lg shadow-purple-600/20"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function ThemeToggleButton({ isDarkMode, onToggle }) {
  return (
    <button
      onClick={onToggle}
      type="button"
      aria-label="Toggle light and dark mode"
      className={`p-2 rounded-xl border transition-all active:scale-90 ${
        isDarkMode
          ? "bg-white/10 border-white/10 text-amber-400 hover:bg-white/20"
          : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {isDarkMode ? (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
}

function Hero({ totalStakesCommitted, isDarkMode }) {
  return (
    <section className="relative max-w-2xl pt-2 space-y-4">
      <div
        className={`inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium border ${
          isDarkMode
            ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
            : "bg-purple-50 border-purple-200 text-purple-700"
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
        <span>High-Stakes Financial Accountability</span>
      </div>

      <h1
        className={`text-3xl md:text-5xl font-black tracking-tight leading-tight ${
          isDarkMode ? "text-white" : "text-slate-900"
        }`}
      >
        Habit groups with <br className="hidden sm:block" />
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500">
          real stakes.
        </span>
      </h1>

      <p
        className={`text-base leading-relaxed max-w-lg ${
          isDarkMode ? "text-gray-400" : "text-slate-600"
        }`}
      >
        Tribely is a group chat for daily goals. Join an arena, post proof
        before your deadline, and pay the penalty if you skip a day.
      </p>

      <div className="flex flex-wrap gap-3 pt-2">
        <Link
          href="/register"
          className="inline-flex h-10 px-6 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold items-center transition-all shadow-lg shadow-purple-600/25 active:scale-95"
        >
          Get started
        </Link>
        <a
          href="#arena-grid"
          className={`inline-flex h-10 px-6 rounded-full border text-sm font-semibold items-center transition-all ${
            isDarkMode
              ? "bg-white/5 border-white/10 text-gray-300"
              : "bg-white border-slate-200 text-slate-700 shadow-sm"
          }`}
        >
          Browse arenas
        </a>
      </div>

      {totalStakesCommitted > 0 && (
        <div
          className={`inline-block rounded-2xl border px-5 py-4 shadow-xl mt-4 backdrop-blur-md ${
            isDarkMode
              ? "bg-white/[0.02] border-white/10"
              : "bg-white border-slate-200"
          }`}
        >
          <p
            className={`text-xs font-medium ${isDarkMode ? "text-gray-400" : "text-slate-500"}`}
          >
            Stakes across open arenas
          </p>
          <p className="text-2xl font-black text-purple-600 mt-0.5">
            {formatCurrency(totalStakesCommitted)}
          </p>
        </div>
      )}
    </section>
  );
}

function SearchBar({ value, onChange, isDarkMode, className = "" }) {
  return (
    <div className={className}>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search arenas..."
        className={`w-full h-10 px-4 rounded-full text-sm transition focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
          isDarkMode
            ? "bg-white/5 border border-white/10 text-white placeholder-gray-500"
            : "bg-white border border-slate-200 text-slate-900 placeholder-slate-400 shadow-sm"
        }`}
      />
    </div>
  );
}

function SectionHeader({ title, count, isDarkMode }) {
  return (
    <div className="flex items-center justify-between">
      <h2
        className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}
      >
        {title}
        {typeof count === "number" && (
          <span className="text-purple-500 font-semibold text-base ml-2">
            ({count})
          </span>
        )}
      </h2>
    </div>
  );
}

function ArenaGrid({
  arenas,
  isLoading,
  searchActive,
  isLoggedIn,
  usingSampleData,
  isDarkMode,
}) {
  if (isLoading) {
    return (
      <div id="arena-grid" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-44 rounded-[28px] border animate-pulse ${
              isDarkMode
                ? "bg-white/[0.02] border-white/10"
                : "bg-slate-200/60 border-slate-200"
            }`}
          />
        ))}
      </div>
    );
  }

  if (arenas.length === 0) {
    return (
      <div
        id="arena-grid"
        className={`rounded-[28px] border border-dashed p-10 text-center ${
          isDarkMode
            ? "border-white/10 bg-white/[0.02]"
            : "border-slate-300 bg-white"
        }`}
      >
        <h3
          className={`text-base font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}
        >
          No arenas found
        </h3>
        <p
          className={`text-sm mt-1 ${isDarkMode ? "text-gray-400" : "text-slate-500"}`}
        >
          {searchActive
            ? "Try a different search term."
            : "Check back later or create your own."}
        </p>
      </div>
    );
  }

  return (
    <div id="arena-grid" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {arenas.map((arena) => (
        <ArenaCard
          key={arena.id}
          arena={arena}
          isLoggedIn={isLoggedIn}
          usingSampleData={usingSampleData}
          isDarkMode={isDarkMode}
        />
      ))}
    </div>
  );
}

function ArenaCard({ arena, isLoggedIn, usingSampleData, isDarkMode }) {
  const router = useRouter();

  const handleJoin = (e) => {
    if (isLoggedIn) return;
    if (usingSampleData) {
      e.preventDefault();
      router.push("/login?redirect=/dashboard");
      return;
    }
    e.preventDefault();
    storePendingArenaJoin(arena.id, arena.is_private);
    router.push("/login?redirect=/dashboard");
  };

  return (
    <Link
      href={`/arena/${arena.id}`}
      onClick={handleJoin}
      className={`group rounded-[28px] border p-5 flex flex-col justify-between transition-all shadow-md active:scale-98 ${
        isDarkMode
          ? "border-white/10 bg-white/[0.02] hover:border-purple-500/50 hover:bg-white/[0.04]"
          : "border-slate-200 bg-white hover:border-purple-300 hover:bg-slate-50/50"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div
          className={`h-10 w-10 rounded-2xl border flex items-center justify-center text-sm font-bold ${
            isDarkMode
              ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
              : "bg-purple-50 border-purple-100 text-purple-700"
          }`}
        >
          {arenaInitial(arena.name)}
        </div>
        <span
          className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${
            arena.is_private
              ? isDarkMode
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                : "bg-amber-50 text-amber-700 border border-amber-200"
              : isDarkMode
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}
        >
          {arena.is_private ? "Private" : "Public"}
        </span>
      </div>

      <div className="space-y-1.5 flex-1">
        <h3
          className={`text-base font-bold group-hover:text-purple-500 transition-colors line-clamp-1 ${
            isDarkMode ? "text-white" : "text-slate-900"
          }`}
        >
          {arena.name}
        </h3>
        <p
          className={`text-sm leading-relaxed line-clamp-2 ${
            isDarkMode ? "text-gray-400" : "text-slate-500"
          }`}
        >
          {arena.description}
        </p>
      </div>

      <div
        className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
          isDarkMode
            ? "border-white/5 text-gray-400"
            : "border-slate-100 text-slate-500"
        }`}
      >
        <span>{formatMembers(arena.member_count)} members</span>
        <span
          className={`font-semibold ${isDarkMode ? "text-purple-300" : "text-purple-700"}`}
        >
          {formatCurrency(arena.stake_at_risk)} penalty
        </span>
      </div>
    </Link>
  );
}

function LedgerFeed({ items, isDarkMode }) {
  return (
    <div
      className={`rounded-[28px] border p-5 sticky top-20 shadow-xl backdrop-blur-md ${
        isDarkMode
          ? "border-white/10 bg-white/[0.02]"
          : "border-slate-200 bg-white"
      }`}
    >
      <h2
        className={`text-sm font-bold mb-4 flex items-center gap-2 ${isDarkMode ? "text-white" : "text-slate-900"}`}
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        Recent activity
      </h2>

      {!items.length ? (
        <p
          className={`text-sm leading-relaxed ${isDarkMode ? "text-gray-400" : "text-slate-500"}`}
        >
          Proof submissions and penalties show up here when connected.
        </p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl p-3 text-sm ${
                item.status === "liquidated"
                  ? isDarkMode
                    ? "bg-red-500/10 border border-red-500/20 text-red-300"
                    : "bg-rose-50 border border-rose-100 text-rose-800"
                  : isDarkMode
                    ? "bg-white/5 border border-white/5 text-gray-300"
                    : "bg-slate-50 border border-slate-100 text-slate-700"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p>
                  <span
                    className={`font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}
                  >
                    {item.user}
                  </span>{" "}
                  {item.action}
                </p>
                {item.status === "liquidated" ? (
                  <span className="text-rose-500 font-bold text-xs shrink-0">
                    −{formatCurrency(item.amount)}
                  </span>
                ) : null}
              </div>
              <p
                className={`text-xs mt-1 ${isDarkMode ? "text-gray-500" : "text-slate-400"}`}
              >
                {item.arena}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ComingSoonPanel({ tab, isDarkMode }) {
  const copy = {
    ledger: {
      title: "Ledger",
      body: "Every proof and penalty in your arena is logged here.",
    },
    proof: {
      title: "Proof",
      body: "Submit a photo, link, or note before the daily cutoff.",
    },
    social: {
      title: "Chat",
      body: "Each arena has a group thread for daily check-ins.",
    },
    vault: {
      title: "Vault",
      body: "See how much you've staked and what's been deducted.",
    },
  }[tab];

  if (!copy) return null;

  return (
    <div className="max-w-md mx-auto text-center py-12 space-y-4">
      <div
        className={`rounded-[28px] border p-8 shadow-xl space-y-3 backdrop-blur-md ${
          isDarkMode
            ? "border-white/10 bg-white/[0.02]"
            : "border-slate-200 bg-white"
        }`}
      >
        <h3
          className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}
        >
          {copy.title}
        </h3>
        <p
          className={`text-sm ${isDarkMode ? "text-gray-400" : "text-slate-500"}`}
        >
          {copy.body}
        </p>
        <Link
          href="/register"
          className="inline-flex h-10 px-6 rounded-full bg-purple-600 text-white text-sm font-semibold items-center justify-center mt-2 shadow-lg shadow-purple-600/25"
        >
          Create an account
        </Link>
      </div>
    </div>
  );
}

function BottomNav({ activeTab, onNavigate, isDarkMode }) {
  return (
    <footer
      className={`md:hidden fixed bottom-0 inset-x-0 backdrop-blur-lg border-t flex items-stretch z-40 pb-[env(safe-area-inset-bottom)] transition-colors ${
        isDarkMode
          ? "bg-[#131313]/90 border-white/10"
          : "bg-white/90 border-slate-200"
      }`}
    >
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onNavigate(item.key)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
            activeTab === item.key
              ? "text-purple-500"
              : isDarkMode
                ? "text-gray-500"
                : "text-slate-400"
          }`}
        >
          <span
            className={`h-0.5 w-6 rounded-full mb-1 transition-all ${
              activeTab === item.key
                ? "bg-purple-600 shadow-sm shadow-purple-600"
                : "bg-transparent"
            }`}
          />
          {item.label}
        </button>
      ))}
    </footer>
  );
}

function PageFooter({ isDarkMode }) {
  return (
    <footer
      className={`hidden md:flex items-center justify-between px-8 py-6 border-t text-xs transition-colors ${
        isDarkMode
          ? "border-white/10 text-gray-500"
          : "border-slate-200 text-slate-400"
      }`}
    >
      <span>© {new Date().getFullYear()} Tribely Protocol</span>
      <div className="flex items-center gap-6">
        <Link href="/protocol" className="hover:text-purple-500">
          How it works
        </Link>
        <Link href="/transparency" className="hover:text-purple-500">
          Ledger
        </Link>
        <Link href="/security" className="hover:text-purple-500">
          Security
        </Link>
      </div>
    </footer>
  );
}
