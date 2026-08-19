"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api, { formatErrorMessage } from "../utils/api";

import dataCache from "../utils/dataCache";
import FastLink from "@/components/FastLink";
import { useTheme } from "../context/ThemeContext";
import {
  Flame, Key, Camera, PenLine, Link2, Clock, Globe, User, Shield, LogOut,
  Plus, Search, Lock, Unlock, CheckCircle2, Sun, Moon, Copy, X, Coins, ChevronDown, Check
} from "lucide-react";

import KudosWalletModal from "@/components/KudosWalletModal";
import { initPushNotifications } from "../utils/pushNotification";
import { useNotifications } from "../context/NotificationContext";
import Image from "next/image";



interface Arena {
  id: number;
  name: string;
  description: string;
  invite_code: string;
  proof_type: string;
  penalty_amount: number;
  deadline_time: string;
  is_private: boolean;
  membership_status?: "approved" | "pending";
  user_role?: "admin" | "member";
  icon_url?: string | null;
  last_activity_at?: string | null;
  last_activity_snippet?: string;
  member_count?: number;
}

function formatRelativeTime(isoStr?: string | null) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function sanitizeSnippet(snippet?: string | null): string {
  if (!snippet) return "";
  if (snippet.includes("tribely_media")) {
    if (snippet.includes('"type":"audio"')) return "Voice message";
    if (snippet.includes('"type":"image"')) return "Photo submission";
    if (snippet.includes('"type":"video"')) return "Video submission";
    return "Media attachment";
  }
  if (snippet.includes("[") && snippet.includes("]")) {
    const fileName = snippet.match(/\[(.*?)\]/)?.[1] || "Attachment";
    return fileName;
  }
  return snippet;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function CustomTimeDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label || value;

  return (
    <div ref={containerRef} className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-extrabold transition-all cursor-pointer shadow-xs active:scale-98"
        style={{
          background: "var(--bg-raised)",
          borderColor: open ? "var(--accent)" : "var(--border)",
          color: "var(--fg)",
        }}
      >
        <span>{selectedLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180 text-[var(--accent)]" : "text-[var(--fg-muted)]"}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-48 overflow-y-auto rounded-2xl border p-1.5 shadow-2xl space-y-0.5 animate-in fade-in zoom-in-95 duration-150 styled-scroll"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border)",
            boxShadow: "0 12px 36px rgba(0, 0, 0, 0.4)",
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                value === opt.value
                  ? "bg-[var(--accent)] text-white shadow-sm font-black"
                  : "text-[var(--fg)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)]"
              }`}
            >
              <span>{opt.label}</span>
              {value === opt.value && <Check className="w-3.5 h-3.5 text-white" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Sun/Moon icons now imported from lucide-react


const proofBadgeConfig: Record<string, { icon: React.ReactNode; label: string; bg: string; color: string }> = {
  image: { icon: <Camera className="w-3 h-3" />, label: "Photo Proof", bg: "rgba(255, 94, 0, 0.14)", color: "#FF5E00" },
  link: { icon: <Link2 className="w-3 h-3" />, label: "Link Proof", bg: "rgba(16, 185, 129, 0.14)", color: "#10B981" },
  text: { icon: <PenLine className="w-3 h-3" />, label: "Text Log", bg: "rgba(245, 158, 11, 0.14)", color: "#F59E0B" },
};

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)", color: "var(--fg-muted)" }}>
        <div className="flex flex-col items-center gap-3">
          <svg className="w-9 h-9 animate-spin" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-xs font-semibold tracking-wide">Loading Tribely Workspace…</span>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, toggleTheme, isMounted } = useTheme();
  const isDark = theme === "dark";

  const [userName, setUserName] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "active" | "pending">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [showKudosModal, setShowKudosModal] = useState(false);
  const [userKudosBalance, setUserKudosBalance] = useState<number | null>(null);
  const isProcessingJoin = useRef(false);

  // Fetch User Kudos Balance for Account Wallet
  const fetchKudosBalance = async () => {
    try {
      const res: any = await api.get("/api/kudos/wallet");
      if (res && res.status === "success" && res.data) {
        setUserKudosBalance(res.data.kudos_balance);
      }
    } catch (e) {
      console.error("Error fetching Kudos balance:", e);
    }
  };

  // Consume global real-time WhatsApp notification context
  const { unreadCounts } = useNotifications();

  useEffect(() => {
    fetchKudosBalance();
  }, []);




  // Zero-delay instant cache pre-hydration on mount
  useEffect(() => {
    const cached = dataCache.get<Arena[]>("/api/arenas/");
    if (cached && Array.isArray(cached) && cached.length > 0) {
      setArenas(cached);
      setLoading(false);
    }
  }, []);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newProofType, setNewProofType] = useState("image");
  const [newPenalty, setNewPenalty] = useState(500);
  const [isPrivate, setIsPrivate] = useState(false);
  const [deadlineHour, setDeadlineHour] = useState("10");
  const [deadlineMinute, setDeadlineMinute] = useState("00");
  const [deadlinePeriod, setDeadlinePeriod] = useState("PM");

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState("");

  const [autoPayModal, setAutoPayModal] = useState<{
    isOpen: boolean;
    arenaId: number;
    arenaName?: string;
    penaltyAmount?: number;
  } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("tribely_token");
    const storedUserId = localStorage.getItem("tribely_user_id");
    const storedName = localStorage.getItem("tribely_user_name");
    if (!token) { router.push("/login"); return; }
    setUserName(storedName || "Tribe Member");

    const init = async () => {
      if (storedUserId) {
        dataCache.fetchSWR(`/users/profile/${storedUserId}`, (data) => {
          setProfileImageUrl(data?.profile_image_url || "");
        });
      }
      await fetchArenas();
      await checkAndProcessDeferredArenaJoin();
    };
    init();

    // Real-time background sync so newly joined or approved arenas appear without page refresh
    const syncInterval = setInterval(() => {
      fetchArenas();
    }, 4000);

    return () => clearInterval(syncInterval);
  }, []);


  useEffect(() => {
    if (searchParams?.get("create") === "1") setShowCreateModal(true);
  }, [searchParams]);

  const handleLogout = () => {
    localStorage.removeItem("tribely_token");
    localStorage.removeItem("tribely_user_id");
    localStorage.removeItem("tribely_user_name");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    dataCache.clear();
    setShowMobileDrawer(false);
    router.push("/login");
  };

  const fetchArenas = async () => {
    await dataCache.fetchSWR<Arena[]>(
      "/api/arenas/",
      (data) => {
        setArenas(data || []);
        setLoading(false);
      },
      () => {
        setError("Could not retrieve habit Arenas.");
        setLoading(false);
      }
    );
  };

  const checkAndProcessDeferredArenaJoin = async () => {
    const pendingArenaId = sessionStorage.getItem("pending_join_arena_id");
    const isPrivateStr = sessionStorage.getItem("pending_join_is_private");
    if (!pendingArenaId || isProcessingJoin.current) return;
    isProcessingJoin.current = true;
    const clear = () => { sessionStorage.removeItem("pending_join_arena_id"); sessionStorage.removeItem("pending_join_is_private"); };
    const arenaId = parseInt(pendingArenaId, 10);
    if (Number.isNaN(arenaId)) { clear(); isProcessingJoin.current = false; return; }
    try {
      const r = await api.post("/api/arenas/discovery/join", { arena_id: arenaId });
      clear();
      if (r.data?.data?.room_state === "pending" || isPrivateStr === "true") {
        setSuccessMsg("Join request sent — admin approval pending.");
      } else { router.push(`/arena/${arenaId}`); }
      fetchArenas();
    } catch (err: any) {
      clear();
      const detail = err.response?.data?.detail;
      const errorCode = typeof detail === "object" && detail !== null ? detail.error_code : undefined;
      const message = typeof detail === "object" && detail !== null ? detail.message : typeof detail === "string" ? detail : undefined;
      if (err.response?.status === 404) { fetchArenas(); }
      else if (errorCode === "ARENA_MEMBERSHIP_ALREADY_APPROVED") { router.push(`/arena/${arenaId}`); fetchArenas(); }
      else if (errorCode === "ARENA_MEMBERSHIP_PENDING") { setSuccessMsg(message || "Your request is pending approval."); fetchArenas(); }
      else { setError(message || "Could not join arena."); fetchArenas(); }
    } finally { isProcessingJoin.current = false; }
  };

  const handleCreateArena = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    try {
      const res = await api.post("/api/arenas/", {
        name: newName, description: newDesc, proof_type: newProofType,
        penalty_amount: Number(newPenalty),
        deadline_time: `${deadlineHour}:${deadlineMinute} ${deadlinePeriod}`,
        is_private: isPrivate,
      });
      setShowCreateModal(false); setNewName(""); setNewDesc(""); setIsPrivate(false);
      fetchArenas();
      setSuccessMsg("Arena created successfully!");
      const createdArena = res.data?.data;
      if (createdArena?.id) {
        router.push(`/arena/${createdArena.id}`);
      }
    } catch (err: any) {
      setError(formatErrorMessage(err.response?.data?.detail, "Failed to create Arena."));
    }
  };

  const handleJoinArena = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    try {
      const r = await api.post("/api/arenas/join-by-code", { invite_code: inviteCode.trim().toUpperCase() });
      setSuccessMsg(r.data?.data?.detail || "Joined arena successfully!");
      setShowJoinModal(false);
      setInviteCode("");
      await fetchArenas();
      const payload = r.data?.data;
      const joinedId = payload?.id || payload?.arena?.id || payload?.membership?.arena_id;
      if (joinedId) {
        router.push(`/arena/${joinedId}`);
      }
    } catch (err: any) {
      setError(formatErrorMessage(err.response?.data?.detail, "Failed to join via invite code."));
    }
  };



  const copyCode = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredArenas = arenas.filter((arena) => {
    if (activeTab === "active" && arena.membership_status === "pending") return false;
    if (activeTab === "pending" && arena.membership_status !== "pending") return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      arena.name?.toLowerCase().includes(q) ||
      arena.description?.toLowerCase().includes(q) ||
      arena.invite_code?.toLowerCase().includes(q)
    );
  });

  const activeCount = arenas.filter(a => a.membership_status !== "pending").length;
  const pendingCount = arenas.filter(a => a.membership_status === "pending").length;
  const totalStaked = arenas
    .filter(a => a.membership_status !== "pending")
    .reduce((sum, a) => sum + (Number(a.penalty_amount) || 0), 0);

  const initials = (name: string) => name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden overflow-y-auto flex flex-col relative" style={{ background: "var(--bg)", color: "var(--fg)" }}>

      {/* ── TOP HEADER NAVBAR ── */}
      <header className="sticky top-0 z-30 shrink-0 flex items-center justify-between px-3 sm:px-8 py-3.5 glass-header max-w-full overflow-hidden">
        {/* Left: Brand Icon + Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link href="/" className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-2xl flex items-center justify-center shadow-md transition transform hover:scale-105 active:scale-95 overflow-hidden border border-[var(--border)] relative" style={{ background: "#FFFFFF" }}>
            <Image src="/logo.png" alt="Tribely" fill priority sizes="40px" style={{ objectFit: "contain" }} />
          </Link>
          <div className="min-w-0">
            <h1 className="font-black text-lg sm:text-xl tracking-tight leading-none truncate" style={{ color: "var(--fg)", fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif' }}>
              Tribely
            </h1>
            <span className="text-[9px] sm:text-[11px] font-bold tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-red-500 block truncate">
              Habit Workspace
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <button
            onClick={() => setShowJoinModal(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition hover:opacity-95 active:scale-95"
            style={{ background: "var(--bg-raised)", color: "var(--fg)", borderColor: "var(--border)" }}
          >
            <Key className="w-3.5 h-3.5" /> Join with Key
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-accent text-xs font-extrabold px-3 sm:px-4 py-2 rounded-xl shadow-md transition transform active:scale-95 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">New Arena</span>
          </button>

          {/* User Account Wallet Badge */}
          <button
            onClick={() => setShowKudosModal(true)}
            className="flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-500/40 text-amber-400 text-xs font-black hover:scale-105 transition shadow-sm"
            title="Open Account Wallet (Buy & Withdraw)"
          >
            <span className="font-black text-sm text-amber-400">₹</span>
            <span className="hidden sm:inline ml-1">{userKudosBalance !== null ? `${userKudosBalance.toLocaleString()}` : "Wallet"}</span>
          </button>

          <div className="hidden sm:block w-px h-6 mx-1 bg-[var(--border)]" />

          <button onClick={toggleTheme} className="hidden sm:flex p-2.5 rounded-xl border transition hover:bg-[var(--bg-raised)] active:scale-95" style={{ color: "var(--fg-muted)", borderColor: "var(--border)" }} aria-label="Toggle theme">
            {isMounted ? (isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />) : <Moon className="w-4 h-4" />}
          </button>

          <Link href="/profile" className="hidden sm:flex w-9 h-9 rounded-xl overflow-hidden items-center justify-center font-bold text-xs text-white transition ring-2 ring-[var(--accent-glow)] transform hover:scale-105" style={{ background: profileImageUrl ? "transparent" : "var(--accent-gradient)" }}>
            {profileImageUrl ? <img src={profileImageUrl} alt="Profile" className="h-full w-full object-cover" /> : initials(userName || "TM")}
          </Link>

          {/* Mobile Navigation Drawer Trigger */}
          <button
            onClick={() => setShowMobileDrawer(true)}
            className="sm:hidden p-2 rounded-xl border transition hover:bg-[var(--bg-raised)] active:scale-95"
            style={{ color: "var(--fg)", borderColor: "var(--border)" }}
            aria-label="Open Mobile Menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>


      {/* ── 0 KUDOS WARNING BANNER ── */}
      {userKudosBalance !== null && userKudosBalance <= 0 && (
        <div className="bg-gradient-to-r from-rose-950 via-red-900 to-rose-950 border-b border-rose-500/40 px-4 py-3 shadow-lg shrink-0">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white">
            <div className="flex items-center space-x-2.5">
              <span className="text-xl">⚠️</span>
              <div>
                <strong className="font-extrabold text-rose-200 text-sm">WARNING: Your Kudos balance is 0!</strong>
                <p className="text-rose-300/90 text-[11px]">
                  Arena access is currently blocked. Daily penalties accrue for absent days until you recharge. Top-up to unlock arenas and protect your streak!
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowKudosModal(true)}
              className="shrink-0 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-black font-extrabold shadow-md hover:scale-105 transition"
            >
              ⚡ Recharge Wallet Now (₹50 = 5,000 Kudos)
            </button>
          </div>
        </div>
      )}


      {/* Notification Banners */}
      {error && (
        <div className="mx-4 sm:mx-8 mt-4 px-4 py-3 rounded-2xl text-xs flex items-center justify-between gap-3 animate-fade-in max-w-7xl sm:mx-auto" style={{ background: "var(--danger-light)", color: "var(--danger)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={() => setError("")} className="hover:opacity-75"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {successMsg && (
        <div className="mx-4 sm:mx-8 mt-4 px-4 py-3 rounded-2xl text-xs flex items-center justify-between gap-3 animate-fade-in max-w-7xl sm:mx-auto" style={{ background: "var(--success-light)", color: "var(--success)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg("")} className="hover:opacity-75"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* ── MAIN CONTAINER ── */}
      <main className={`flex-1 px-4 sm:px-8 py-6 w-full mx-auto space-y-6 ${viewMode === "list" ? "max-w-5xl" : "max-w-7xl"}`}>

        {/* ── FIERY HERO STATS BANNER ── */}
        <section className="relative overflow-hidden rounded-3xl p-6 sm:p-8 glass-card border border-[var(--border-card)]">
          {/* Fiery Ambient Background Glows */}
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-25 blur-3xl pointer-events-none" style={{ background: "#FF5E00" }} />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: "#FF2E00" }} />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Left Welcome */}
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-extrabold mb-2.5 shadow-xs" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                <Flame className="w-3.5 h-3.5" /> Social Accountability Engine
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif' }}>
                {getGreeting()}, <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-500 via-orange-500 to-red-500">{userName || "Tribe Member"}</span>
              </h2>
              <p className="text-xs sm:text-sm mt-1 max-w-xl font-medium" style={{ color: "var(--fg-muted)" }}>
                Track your daily habits, post proof before deadlines, stay accountable with peers, and protect your stakes.
              </p>
            </div>

            {/* Right Quick Stats Widget Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
              <div className="p-3.5 rounded-2xl border flex flex-col" style={{ background: "var(--bg-raised)", borderColor: "var(--border)" }}>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--fg-muted)]">Active Arenas</span>
                <span className="text-xl font-black mt-1 text-[var(--fg)]">{loading ? "..." : activeCount}</span>
              </div>
              <div className="p-3.5 rounded-2xl border flex flex-col" style={{ background: "var(--bg-raised)", borderColor: "var(--border)" }}>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--fg-muted)]">Total Staked</span>
                <span className="text-xl font-black mt-1 bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-red-500">₹{loading ? "..." : totalStaked.toLocaleString()}</span>
              </div>
              <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl border flex flex-col" style={{ background: "var(--bg-raised)", borderColor: "var(--border)" }}>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--fg-muted)]">Pending Join</span>
                <span className="text-xl font-black mt-1" style={{ color: pendingCount > 0 ? "var(--warning)" : "var(--fg-muted)" }}>{loading ? "..." : pendingCount}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── FILTER, SEARCH & VIEW TOGGLE BAR ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5">
          
          {/* Left: Search Input */}
          <div className="relative flex-1 sm:max-w-md">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--fg-subtle)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search arenas by name, tag or invite code..."
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl text-xs font-medium outline-none transition-all"
              style={{
                background: "var(--bg-card)",
                color: "var(--fg)",
                border: "1px solid var(--border-card)",
                boxShadow: "var(--shadow-card)",
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 hover:opacity-70" style={{ color: "var(--fg-muted)" }}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right: Segmented Filter Tabs + View Mode Toggle */}
          <div className="flex items-center justify-between sm:justify-end gap-2.5">
            {/* Floating Segmented Pill Switcher */}
            <div className="ios-pill-container">
              <button
                onClick={() => setActiveTab("all")}
                className={`ios-pill-tab ${activeTab === "all" ? "active" : ""}`}
              >
                All ({arenas.length})
              </button>
              <button
                onClick={() => setActiveTab("active")}
                className={`ios-pill-tab ${activeTab === "active" ? "active" : ""}`}
              >
                Active ({activeCount})
              </button>
              <button
                onClick={() => setActiveTab("pending")}
                className={`ios-pill-tab ${activeTab === "pending" ? "active" : ""}`}
              >
                Pending ({pendingCount})
              </button>
            </div>

            {/* View Mode (Grid vs List) */}
            <div className="flex items-center p-1 rounded-2xl border" style={{ background: "var(--bg-raised)", borderColor: "var(--border)" }}>
              <button
                onClick={() => setViewMode("grid")}
                className="p-1.5 rounded-xl transition"
                style={{
                  background: viewMode === "grid" ? "var(--bg-card)" : "transparent",
                  color: viewMode === "grid" ? "var(--accent)" : "var(--fg-muted)",
                  boxShadow: viewMode === "grid" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                }}
                title="Grid View"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className="p-1.5 rounded-xl transition"
                style={{
                  background: viewMode === "list" ? "var(--bg-card)" : "transparent",
                  color: viewMode === "list" ? "var(--accent)" : "var(--fg-muted)",
                  boxShadow: viewMode === "list" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                }}
                title="List View"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── ARENAS CONTAINER ── */}
        {loading ? (
          /* Loading Skeletons with GPU Shimmer */
          viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="glass-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl skeleton-shimmer" />
                    <div className="w-16 h-5 rounded-full skeleton-shimmer" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 skeleton-shimmer rounded-full w-2/3" />
                    <div className="h-3 skeleton-shimmer rounded-full w-full" />
                  </div>
                  <div className="pt-2 flex justify-between">
                    <div className="w-20 h-4 skeleton-shimmer rounded-full" />
                    <div className="w-12 h-4 skeleton-shimmer rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl skeleton-shimmer shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 skeleton-shimmer rounded-full w-1/3" />
                    <div className="h-3 skeleton-shimmer rounded-full w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : arenas.length === 0 ? (
          /* Empty Arenas State */
          <div className="glass-card p-12 text-center flex flex-col items-center justify-center max-w-xl mx-auto my-8">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4 shadow-inner" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
              <Flame className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-extrabold mb-1.5" style={{ color: "var(--fg)" }}>No Habit Arenas Yet</h3>
            <p className="text-xs sm:text-sm mb-6 max-w-md leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              Create your custom accountability room with daily goals & financial stakes, or enter an invite key to join an existing group.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => setShowCreateModal(true)} className="btn-accent text-xs font-bold px-6 py-3 rounded-2xl">
                + Launch First Arena
              </button>
              <button onClick={() => setShowJoinModal(true)} className="btn-ghost text-xs font-semibold px-6 py-3 rounded-2xl">
                🔑 Join via Code
              </button>
            </div>
          </div>
        ) : filteredArenas.length === 0 ? (
          /* Search Filter Empty State */
          <div className="glass-card p-10 text-center max-w-md mx-auto my-8">
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3" style={{ background: "var(--bg-raised)", color: "var(--fg-muted)" }}>
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold mb-1" style={{ color: "var(--fg)" }}>No matching arenas</h3>
            <p className="text-xs text-[var(--fg-muted)] mb-4">No habit room matched "{searchQuery}". Try a different term or clear filters.</p>
            <button onClick={() => { setSearchQuery(""); setActiveTab("all"); }} className="btn-ghost text-xs font-semibold px-5 py-2 rounded-xl">
              Reset Filters
            </button>
          </div>
        ) : viewMode === "grid" ? (
          /* ── GRID VIEW CARDS (Top Arena Name Header | Left Circular DP Alone | Right Box Details) ── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredArenas.map((arena) => {
              const isPending = arena.membership_status === "pending";
              const letter = arena.name?.[0]?.toUpperCase() || "A";
              const proofInfo = proofBadgeConfig[arena.proof_type] || proofBadgeConfig.image;
              const cleanSnippet = sanitizeSnippet(arena.last_activity_snippet);

              return (
                <div
                  key={arena.id}
                  onClick={() => {
                    if (isPending) return;
                    if (userKudosBalance !== null && userKudosBalance <= 0) {
                      setError("Arena access blocked! Please recharge your wallet (0 Kudos balance).");
                      setShowKudosModal(true);
                      return;
                    }
                    router.push(`/arena/${arena.id}`);
                  }}

                  onMouseEnter={() => {
                    if (!isPending) {
                      router.prefetch(`/arena/${arena.id}`);
                      dataCache.prefetch(`/api/activity/arena/${arena.id}/history`);
                      dataCache.prefetch(`/api/arenas/${arena.id}/members`);
                    }
                  }}
                  className={`glass-card glass-card-hover relative overflow-hidden group flex flex-col p-4 sm:p-5 ${
                    isPending ? "opacity-75 cursor-not-allowed" : "cursor-pointer"
                  }`}
                >
                  {/* Accent Top Hot Gradient Line */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1.5 transition-all group-hover:h-2"
                    style={{ background: isPending ? "var(--warning)" : "var(--accent-gradient)" }}
                  />

                  {/* TOP HEADER: Arena Name & Unread Counter Badge */}
                  <div className="flex items-center justify-between gap-2 pt-1 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3
                        className="font-extrabold text-base sm:text-lg tracking-tight truncate group-hover:text-[var(--accent)] transition"
                        style={{
                          color: "var(--fg)",
                          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", sans-serif',
                          letterSpacing: "-0.015em"
                        }}
                      >
                        {arena.name}
                      </h3>

                      {unreadCounts[arena.id] > 0 && !isPending && (
                        <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md animate-pulse">
                          {unreadCounts[arena.id] > 99 ? "99+" : `${unreadCounts[arena.id]} new`}
                        </span>
                      )}
                    </div>

                    {arena.is_private && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-900/10 dark:bg-white/10 font-bold shrink-0">
                        <Lock className="w-2.5 h-2.5" /> Private
                      </span>
                    )}
                  </div>


                  {/* MAIN SPLIT: Left Circular DP Alone (Centered) | Right Details Box */}
                  <div className="flex gap-4 items-center flex-1">
                    
                    {/* LEFT COLUMN: Circular DP Alone (Left Center Aligned) */}
                    <div className="shrink-0 flex items-center justify-center">
                      <div className="relative">
                        <div
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center font-black text-2xl text-white overflow-hidden shadow-md transition transform group-hover:scale-105"
                          style={{ background: arena.icon_url ? "transparent" : `hsl(${15 + (arena.id * 20) % 30}, 90%, 50%)` }}
                        >
                          {arena.icon_url ? <img src={arena.icon_url} alt={arena.name} className="w-full h-full object-cover rounded-full" /> : letter}
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: Box Container holding all details */}
                    <div className="flex-1 p-3.5 rounded-2xl border flex flex-col justify-between space-y-2 min-w-0" style={{ background: "var(--bg-raised)", borderColor: "var(--border)" }}>
                      {/* Top Details: Stake & Proof Badge */}
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "var(--warning-light)", color: "var(--warning)" }}>
                            <Clock className="w-2.5 h-2.5" /> Pending
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-black tracking-tight" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                            ₹{arena.penalty_amount}
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold" style={{ background: proofInfo.bg, color: proofInfo.color }}>
                          {proofInfo.icon} {proofInfo.label}
                        </span>
                      </div>

                      {/* Activity Snippet */}
                      <p className="text-[11px] leading-snug line-clamp-2 font-medium" style={{ color: "var(--fg-muted)" }}>
                        {isPending
                          ? "Awaiting admin confirmation..."
                          : cleanSnippet || arena.description || "No recent messages"}
                      </p>

                      {/* Cutoff Deadline */}
                      <div className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: "var(--fg-muted)" }}>
                        <Clock className="w-3 h-3" />
                        <span>{arena.deadline_time || "10:00 PM"}</span>
                      </div>

                      {/* Bottom Footer: Invite Key & Timestamp */}
                      <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-1 text-[10px]" style={{ color: "var(--fg-subtle)" }}>
                        {!isPending && (
                            <button
                              onClick={(e) => copyCode(e, arena.invite_code)}
                              className="px-2 py-0.5 rounded-lg font-mono font-bold bg-[var(--bg-card)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)] transition flex items-center gap-1 border border-[var(--border-card)]"
                              title="Copy invite code"
                            >
                              {copiedCode === arena.invite_code ? <><CheckCircle2 className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> {arena.invite_code}</>}
                            </button>
                        )}
                        <span className="shrink-0">{formatRelativeTime(arena.last_activity_at)}</span>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── STRUCTURED & SCALED LIST VIEW ROWS ── */
          <div className="ios-grouped-card divide-y divide-[var(--border)] border border-[var(--border-card)]">
            {filteredArenas.map((arena) => {
              const isPending = arena.membership_status === "pending";
              const letter = arena.name?.[0]?.toUpperCase() || "A";
              const proofInfo = proofBadgeConfig[arena.proof_type] || proofBadgeConfig.image;
              const cleanSnippet = sanitizeSnippet(arena.last_activity_snippet);

              return (
                <div
                  key={arena.id}
                  onClick={() => !isPending && router.push(`/arena/${arena.id}`)}
                  onMouseEnter={() => {
                    if (!isPending) {
                      router.prefetch(`/arena/${arena.id}`);
                      dataCache.prefetch(`/api/activity/arena/${arena.id}/history`);
                      dataCache.prefetch(`/api/arenas/${arena.id}/members`);
                    }
                  }}
                  className={`px-4 sm:px-6 py-4 flex items-center justify-between gap-4 transition group ${
                    isPending ? "opacity-75 cursor-not-allowed" : "cursor-pointer hover:bg-[var(--bg-raised)]"
                  }`}
                >
                  {/* Left Column: Avatar + Title & Clean Snippet */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center font-extrabold text-lg text-white overflow-hidden shadow-sm transition transform group-hover:scale-105"
                        style={{ background: arena.icon_url ? "transparent" : `hsl(${15 + (arena.id * 20) % 30}, 85%, 48%)` }}
                      >
                        {arena.icon_url ? <img src={arena.icon_url} alt={arena.name} className="w-full h-full object-cover rounded-full" /> : letter}
                      </div>
                      <span
                        className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center bg-[var(--bg-card)] border border-[var(--border-card)] shadow-xs"
                        style={{ color: proofInfo.color }}
                        title={proofInfo.label}
                      >
                        {proofInfo.icon}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm sm:text-base truncate tracking-tight group-hover:text-[var(--accent)] transition" style={{ color: "var(--fg)", fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif' }}>
                          {arena.name}
                        </h4>
                        {arena.is_private && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-900/10 dark:bg-white/10 font-bold shrink-0"><Lock className="w-2.5 h-2.5" /> Private</span>
                        )}
                      </div>

                      <p className="text-xs truncate font-medium mt-0.5" style={{ color: "var(--fg-muted)" }}>
                        {isPending
                          ? "Join request submitted — pending admin approval"
                          : cleanSnippet || arena.description || "No recent activity"}
                      </p>
                    </div>
                  </div>

                  {/* Middle Column: Deadline & Key (Visible on md+ screens to fill horizontal space perfectly) */}
                  <div className="hidden md:flex items-center gap-2.5 shrink-0">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-[var(--bg-raised)] text-[var(--fg-muted)] border border-[var(--border)]">
                      <Clock className="w-3 h-3" /> {arena.deadline_time || "10:00 PM"}
                    </span>

                    {!isPending && (
                      <button
                        onClick={(e) => copyCode(e, arena.invite_code)}
                        className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-[var(--bg-raised)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)] border border-[var(--border)] transition flex items-center gap-1"
                        title="Copy invite key"
                      >
                        {copiedCode === arena.invite_code ? <><CheckCircle2 className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> {arena.invite_code}</>}
                      </button>
                    )}
                  </div>

                  {/* Right Column: Penalty Stake & Relative Date */}
                  <div className="flex flex-col items-end shrink-0 gap-1 pl-2">
                    {isPending ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20">
                        Pending Approval
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-black tracking-tight" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                        ₹{arena.penalty_amount}
                      </span>
                    )}

                    <span className="text-[11px] font-medium" style={{ color: "var(--fg-subtle)" }}>
                      {formatRelativeTime(arena.last_activity_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── CREATE ARENA MODAL ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" style={{ background: "rgba(9, 13, 22, 0.65)", backdropFilter: "blur(20px)" }}>
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 sm:p-7 shadow-2xl animate-slide-up-bottom sm:animate-scale-in space-y-5 max-h-[90vh] overflow-y-auto" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="w-12 h-1.5 rounded-full bg-[var(--fg-subtle)]/30 mx-auto -mt-2 mb-2 sm:hidden" />
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black" style={{ color: "var(--fg)" }}>Launch Habit Arena</h3>
                <p className="text-xs font-medium text-[var(--fg-muted)]">Architect your social accountability group</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--bg-raised)] text-[var(--fg-muted)] hover:opacity-80"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleCreateArena} className="space-y-4">
              <div>
                <label className="text-xs font-bold block mb-1 text-[var(--fg-muted)] uppercase tracking-wider">Arena Name</label>
                <input type="text" required placeholder="e.g. 6AM Lean Dev Squad" className="input-base focus-accent" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>

              <div>
                <label className="text-xs font-bold block mb-1 text-[var(--fg-muted)] uppercase tracking-wider">Mandate / Objective</label>
                <textarea placeholder="What is the daily required proof submission?" rows={2} className="input-base focus-accent resize-none" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
              </div>

              {/* Private / Public Access Mode Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl border" style={{ background: "var(--bg-raised)", borderColor: "var(--border)" }}>
                <div>
                  <label className="text-xs font-bold block text-[var(--fg)]">Private Arena</label>
                  <span className="text-[11px] text-[var(--fg-muted)]">Require admin approval for new members</span>
                </div>
                <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} className="w-4 h-4 accent-[var(--accent)] cursor-pointer" />
              </div>

              {/* Proof Type Segmented Cards */}
              <div>
                <label className="text-xs font-bold block mb-1.5 text-[var(--fg-muted)] uppercase tracking-wider">Required Proof Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "image", icon: <Camera className="w-4 h-4" />, label: "Photo", desc: "Camera/Screenshot" },
                    { id: "text", icon: <PenLine className="w-4 h-4" />, label: "Text Log", desc: "Written Summary" },
                    { id: "link", icon: <Link2 className="w-4 h-4" />, label: "URL Link", desc: "Github/Live URL" },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setNewProofType(t.id)}
                      className={`p-3 rounded-2xl text-left border transition cursor-pointer ${
                        newProofType === t.id ? "bg-[var(--accent-light)] border-[var(--accent)] text-[var(--accent)] font-bold shadow-xs" : "bg-[var(--bg-raised)] border-[var(--border)] text-[var(--fg-muted)]"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-extrabold">{t.icon} {t.label}</div>
                      <div className="text-[10px] opacity-75">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Visibility & Cutoff Deadline */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[var(--fg-muted)] uppercase tracking-wider">Daily Cutoff Time</label>
                  <span className="text-[11px] font-extrabold text-[var(--accent)] bg-[var(--accent-light)] px-2.5 py-0.5 rounded-full border border-[var(--accent-glow)]">
                    ⏰ {deadlineHour}:{deadlineMinute} {deadlinePeriod}
                  </span>
                </div>

                {/* Quick Time Presets */}
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[
                    { h: "06", m: "00", p: "AM", label: "6 AM" },
                    { h: "09", m: "00", p: "AM", label: "9 AM" },
                    { h: "06", m: "00", p: "PM", label: "6 PM" },
                    { h: "10", m: "00", p: "PM", label: "10 PM" },
                  ].map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setDeadlineHour(preset.h);
                        setDeadlineMinute(preset.m);
                        setDeadlinePeriod(preset.p as "AM" | "PM");
                      }}
                      className={`py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                        deadlineHour === preset.h && deadlineMinute === preset.m && deadlinePeriod === preset.p
                          ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-md"
                          : "bg-[var(--bg-raised)] border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Custom Time Dropdowns */}
                <div className="flex items-center gap-2">
                  <CustomTimeDropdown
                    value={deadlineHour}
                    onChange={setDeadlineHour}
                    options={Array.from({ length: 12 }, (_, i) => {
                      const val = String(i + 1).padStart(2, "0");
                      return { value: val, label: `${val} Hour` };
                    })}
                  />

                  <span className="font-black text-sm text-[var(--fg-muted)]">:</span>

                  <CustomTimeDropdown
                    value={deadlineMinute}
                    onChange={setDeadlineMinute}
                    options={["00", "15", "30", "45"].map(m => ({ value: m, label: `${m} Min` }))}
                  />


                  <button
                    type="button"
                    onClick={() => setDeadlinePeriod(deadlinePeriod === "AM" ? "PM" : "AM")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all border shadow-sm cursor-pointer ${
                      deadlinePeriod === "PM"
                        ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white border-orange-400"
                        : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400"
                    }`}
                  >
                    {deadlinePeriod}
                  </button>
                </div>
              </div>


              {/* Stake Penalty */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[var(--fg-muted)] uppercase tracking-wider">Daily Missed Penalty (₹ INR)</label>
                  <span className="text-[11px] font-extrabold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                    Stake: ₹{newPenalty.toLocaleString()} / day
                  </span>
                </div>

                {/* Stake Presets */}
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {[0, 50, 100, 250, 500].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setNewPenalty(amt)}
                      className={`py-1.5 rounded-xl text-[11px] font-extrabold border transition cursor-pointer ${
                        newPenalty === amt
                          ? "bg-amber-500 text-black border-amber-400 shadow-md"
                          : "bg-[var(--bg-raised)] border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
                      }`}
                    >
                      {amt === 0 ? "Free" : `₹${amt}`}
                    </button>
                  ))}
                </div>

                {/* Custom Any Amount Input */}
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-base text-[var(--accent)] z-10 pointer-events-none">₹</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    required
                    placeholder="Enter any custom amount..."
                    className="w-full rounded-2xl border px-4 pl-10 py-3 font-mono font-black text-base focus-accent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    style={{ background: "var(--bg-raised)", borderColor: "var(--border)", color: "var(--fg)" }}
                    value={newPenalty === 0 ? "" : newPenalty}
                    onChange={e => setNewPenalty(e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)))}
                  />
                </div>
                <p className="text-[10px] text-[var(--fg-subtle)] mt-1">
                  💡 Type any custom amount above or select a preset. This entry stake is locked in the arena vault upon creation.
                </p>
              </div>


              {/* Submit Buttons Footer */}
              <div className="flex gap-3 pt-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-ghost flex-1 py-3 rounded-2xl text-xs font-bold">Cancel</button>
                <button type="submit" className="btn-accent flex-1 py-3 rounded-2xl text-xs font-bold shadow-lg cursor-pointer">Launch Arena 🚀</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── JOIN MODAL (BOTTOM SHEET ON MOBILE) ── */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" style={{ background: "rgba(9, 13, 22, 0.65)", backdropFilter: "blur(20px)" }}>
          <div className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-slide-up-bottom sm:animate-scale-in space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="w-12 h-1.5 rounded-full bg-[var(--fg-subtle)]/30 mx-auto -mt-2 mb-2 sm:hidden" />
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black" style={{ color: "var(--fg)" }}>Enter Invite Key</h3>
                <p className="text-xs font-medium text-[var(--fg-muted)]">Join private or public arena</p>
              </div>
              <button onClick={() => setShowJoinModal(false)} className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--bg-raised)] text-[var(--fg-muted)]"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleJoinArena} className="space-y-4">
              <input
                type="text"
                maxLength={6}
                required
                placeholder="A7B9X2"
                className="input-base focus-accent text-center tracking-widest font-mono text-xl uppercase font-black py-3.5"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowJoinModal(false)} className="btn-ghost flex-1 py-3 rounded-2xl text-xs font-bold">Cancel</button>
                <button type="submit" className="btn-accent flex-1 py-3 rounded-2xl text-xs font-bold">Join Arena</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MOBILE SLIDE-OVER NAVIGATION DRAWER ── */}
      {showMobileDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end sm:hidden animate-fade-in" style={{ background: "rgba(9, 13, 22, 0.65)", backdropFilter: "blur(12px)" }}>
          <div className="w-[80%] max-w-xs h-full bg-[var(--bg-card)] border-l border-[var(--border)] p-5 flex flex-col justify-between shadow-2xl animate-slide-in-right">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-sm border border-[var(--border)] relative" style={{ background: "#FFFFFF" }}>
                    <Image src="/logo.png" alt="Tribely" fill priority sizes="36px" style={{ objectFit: "contain" }} />
                  </div>
                  <span className="font-black text-lg" style={{ color: "var(--fg)" }}>Tribely</span>
                </div>
                <button onClick={() => setShowMobileDrawer(false)} className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--bg-raised)] text-[var(--fg-muted)]"><X className="w-4 h-4" /></button>
              </div>

              <div className="space-y-2">
                <Link href="/dashboard" onClick={() => setShowMobileDrawer(false)} className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold bg-[var(--accent-light)] text-[var(--accent)]">
                  <Flame className="w-4 h-4" /> Dashboard
                </Link>
                <Link href="/arenas" onClick={() => setShowMobileDrawer(false)} className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold hover:bg-[var(--bg-raised)]" style={{ color: "var(--fg)" }}>
                  <Globe className="w-4 h-4" /> Explore Arenas
                </Link>
                <Link href="/profile" onClick={() => setShowMobileDrawer(false)} className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold hover:bg-[var(--bg-raised)]" style={{ color: "var(--fg)" }}>
                  <User className="w-4 h-4" /> My Profile
                </Link>
                <Link href="/security" onClick={() => setShowMobileDrawer(false)} className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold hover:bg-[var(--bg-raised)]" style={{ color: "var(--fg)" }}>
                  <Shield className="w-4 h-4" /> Security & Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold hover:bg-red-500/10 text-red-500 transition text-left"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>

              <div className="pt-4 border-t border-[var(--border)] space-y-2.5">
                <button
                  onClick={() => { setShowMobileDrawer(false); setShowJoinModal(true); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold border"
                  style={{ background: "var(--bg-raised)", color: "var(--fg)", borderColor: "var(--border)" }}
                >
                  <Key className="w-3.5 h-3.5" /> Join with Key
                </button>
                <button
                  onClick={() => { setShowMobileDrawer(false); setShowCreateModal(true); }}
                  className="w-full btn-accent text-xs font-extrabold px-4 py-3 rounded-xl shadow-md flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> New Arena
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--border)] flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: "var(--fg-muted)" }}>Appearance</span>
              <button onClick={toggleTheme} className="p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold" style={{ color: "var(--fg)", borderColor: "var(--border)" }}>
                {isMounted ? (isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />) : <Moon className="w-4 h-4" />}
                <span>{isMounted ? (isDark ? "Light Mode" : "Dark Mode") : "Dark Mode"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Global Account Kudos Wallet & Cashout Modal */}
      <KudosWalletModal
        isOpen={showKudosModal}
        onClose={() => {
          setShowKudosModal(false);
          fetchKudosBalance();
        }}
      />
    </div>
  );
}

