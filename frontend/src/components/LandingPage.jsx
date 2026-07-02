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

const formatCurrency = (amount) =>
  `₹${Number(amount).toLocaleString("en-IN")}`;

const arenaInitial = (name) =>
  (name || "A").trim().charAt(0).toUpperCase();

export default function LandingPage({ initialTab = "explore" }) {
  const [arenas, setArenas] = useState([]);
  const [ledgerFeed, setLedgerFeed] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [apiError, setApiError] = useState(false);
  const [usingSampleData, setUsingSampleData] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("tribely_token");
    setIsLoggedIn(Boolean(token));

    const loadArenas = async () => {
      setIsLoading(true);
      setApiError(false);
      try {
        const res = await api.get("/api/arenas/discovery/list");
        const data = res.data?.data;
        if (Array.isArray(data) && data.length > 0) {
          setArenas(data.map(mapDiscoveryArena));
          setUsingSampleData(false);
          setIsLoading(false);
          return;
        }
      } catch {
        setApiError(true);
      }
      setArenas(FALLBACK_ARENAS);
      setUsingSampleData(true);
      setLedgerFeed(FALLBACK_LEDGER_FEED);
      setIsLoading(false);
    };

    loadArenas();
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
    <div className="min-h-screen w-full bg-[#F3F4F6] text-slate-900 font-sans antialiased">
      <div className="flex">
        <Sidebar isLoggedIn={isLoggedIn} activeTab={activeTab} onNavigate={setActiveTab} />

        <div className="flex-1 min-w-0 flex flex-col">
          <TopBar
            isLoggedIn={isLoggedIn}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          <main className="flex-1 px-4 md:px-8 pt-6 pb-24 md:pb-10 max-w-6xl w-full mx-auto space-y-8">
            {apiError && activeTab === "explore" && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 text-center">
                Could not reach the server — showing sample arenas. Start the
                backend to load live data.
              </div>
            )}

            {activeTab === "explore" ? (
              <>
                <Hero totalStakesCommitted={totalStakesCommitted} />

                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  className="md:hidden"
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-4">
                    <SectionHeader
                      title="Open arenas"
                      count={filteredArenas.length}
                    />
                    <ArenaGrid
                      arenas={filteredArenas}
                      isLoading={isLoading}
                      searchActive={Boolean(searchQuery)}
                      isLoggedIn={isLoggedIn}
                      usingSampleData={usingSampleData}
                    />
                  </div>

                  <div className="hidden lg:block">
                    <LedgerFeed items={ledgerFeed} />
                  </div>
                </div>
              </>
            ) : (
              <ComingSoonPanel tab={activeTab} />
            )}
          </main>

          <PageFooter />
        </div>
      </div>

      <BottomNav activeTab={activeTab} onNavigate={setActiveTab} />
    </div>
  );
}

function Sidebar({ isLoggedIn, activeTab, onNavigate }) {
  const newArenaHref = isLoggedIn
    ? "/dashboard?create=1"
    : "/login?redirect=/dashboard?create=1";

  const links = [
    { key: "explore", label: "Arenas" },
    { key: "ledger", label: "Ledger" },
    { key: "vault", label: "Vault" },
  ];

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:shrink-0 border-r border-slate-200 bg-white min-h-screen sticky top-0 px-4 py-5">
      <Link href="/" className="flex items-center gap-2.5 mb-8 px-1">
        <TribelyLogo className="h-8 w-8" />
        <span className="text-base font-bold text-slate-950">Tribely</span>
      </Link>

      <Link
        href={newArenaHref}
        className="mb-6 h-10 rounded-full bg-[#5B4DFF] hover:bg-[#4B3EEB] text-white text-sm font-semibold flex items-center justify-center gap-1 transition-colors shadow-sm shadow-indigo-600/15"
      >
        + Create arena
      </Link>

      <nav className="space-y-0.5 flex-1">
        {links.map((link) => (
          <button
            key={link.key}
            type="button"
            onClick={() => onNavigate(link.key)}
            className={`w-full px-3 h-9 rounded-xl text-sm font-medium transition-colors text-left ${
              activeTab === link.key
                ? "bg-indigo-50 text-[#5B4DFF]"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            {link.label}
          </button>
        ))}
      </nav>

      <div className="pt-4 border-t border-slate-200 space-y-0.5">
        <Link
          href={isLoggedIn ? "/profile" : "/login"}
          className="block px-3 h-9 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors leading-9"
        >
          Settings
        </Link>
        <Link
          href="/support"
          className="block px-3 h-9 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors leading-9"
        >
          Help
        </Link>
      </div>
    </aside>
  );
}

function TopBar({ isLoggedIn, searchQuery, onSearchChange }) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="md:hidden h-14 px-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <TribelyLogo className="h-7 w-7" />
          <span className="text-base font-bold text-slate-950">Tribely</span>
        </Link>
        {isLoggedIn ? (
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-[#5B4DFF]"
          >
            Dashboard
          </Link>
        ) : (
          <Link
            href="/login"
            className="text-sm font-semibold text-[#5B4DFF]"
          >
            Sign in
          </Link>
        )}
      </div>

      <div className="hidden md:flex h-14 px-8 items-center justify-between gap-6">
        <div className="flex-1 max-w-sm relative">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search arenas..."
            aria-label="Search arenas"
            className="w-full h-9 pl-3 pr-3 rounded-full bg-[#F8FAFC] border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition"
          />
        </div>
        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/profile"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700"
                aria-label="Profile"
              >
                You
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/register"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Sign up
              </Link>
              <Link
                href="/login"
                className="h-9 px-4 rounded-full bg-[#5B4DFF] hover:bg-[#4B3EEB] text-white text-sm font-semibold flex items-center transition-colors"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Hero({ totalStakesCommitted }) {
  return (
    <section className="max-w-2xl pt-2 space-y-4">
      <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-950 leading-tight">
        Habit groups with real stakes
      </h1>
      <p className="text-base text-slate-500 leading-relaxed max-w-lg">
        Tribely is a group chat for daily goals. Join an arena, post proof before
        your deadline, and pay the penalty if you skip a day.
      </p>

      <div className="flex flex-wrap gap-3 pt-1">
        <Link
          href="/register"
          className="inline-flex h-10 px-5 rounded-full bg-[#5B4DFF] hover:bg-[#4B3EEB] text-white text-sm font-semibold items-center transition-colors shadow-sm shadow-indigo-600/20"
        >
          Get started
        </Link>
        <a
          href="#arena-grid"
          className="inline-flex h-10 px-5 rounded-full bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 text-sm font-semibold items-center transition-colors"
        >
          Browse arenas
        </a>
      </div>

      {totalStakesCommitted > 0 && (
        <div className="inline-block rounded-2xl bg-white border border-slate-200 px-5 py-4 shadow-sm mt-2">
          <p className="text-xs font-medium text-slate-500">
            Stakes across open arenas
          </p>
          <p className="text-2xl font-bold text-slate-950 mt-0.5">
            {formatCurrency(totalStakesCommitted)}
          </p>
        </div>
      )}
    </section>
  );
}

function SearchBar({ value, onChange, className = "" }) {
  return (
    <div className={className}>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search arenas..."
        aria-label="Search arenas"
        className="w-full h-10 px-4 rounded-full bg-white border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition"
      />
    </div>
  );
}

function SectionHeader({ title, count }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-bold text-slate-950">
        {title}
        {typeof count === "number" && (
          <span className="text-slate-400 font-normal text-base ml-1.5">
            {count}
          </span>
        )}
      </h2>
    </div>
  );
}

function ArenaGrid({ arenas, isLoading, searchActive, isLoggedIn, usingSampleData }) {
  if (isLoading) {
    return (
      <div id="arena-grid" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-44 rounded-[28px] bg-white border border-slate-200 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (arenas.length === 0) {
    return (
      <div
        id="arena-grid"
        className="rounded-[28px] border border-dashed border-slate-200 bg-white p-10 text-center"
      >
        <h3 className="text-base font-bold text-slate-950">No arenas found</h3>
        <p className="text-sm text-slate-500 mt-1">
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
        />
      ))}
    </div>
  );
}

function ArenaCard({ arena, isLoggedIn, usingSampleData }) {
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
      className="group rounded-[28px] border border-slate-200 bg-white hover:border-indigo-300 p-5 flex flex-col justify-between transition-colors shadow-sm"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-sm font-bold text-[#5B4DFF]">
          {arenaInitial(arena.name)}
        </div>
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
            arena.is_private
              ? "bg-amber-50 text-amber-700 border border-amber-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}
        >
          {arena.is_private ? "Private" : "Public"}
        </span>
      </div>

      <div className="space-y-1.5 flex-1">
        <h3 className="text-base font-bold text-slate-950 group-hover:text-[#5B4DFF] transition-colors line-clamp-1">
          {arena.name}
        </h3>
        <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">
          {arena.description}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>{formatMembers(arena.member_count)} members</span>
        <span className="font-semibold text-slate-700">
          {formatCurrency(arena.stake_at_risk)} penalty
        </span>
        {arena.deadline_time && (
          <span className="hidden sm:inline text-slate-400">
            Due {arena.deadline_time}
          </span>
        )}
      </div>
    </Link>
  );
}

function LedgerFeed({ items }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 sticky top-20 shadow-sm">
      <h2 className="text-sm font-bold text-slate-950 mb-4">Recent activity</h2>

      {!items.length ? (
        <p className="text-sm text-slate-500">
          Proof submissions and penalties show up here when the app is connected
          to the server.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl p-3 text-sm ${
                item.status === "liquidated"
                  ? "bg-rose-50 border border-rose-100"
                  : "bg-slate-50 border border-slate-100"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-slate-700">
                  <span className="font-semibold text-slate-900">
                    {item.user}
                  </span>{" "}
                  {item.action}
                </p>
                {item.status === "liquidated" ? (
                  <span className="text-rose-600 font-semibold text-xs shrink-0">
                    −{formatCurrency(item.amount)}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{item.arena}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ComingSoonPanel({ tab }) {
  const copy = {
    ledger: {
      title: "Ledger",
      body: "Every proof and penalty in your arena is logged here so the group can see who showed up.",
    },
    proof: {
      title: "Proof",
      body: "Submit a photo, link, or note before the daily cutoff. One entry per deadline window.",
    },
    social: {
      title: "Chat",
      body: "Each arena has a group thread for check-ins, reminders, and the usual peer pressure.",
    },
    vault: {
      title: "Vault",
      body: "See how much you've staked and what's been deducted when someone misses a deadline.",
    },
  }[tab];

  if (!copy) return null;

  return (
    <div className="max-w-md mx-auto text-center py-12 space-y-4">
      <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm space-y-3">
        <h3 className="text-lg font-bold text-slate-950">{copy.title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed">{copy.body}</p>
        <Link
          href="/register"
          className="inline-flex h-10 px-5 rounded-full bg-[#5B4DFF] hover:bg-[#4B3EEB] text-white text-sm font-semibold items-center justify-center transition-colors mt-2"
        >
          Create an account
        </Link>
      </div>
    </div>
  );
}

function BottomNav({ activeTab, onNavigate }) {
  return (
    <footer className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 flex items-stretch z-40 pb-[env(safe-area-inset-bottom)]">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onNavigate(item.key)}
          aria-label={item.label}
          aria-current={activeTab === item.key ? "page" : undefined}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
            activeTab === item.key
              ? "text-[#5B4DFF]"
              : "text-slate-400"
          }`}
        >
          <span
            className={`h-0.5 w-5 rounded-full mb-0.5 ${
              activeTab === item.key ? "bg-[#5B4DFF]" : "bg-transparent"
            }`}
          />
          {item.label}
        </button>
      ))}
    </footer>
  );
}

function PageFooter() {
  return (
    <footer className="hidden md:flex items-center justify-between px-8 py-5 border-t border-slate-200 text-xs text-slate-400">
      <span>© {new Date().getFullYear()} Tribely</span>
      <div className="flex items-center gap-4">
        <Link href="/protocol" className="hover:text-slate-600 transition-colors">
          How it works
        </Link>
        <Link
          href="/transparency"
          className="hover:text-slate-600 transition-colors"
          >
          Ledger
        </Link>
        <Link href="/security" className="hover:text-slate-600 transition-colors">
          Security
        </Link>
      </div>
    </footer>
  );
}