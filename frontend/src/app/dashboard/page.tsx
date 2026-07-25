"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "../utils/api";
import { useTheme } from "../context/ThemeContext";

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

// Proof type icon
const proofIcon = (t: string) =>
  t === "image" ? "📸" : t === "link" ? "🔗" : "✍️";

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)", color: "var(--fg-muted)" }}>
        <div className="flex flex-col items-center gap-3">
          <svg className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-medium">Loading dashboard…</span>
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
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const [userName, setUserName] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const isProcessingJoin = useRef(false);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newProofType, setNewProofType] = useState("image");
  const [newPenalty, setNewPenalty] = useState(500);
  const [isPrivate, setIsPrivate] = useState(false);
  const [deadlineHour, setDeadlineHour] = useState("10");
  const [deadlineMinute, setDeadlineMinute] = useState("00");
  const [deadlinePeriod, setDeadlinePeriod] = useState("PM");

  // Join modal state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [inviteCode, setInviteCode] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("tribely_token");
    const storedUserId = localStorage.getItem("tribely_user_id");
    const storedName = localStorage.getItem("tribely_user_name");
    if (!token) { router.push("/login"); return; }
    setUserName(storedName || "Tribe Member");

    const init = async () => {
      if (storedUserId) {
        try {
          const r = await api.get(`/users/profile/${storedUserId}`);
          setProfileImageUrl(r.data?.data?.profile_image_url || "");
        } catch { setProfileImageUrl(""); }
      }
      await fetchArenas();
      await checkAndProcessDeferredArenaJoin();
    };
    init();
  }, []);

  useEffect(() => {
    if (searchParams?.get("create") === "1") setShowCreateModal(true);
  }, [searchParams]);

  const fetchArenas = async () => {
    try {
      const r = await api.get("/api/arenas/");
      setArenas(r.data?.data || []);
    } catch { setError("Could not retrieve your habit Arenas."); }
    finally { setLoading(false); }
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
        setSuccessMsg("Join request sent — the arena admin will review your request.");
      } else { router.push(`/arena/${arenaId}`); }
      fetchArenas();
    } catch (err: any) {
      clear();
      const detail = err.response?.data?.detail;
      const errorCode = typeof detail === "object" && detail !== null ? detail.error_code : undefined;
      const message = typeof detail === "object" && detail !== null ? detail.message : typeof detail === "string" ? detail : undefined;
      if (err.response?.status === 404) { fetchArenas(); }
      else if (errorCode === "ARENA_MEMBERSHIP_ALREADY_APPROVED") { router.push(`/arena/${arenaId}`); fetchArenas(); }
      else if (errorCode === "ARENA_MEMBERSHIP_PENDING") { setSuccessMsg(message || "Your request is already pending approval."); fetchArenas(); }
      else { setError(message || "Could not join the selected arena."); fetchArenas(); }
    } finally { isProcessingJoin.current = false; }
  };

  const handleCreateArena = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    try {
      await api.post("/api/arenas/", {
        name: newName, description: newDesc, proof_type: newProofType,
        penalty_amount: Number(newPenalty),
        deadline_time: `${deadlineHour}:${deadlineMinute} ${deadlinePeriod}`,
        is_private: isPrivate,
      });
      setShowCreateModal(false); setNewName(""); setNewDesc(""); setIsPrivate(false);
      fetchArenas();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create Arena.");
    }
  };

  const handleJoinArena = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    try {
      const r = await api.post("/api/arenas/join-by-code", { invite_code: inviteCode.trim().toUpperCase() });
      setSuccessMsg(r.data?.data?.detail || "Join request evaluated successfully.");
      setShowJoinModal(false); setInviteCode(""); fetchArenas();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to join via invite key.");
    }
  };

  const initials = (name: string) => name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)", color: "var(--fg)" }}>

      {/* ── TOPBAR ── */}
      <header className="sticky top-0 z-30 px-5 md:px-8 py-4 flex justify-between items-center glass"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-sm"
            style={{ background: "var(--accent)" }}>T</div>
          <span className="font-extrabold text-base tracking-tight hidden sm:block" style={{ color: "var(--fg)" }}>
            TRIBELY
          </span>
        </Link>

        <div className="flex items-center gap-2 md:gap-3">
          {/* theme toggle */}
          <button onClick={toggleTheme}
            className="p-2.5 rounded-full transition-all hover:scale-110"
            style={{ background: "var(--bg-raised)", border: "1px solid var(--border)", color: "var(--fg-muted)" }}
            aria-label="Toggle theme">
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>

          {/* profile */}
          <Link href="/profile"
            className="flex items-center gap-2.5 px-3 py-2 rounded-2xl transition-all"
            style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}>
            <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs text-white"
              style={{ background: profileImageUrl ? "transparent" : "var(--accent)" }}>
              {profileImageUrl ? <img src={profileImageUrl} alt="Profile" className="h-full w-full object-cover" /> : initials(userName || "TM")}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--fg-subtle)" }}>Welcome back</p>
              <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{userName}</p>
            </div>
          </Link>

          {/* logout */}
          <button onClick={() => { localStorage.clear(); router.push("/login"); }}
            className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all hover:opacity-80"
            style={{ background: "var(--bg-raised)", border: "1px solid var(--border)", color: "var(--fg-muted)" }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
          <button onClick={() => { localStorage.clear(); router.push("/login"); }}
            className="md:hidden p-2.5 rounded-full transition-all hover:opacity-80"
            style={{ background: "var(--bg-raised)", border: "1px solid var(--border)", color: "var(--fg-muted)" }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-5 md:px-8 py-10 space-y-8">
        {/* banner messages */}
        {error && (
          <div className="px-5 py-4 rounded-2xl text-sm flex items-center gap-3 animate-fade-in"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.20)", color: "var(--danger)" }}>
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}
        {successMsg && (
          <div className="px-5 py-4 rounded-2xl text-sm flex items-center gap-3 animate-fade-in"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.20)", color: "var(--success)" }}>
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {successMsg}
          </div>
        )}

        {/* page heading */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--fg)" }}>Your Accountability Arenas</h1>
            <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
              Conquer skin-in-the-game habit challenges with local stakes.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowJoinModal(true)}
              className="btn-ghost px-5 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Join via Code
            </button>
            <button onClick={() => setShowCreateModal(true)}
              className="btn-accent px-5 py-2.5 rounded-full text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Arena
            </button>
          </div>
        </div>

        {/* loading skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3].map(i => (
              <div key={i} className="h-64 rounded-[28px] animate-shimmer"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} />
            ))}
          </div>
        ) : arenas.length === 0 ? (
          /* empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center rounded-3xl max-w-md mx-auto"
            style={{ background: "var(--bg-card)", border: "1px dashed var(--border)" }}>
            <div className="text-5xl mb-5">🥋</div>
            <h3 className="text-lg font-bold mb-2" style={{ color: "var(--fg)" }}>No active Arenas yet</h3>
            <p className="text-sm mb-8" style={{ color: "var(--fg-muted)" }}>
              Create an accountability arena and set custom stakes to back your discipline.
            </p>
            <button onClick={() => setShowCreateModal(true)}
              className="btn-accent px-6 py-3 rounded-full text-sm font-bold">
              Create Your First Arena
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {arenas.map((arena) => {
              const isPending = arena.membership_status === "pending";
              return (
                <div key={arena.id}
                  className={`rounded-[28px] p-6 flex flex-col justify-between shadow-sm transition-all duration-200 ${isPending ? "opacity-75" : "card-hover"}`}
                  style={{
                    background: "var(--bg-card)",
                    border: `1px solid ${isPending ? "rgba(245,158,11,0.40)" : "var(--border)"}`,
                    ...(isPending ? { backdropFilter: "saturate(80%)" } : {}),
                  }}>
                  <div>
                    {/* Arena Avatar & Title Row */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="relative p-0.5 rounded-full ring-2 ring-emerald-500/70 dark:ring-emerald-400/80 shadow-sm shrink-0">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-white text-sm overflow-hidden"
                          style={{
                            background: arena.icon_url
                              ? "transparent"
                              : "linear-gradient(135deg, var(--accent), #0095F6)",
                          }}
                        >
                          {arena.icon_url ? (
                            <img
                              src={arena.icon_url}
                              alt={arena.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            arena.name[0]?.toUpperCase() || "A"
                          )}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h3
                            className="text-base font-extrabold truncate"
                            style={{ color: "var(--fg)" }}
                          >
                            {arena.name}
                          </h3>
                          {arena.last_activity_at && (
                            <span
                              className="text-[10px] font-bold shrink-0"
                              style={{ color: "var(--accent)" }}
                            >
                              {formatRelativeTime(arena.last_activity_at)}
                            </span>
                          )}
                        </div>
                        {arena.last_activity_snippet && (
                          <p
                            className="text-xs truncate font-medium mt-0.5"
                            style={{ color: "var(--fg-muted)" }}
                          >
                            {arena.last_activity_snippet}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      {isPending ? (
                        <span
                          className="pill"
                          style={{
                            background: "rgba(245,158,11,0.12)",
                            color: "var(--warning)",
                            border: "1px solid rgba(245,158,11,0.25)",
                          }}
                        >
                          🔒 Pending
                        </span>
                      ) : (
                        <span
                          className="pill"
                          style={{
                            background: arena.is_private
                              ? "rgba(245,158,11,0.10)"
                              : "rgba(16,185,129,0.10)",
                            color: arena.is_private
                              ? "var(--warning)"
                              : "var(--success)",
                            border: `1px solid ${
                              arena.is_private
                                ? "rgba(245,158,11,0.20)"
                                : "rgba(16,185,129,0.20)"
                            }`,
                          }}
                        >
                          {arena.is_private ? "Private" : "Public"}
                        </span>
                      )}
                      <span
                        className="pill font-mono"
                        style={{
                          background: "var(--bg-raised)",
                          color: "var(--fg-muted)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {arena.invite_code}
                      </span>
                    </div>

                    <p
                      className="text-xs line-clamp-2 mt-1"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      {arena.description || "No description set."}
                    </p>

                    <div className="mt-5 pt-4 border-t space-y-2.5 text-xs font-medium"
                      style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}>
                      <div className="flex justify-between items-center">
                        <span>Proof Required</span>
                        <span className="font-semibold capitalize flex items-center gap-1" style={{ color: "var(--fg)" }}>
                          {proofIcon(arena.proof_type)} {arena.proof_type}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Daily Cutoff</span>
                        <span className="font-mono font-semibold" style={{ color: "var(--fg)" }}>{arena.deadline_time}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Penalty Stake</span>
                        <span className="font-bold" style={{ color: "var(--success)" }}>₹ {arena.penalty_amount}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => !isPending && router.push(`/arena/${arena.id}`)}
                    disabled={isPending}
                    className="w-full mt-5 py-2.5 text-sm font-bold rounded-full transition-all duration-150 active:scale-95"
                    style={{
                      background: isPending ? "rgba(245,158,11,0.12)" : "var(--accent)",
                      color: isPending ? "var(--warning)" : "#fff",
                      border: isPending ? "1px solid rgba(245,158,11,0.25)" : "none",
                      cursor: isPending ? "not-allowed" : "pointer",
                      boxShadow: isPending ? "none" : "0 4px 16px var(--accent-glow2)",
                    }}>
                    {isPending ? "🔒 Awaiting Admin Approval" : "Enter Arena →"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── CREATE MODAL ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-md rounded-3xl p-7 shadow-2xl animate-scale-in space-y-5"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold" style={{ color: "var(--fg)" }}>Create Arena</h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>Architect your habit accountability room</p>
              </div>
              <button onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-full transition hover:opacity-70"
                style={{ background: "var(--bg-raised)", color: "var(--fg-muted)" }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateArena} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--fg-muted)" }}>Arena Title</label>
                <input type="text" required placeholder="e.g., 5AM Lean Dev Club"
                  className="input-base focus-accent" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--fg-muted)" }}>Description</label>
                <textarea placeholder="What is the daily mandate?" rows={2}
                  className="input-base focus-accent resize-none" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
              </div>

              {/* privacy toggle */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-2" style={{ color: "var(--fg-muted)" }}>Visibility</label>
                <div className="grid grid-cols-2 gap-3">
                  {[{ v: false, icon: "🔓", label: "Public" }, { v: true, icon: "🔒", label: "Private" }].map(o => (
                    <button key={String(o.v)} type="button" onClick={() => setIsPrivate(o.v)}
                      className="py-2.5 px-3 text-xs font-bold rounded-2xl border text-center transition-all duration-150"
                      style={{
                        background: isPrivate === o.v ? "var(--accent-light)" : "var(--bg-raised)",
                        border: `1px solid ${isPrivate === o.v ? "rgba(0,122,204,0.30)" : "var(--border)"}`,
                        color: isPrivate === o.v ? "var(--accent)" : "var(--fg-muted)",
                      }}>
                      {o.icon} {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--fg-muted)" }}>Proof Type</label>
                  <select className="input-base focus-accent" value={newProofType} onChange={e => setNewProofType(e.target.value)}>
                    <option value="image">📸 Image</option>
                    <option value="text">✍️ Text</option>
                    <option value="link">🔗 Link</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--fg-muted)" }}>Daily Deadline</label>
                  <div className="flex gap-1 items-center input-base focus-accent p-0 overflow-hidden">
                    <select value={deadlineHour} onChange={e => setDeadlineHour(e.target.value)}
                      className="flex-1 h-full bg-transparent text-sm text-center py-2.5 focus:outline-none" style={{ color: "var(--fg)" }}>
                      {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span style={{ color: "var(--fg-muted)" }}>:</span>
                    <select value={deadlineMinute} onChange={e => setDeadlineMinute(e.target.value)}
                      className="flex-1 h-full bg-transparent text-sm text-center py-2.5 focus:outline-none" style={{ color: "var(--fg)" }}>
                      {["00","15","30","45"].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select value={deadlinePeriod} onChange={e => setDeadlinePeriod(e.target.value)}
                      className="h-full bg-transparent text-xs font-bold px-2 focus:outline-none" style={{ color: "var(--accent)" }}>
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: "var(--fg-muted)" }}>Penalty Stake (₹ INR)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold" style={{ color: "var(--fg-muted)" }}>₹</span>
                  <input type="number" min={0} step={50} required
                    className="input-base focus-accent pl-8 font-mono" value={newPenalty} onChange={e => setNewPenalty(Number(e.target.value))} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="btn-ghost flex-1 py-3 rounded-2xl text-sm font-semibold">Cancel</button>
                <button type="submit"
                  className="btn-accent flex-1 py-3 rounded-2xl text-sm font-bold">Launch Arena</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── JOIN MODAL ── */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-sm rounded-3xl p-7 shadow-2xl animate-scale-in space-y-5"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold" style={{ color: "var(--fg)" }}>Join via Code</h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>Enter the 6-character invite code</p>
              </div>
              <button onClick={() => setShowJoinModal(false)}
                className="p-2 rounded-full transition hover:opacity-70"
                style={{ background: "var(--bg-raised)", color: "var(--fg-muted)" }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleJoinArena} className="space-y-4">
              <input type="text" maxLength={6} required placeholder="A7B9X2"
                className="w-full py-4 text-center text-2xl font-mono font-bold uppercase rounded-2xl tracking-[0.3em] focus-accent"
                style={{ background: "var(--bg-raised)", border: "1px solid var(--border)", color: "var(--accent)" }}
                value={inviteCode} onChange={e => setInviteCode(e.target.value)} />
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowJoinModal(false)}
                  className="btn-ghost flex-1 py-3 rounded-2xl text-sm font-semibold">Cancel</button>
                <button type="submit"
                  className="btn-accent flex-1 py-3 rounded-2xl text-sm font-bold">Verify & Enter</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
